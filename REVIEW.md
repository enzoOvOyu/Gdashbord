# REVIEW — RunSun GPU Cloud 控制台设计方案评审报告

> 评审对象：`PRD.md` / `ARCHITECTURE.md` / `DESIGN-SYSTEM.md`（评审前版本 v0.3 / v0.1 / v0.1）
> 评审日期：2026-10-17
> 评审方法：全量通读三份文档 → 建立"定义清单 vs 引用清单"双向比对 → 按 5 类维度逐项核查 → 交叉验证表/字段/枚举/路由/阈值的一致性
> 结果：修订后产出 `PRD.md` v0.4、`ARCHITECTURE.md` v0.2、`DESIGN-SYSTEM.md` v0.2（本报告的修复均已落盘）

---

## 0. 结论概览

| 维度                  | 发现问题                    | 严重問題数（高）            | 状态                  |
| ------------------- | ----------------------- | ------------------- | ------------------- |
| 1. 逻辑一致性            | 9 项（L1–L9）              | 3                   | ✅ 已修复               |
| 2. 悬空配置             | 6 项（D1–D6）              | 1                   | ✅ 已修复               |
| 3. Billing          | 7 项（B1–B7）              | 3                   | ✅ 已修复（新增 PRD §7、DDL §12.4） |
| 4. 资源映射             | 8 项（R1–R8）              | 3                   | ✅ 已修复               |
| 5. 工作关联             | 5 项（W1–W5）              | 0                   | ✅ 已修复（新增 ARCH §13）  |
| 未发现异常项              | 见 §6                    | —                   | 已标注核查范围             |

---

## 1. 逻辑一致性

| ID  | 严重度 | 位置                                              | 问题                                                                             | 修复方式 |
| --- | --- | ----------------------------------------------- | ------------------------------------------------------------------------------ | - |
| L1  | **高** | ARCH 前版 §12.2 `deployment_orders.resulting_resource_id` ↕ `resources.order_id` | **循环外键**：两表互相引用同一关系。插入时产生时序死锁（先插谁？），且两份关系无约束保证一致，是典型的双写不一致源 | **拆除**：删除 `deployment_orders.resulting_resource_id`，仅保留单向 `resources.order_id`；"订单产出了什么资源"改为按 `order_id` 查询。ARCH §12.2 已加说明 |
| L2  | **高** | PRD §5 生命周期图止于"删除释放"；DDL `resource_status` 含 `terminating` | **生命周期无终态、无法闭环**：PRD 只定义了 Provisioning/Running/Stopped/Error，删除动作没有对应状态；DDL 却有 `terminating` 从未被 PRD 定义 — 两边互相脱节 | 新增 **PRD §5.4 资源生命周期状态机**（含转移图 + 副作用表），显式定义 `Terminating` 过渡态与 `deleted_at` 软删终态；DDL 与 UI 色板同步（DESIGN §8.2） |
| L3  | **高** | PRD 前版 §5.3 "停止后费用暂停（或仅收存储费）"；DDL `rate_unit` 无存储单位 | **计量与生命周期脱钩**：费用在不同状态下怎么算没有规则，"或仅收存储费"属于**未决歧义**，DDL 也没有支撑存储计费的单位 | 新增 **PRD §7.4 计量触发点矩阵**（状态 × 算力费 × 存储费）；`rate_unit` 增加 `per_gb_hour`；明确 killed nine ever-changing-hourly: `provisioning` 不计、`running` 算力+存储、`stopped` 仅存储、\(terminating\) 立即停计 |
| L4  | 中    | PRD §3 "Owner/Admin/Dev/Viewer" vs DDL `user_role` (owner/admin/member/billing/viewer) | **角色口径两套**：PRD 用 Dev，DDL 用 member，且 DDL 的 `billing` 在 RBAC 表里没有对应权限行 | 统一为 **5 角色**（PRD §8 / ARCH §4.2 / DDL 枚举三处同源）；补齐 `billing` 角色权限；明令禁止"Dev"命名 |
| L5  | 中    | PRD §5.3 "¥/时"、DESIGN §5.11 "¥/时"、§10 "¥" vs DDL `currency='USD'` | **币种不一致**：文档混用 ¥ 与 $，金额单位口径分裂 | 全局统一 **USD 为唯一计价币种**（PRD §7.1），移除所有 ¥ 表述；货币格式化统一走 `lib/money`；明确"不做实时汇率换算" |
| L6  | 中    | ARCH 前版 §4.2 RBAC 表 Dev 行含"推理"                   | **引用已删除模块**：推理在 v0.2 已并入「资源·推理服务」，不再是一级模块，RBAC 表述失效 | RBAC 重写为 5 角色，权限以四类资源表述（PRD §8 / ARCH §4.2 一致） |
| L7  | 中    | PRD §3 "项目(Project)切换"、ARCH Store `project`、PRD §4.7 "成本分析按项目" | **Project 悬空**：UI 与状态层都在用"项目"维度，成本分析还要"按项目拆解"，但数据模型里没有 projects 表——既有金额也无法归集 | 新增 `projects` + `project_members` 表；`resources.project_id`、`billing_usage.project_id`（ARCH §12.1/§12.4） |
| L8  | 中    | DESIGN 前版 §5.6 "（见 §10）"、§7 "（见 §10）"两处        | **失效交叉引用**：状态色实际在 §8，§10 是可访问性清单，读者按引用找不到内容 | 修正为 §8；新增 §8.1/§8.2 分区并作为唯一状态色来源 |
| L9  | 中    | 资产/配额/工单/通知/模型/镜像模块；`resource_placements.node_id` | **UI 引用但无数据模型**：多个 UI 功能（事件时间线、Provisioning 进度、代金券、预留、存储包、配额、工单、通知、节点）没有任何表支撑；其中 `node_id` 直接指向一个不存在的实体 | 新增 `node_pools/gpu_nodes/node_events`、`resource_events`、`resource_provisioning_steps`、`vouchers/voucher_redemptions/reservations/storage_packs/quotas`、`tickets/notifications`、`models/images/app_templates/notebooks` 等（ARCH §12.3/§12.5） |

---

## 2. 悬空配置（定义未引用 / 引用未定义）

### 2.1 引用了但从未定义（悬空引用）

| ID  | 位置                                     | 悬空项                                | 缺失原因          | 修复 |
| --- | -------------------------------------- | ---------------------------------- | ------------- | - |
| **D1** | **高** | ARCH 前版 §12 "关闭 MSW，api-client 指向网关" | **环境变量/开关零定义**：方案声明了"可切换 Mock 与真实后端"，却从未定义用什么变量切换、默认值多少、在哪里消费 | 新增 **ARCH §12.7 环境变量与开关**，9 个变量表（变量/类型/默认值/消费位置/说明），含 `VITE_ENABLE_MOCK`、`VITE_API_BASE_URL`、`VITE_DEFAULT_REGION`、`VITE_WS_URL`、`VITE_FEATURE_STATUS_BAR` 等 |
| D2  | PRD 前版 §3.1 面包屑示例 `gpu-srv-0a1b`       | **未定义的 ID 写法**：该 ID 既非 UUID、也无生成规则 | 设计稿随手举例，未落到规范 | 新增 **PRD §5.5 ID 与标识规范**：明确 `id`(内部) / `resource_uuid`(路由) / `display_id`(展示+搜索，带类型前缀) 三种并禁止第四种写法；DDL 增加 `display_id` 唯一列 |
| D3  | ARCH 前版 §12.2 `resource_placements.node_id`/`rack_id` | **指向未定义实体**：`node_id` 是 VARCHAR 自由字符串，无 nodes 表可外键 | 供给侧节点模型缺失 | 新增 `gpu_nodes`（含 `node_uid/state/straggler/rack_id/switch_group`）与 `node_pools`；`node_id` 改为 `BIGINT REFERENCES gpu_nodes(id)` |
| D4  | PRD §4.9 资产四子项、§4.7 配额/工单             | **UI 功能无数据模型**                      | 蓝图只画了三类表     | 补齐 `quotas`/`tickets`/`vouchers`/`reservations`/`storage_packs`/`notifications`（ARCH §12.4/§12.5） |

### 2.2 定义了但从未引用（孤儿定义）

| ID  | 位置                | 孤儿项                                                | 修复 |
| --- | ----------------- | -------------------------------------------------- | - |
| D5  | DESIGN §2.2 `--rs-gold`、§2.1 `--rs-text-inverse` | 两个 Token 定义了却没有组件规范消费                               | 新增 **DESIGN §2.7 Token 引用对照表**，明确 `--rs-gold`→ResourceCard 推荐徽标/StatTile 星标、`--rs-text-inverse`→Button Primary 渐变底文本；其余 Token 逐一标注消费点 |
| D6  | DDL `rate_unit='per_instance_hour'` | 枚举值定义了但计价政策从未使用                                     | PRD §7.1 明确定位为"**保留扩展单位，v1 不启用**"，避免误用造成第二套计价口径 |

### 2.3 未发现异常的部分

- **已删除的"按场景"残留 — 未发现异常**：对三份文档全量检索 `按场景 / scenario / 双视角`，除**修订记录的历史描述**与**明确的"不设按场景"说明**外，无任何残留路由、实体、Token 或菜单引用。已在前一轮彻底清理。
- **已删除的 `/resources/scenario/*` 路由 — 未发现异常**：路由表、目录结构、侧边栏分组中均无残留引用。

---

## 3. Billing（计费模型、套餐配额、计量扣费、边界）

| ID  | 严重度    | 问题                                                              | 修复方式 |
| --- | ------ | --------------------------------------------------------------- | - |
| B1  | **高** | **无免费额度/套餐定义**：只有 `org_plan` 枚举，没有免费额度额度金额、成员上限、生效规则              | 新增 `plans` 表（含 `free_credit_usd/max_members/support_level`）与 **PRD §7.2 套餐表**（free $10 一次性 / standard / enterprise）；发放走 `billing_transactions(type='credit')` 保证可追溯 |
| B2  | **高** | **无计量触发点与周期**：何时开始计费、多久聚合一次、账期如何定义均无规定                          | **PRD §7.4** 明确"状态 × 算力费 × 存储费"矩阵 + 每小时整点聚合 + 不足整小时按秒折算；`UNIQUE(resource_id, usage_hour, unit)` 幂等 |
| B3  | **高** | **无超限处置**：余额不足会怎样完全没有定义                                         | **PRD §7.6** 定义完整处置链：阈值预警 → 立即限制新建 → 宽限 24h → 自动 Stopped（保留数据）→ 7 天后释放；并明确阈值字段 `orgs.low_balance_threshold_usd` |
| B4  | 中      | **无升降级与退款规则**                                                   | **PRD §7.6**：升级立即生效按比例补差、降级下期生效、免费额度不重复发放；已消耗不退、供给失败由 `type='adjustment'` 冲正、人工退款优先返券 |
| B5  | 中      | **代金券/预留/配额无表**：资产模块与配额模块无法落地                                   | 新增 `vouchers`/`voucher_redemptions`/`reservations`/`storage_packs`/`quotas`（ARCH §12.4） |
| B6  | 中      | **双机制冲突**：既有"实时扣余额"又有"月结发票"，未说明二者关系，存在重复收费歧义                    | **PRD §7.5** 明确：实时客帐扣费为主路径，`invoices` 是**月结对账凭证而非二次扣费** |
| B7  | 低      | `billing_usage.amount` 是 `quantity×unit_price` 的派生列               | 明确为**定价后的不可变快照**（防止改价追溯污染历史账单），属有意为之，非缺陷 |

**计费口径闭环校验（修复后）**：4 类资源统一按 `per_gpu_hour`；**推理服务明确不按调用量/令牌计费**（其 QPS/令牌吞吐仅用于服务治理观测），消除单价模型分裂 → `billing_usage.unit` 单一口径 → `invoices.total` 可由 usage 汇总验证 → `transactions` 与 `orgs.credit_balance` 同事务写入。

---

## 4. 资源映射（ID、配额、归属、生命周期）

| ID  | 严重度    | 问题                                                                         | 修复方式 |
| --- | ------ | -------------------------------------------------------------------------- | - |
| R1  | **高** | **ID 口径四套**：`resources.id`(BIGINT) / `resource_uuid`(UUID) / PRD 示例 `gpu-srv-0a1b` / 路由 `:id`，且从未说明 URL 用的是哪个 | **PRD §5.5 + ARCH §12.6**：`id` 仅限内部主键禁止出接口；`resource_uuid` 用于详情路由；`display_id`（`srv-/bm-/vgpu-/inf-` 前缀）用于 UI 展示与 ⌘K 搜索。TS 侧用品牌类型区分 |
| R2  | **高** | **类型命名三套**：`gpu_vm`(枚举) / `servers`(路由) / `GPU 云服务器`(UI) 无映射，易产生歧义漂移         | 新增 **PRD §5.2.1 + ARCH §12.6 规范映射表**（kind ↔ routeKey ↔ 显示名 ↔ display_id 前缀 ↔ 类型色 Token），并声明"任何新页面必须引用同一份常量" |
| R3  | 中      | **枚举 code 与展示名无映射**：`H100_SXM` vs "H100 SXM"、`jp` vs "日本" 散落各处，无统一映射      | 新增 **PRD §9.1/§9.2 命名映射表** + `node_pools.display_name` 字段 + ARCH §12.6 统一表 |
| R4  | 中      | **`spec_json` 无结构约束**：JSONB 自由写，四类资源各自必填字段不明，前端无法可靠渲染差异区块                | 新增 **ARCH §12.9 `spec_json` 契约**（Zod），按 kind 规定必需/可选键；并澄清 `requested_spec`(请求) vs `spec_json`(实际供给) 允许不同，UI 展示实际规格 |
| R5  | 中      | **`resources.node_pool` 与 `resource_placements.node_pool` 冗余**，语义未区分        | 明确定义：`resources.node_pool` = **主节点池**；`resource_placements.node_pool` = **实际落位**（多节点 vGPU 场景可与主池不同） |
| R6  | 中      | **配额消耗口径缺失**：配额是否存在、被什么状态占用均未定义                                         | 新增 `quotas` 表 + **PRD §7.3** 占用口径：`gpu/vcpu` 占用于 `{provisioning, running}`，`stopped` 释放；`storage_gb` 占用于 `{provisioning, running, stopped}`；`deleted_at` 非空全部释放；`used_value` 为派生值，禁止业务写 |
| R7  | 中      | 终止/删除后的释放动作未定义（配额何时释放、计费何时停止）                                            | **PRD §5.4** 副作用表 + §7.3/§7.4 联动：`Terminating` 立即停计并按秒结算，`deleted_at` 非空释放全部配额 |
| R8  | 低      | DDL 中 `resource_placements` 建在 `gpu_nodes` 之前（外键不满足依赖顺序）                   | ARCH §12 增加**建表顺序说明**：identity → supply → deployment → billing → content |

---

## 5. 工作关联（实体 → 工作项/任务 → 追溯落地）

**结论：修复前方案无法把实体关联到工作项**（无任务实体、无进度明细、无来源字段、无成本归集维度）；修复后形成**单一可追溯闭环**。

| ID  | 问题                                                                 | 修复方式 |
| --- | ------------------------------------------------------------------ | - |
| W1  | **无"工作项/任务"实体**：部署向导提交后没有任何落库对象承载任务状态；PRD §5.3 要求的 Provisioning 进度步骤无数据来源 | `deployment_orders` = **工作项**（`status` 即任务状态：pending→provisioning→fulfilled/failed）；新增 `resource_provisioning_steps` = **子任务**（`step_key` + `state` + 起止时间），直接驱动进度条 |
| W2  | **事件时间线无模型**：详情页要求"从购买到就绪的事件流"，但无事件表                              | 新增 `resource_events`（含 `level`/`type`/`actor_user_id`/`payload`），并按 `created_at DESC` 索引 |
| W3  | **来源不可追溯**：从模型库/镜像商城/应用模板创建的资源，无法回溯"它是从哪个模型/镜像/模板来的"             | `deployment_orders.source_type` + `source_ref_id`（→`images`/`models`/`app_templates`/`notebooks`）；并补齐 `models/images/app_templates/notebooks` 表 |
| W4  | **成本追溯不到责任维度**：成本分析要"按项目/资源/区域拆解"，但没有 `project_id`                  | `resources.project_id` + `billing_usage.project_id` + `projects/project_members` 表，使成本可归集到组织→项目→资源 |
| W5  | **运维操作无审计**：cordon/drain/remediation 无操作人与时间记录                     | 新增 `node_events`（含 `actor_user_id` 与 `payload`），每次状态转移落一条，集群·事件与维护页可直接消费 |

**落地产物（新增 ARCH §13）**：
- §13.1 **主链路图**：`plans/orgs/users/projects → deployment_orders → resources → {provisioning_steps, placements→gpu_nodes→node_pools, events} → billing_usage → transactions → orgs.credit_balance / invoices → voucher_redemptions → vouchers`
- §13.2 **UI → 表 → 关键字段 对照表**（13 行：部署向导、进度条、资源详情、事件时间线、来源、拓扑、集群事件、状态栏、成本分析、配额、资产、工单、通知）
- §13.3 **幂等与一致性要点**：重复计量、订单重试、余额漂移、配额重算、软删清算 5 项机制

---

## 6. 未发现异常项（附核查范围）

| 检查点                      | 结论        | 核查范围说明                                                                                                     |
| ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------- |
| **删除功能的路由残留**            | **未发现异常** | 对 `/resources/scenario/*`、`serving/`、`/training/*`、`/serving/*` 全量检索三份文档，均无残留引用（含 ARCH 目录树、路由表、RBAC、Mock 实体） |
| **创建/展示解耦的引用一致性**        | **未发现异常** | 核查部署中心是否仍承载资源列表：PRD §4.2、§5.6、§6.4 三处均一致声明"仅创建向导、创建后不陈列实例"                                                |
| **节点状态机 5 态内部自洽**        | **未发现异常** | 核查 PRD §9.3 状态图 ↔ ARCH §9 transition 列表 ↔ DESIGN §8.1 配色三者，状态数、命名、具备 slang transitions 全部一一对应                |
| **区域与节点池数量**             | **未发现异常** | 全文档范围（PRD §9.1/§9.2、ARCH 枚举、DESIGN 可视化规范）一致为 **5 节点池 + 4 区域**，无数量漂移                                        |
| **i18n / 无障碍 / 暗色主题规范**  | **未发现异常** | 核查 DESIGN §9/§10 与 PRD §10：AA 对比度、焦点环、非色依赖、reduced-motion、i18n 不硬编码均有定义且被组件规范消费，无自相矛盾                      |
| **侧边栏分组与 PRD 导航树一致性**    | **未发现异常** | 逐项比对 DESIGN §5.10 分组 vs PRD §2 导航树，8 个一级项与二级项完全对应（含"资源"4 类）                                                |

---

## 7. 变更文件清单

| 文件                  | 版本变动          | 主要变更                                                                                                                     |
| ------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `PRD.md`            | v0.3 → **v0.4** | 新增 §5.4 资源生命周期状态机（闭环）、§5.5 ID 规范、§5.2.1 类型映射表、**§7 计费·套餐·配额规则**、**§8 身份与角色**；重写 §6.5 数据模型约束；§9 补命名映射表；§12 验收清单扩展至 13 条；全文统一 USD/5 角色 |
| `ARCHITECTURE.md`   | v0.1 → **v0.2** | §12 重写并扩充为 12.1–12.9（identity / deployment / supply / billing / content / 枚举映射 / **环境变量与开关** / 边界声明 / spec_json 契约）；**新增 §13 实体追溯链路**；拆除循环外键；RBAC 5 角色 |
| `DESIGN-SYSTEM.md`  | v0.1 → **v0.2** | 修正 §5.6/§7 失效交叉引用（§10→§8）；§8 拆分为节点 5 态 + **资源生命周期 6 态**；新增 `--rs-status-terminating` Token、**§2.7 Token 引用对照**、**§5.18 LifecycleBadge**；统一 $ / USD 表述 |
| `REVIEW.md`         | 新增            | 本报告                                                                                                                      |

---

## 8. 遗留事项（需业务决策，不阻塞本次修订）

1. **多币种**：当前判定 USD 为唯一计价币种。若未来需支持人民币/日元结算，需引入账户币种 + 汇率快照表，届时 `billing_usage.currency` 与 `orgs.currency` 需同步扩展。
2. **宽限与释放期限**（24h / 7 天）为建议默认值，正式上线前需按商务策略确认。
3. **时序数据**（GPU 利用率、goodput、QPS、延迟）明确不落 PostgreSQL，需另行选定时序方案；当前由 Mock 层提供。
4. **品牌主色**仍未取得 runsuncloud.com 官方品牌指南（线上 CSS 不可达），现有金橙调色板为推导值，正式落地前需校准。
