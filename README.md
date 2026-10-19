# RunSun 控制台（GPU 云控制台）

一体化 GPU 云控制台（GPU 选购 / 部署交付 / K8s GPU 资源管理 / 可观测性 / FinOps）的前端实现。
严格对齐工作空间设计文档：`PRD.md` / `ARCHITECTURE.md` / `DESIGN-SYSTEM.md` / `MOCK-DATA.md` / `REVIEW.md`。

> 当前范围：**仅前端展示 + Mock 层**。真实后端未实现，全部接口由 MSW 拦截 `/api/*`；
> PostgreSQL 由 Docker 提供，仅作为数据底座与 DDL 验证载体，详见 `ARCHITECTURE.md §12`。

> ## ✅ 文档 vs 代码 状态（2026-10-19：v0.6 + v0.7 + v0.8 规范已全部落地）
>
> 设计文档（PRD v0.6 / v0.7、ARCHITECTURE、DESIGN-SYSTEM、MOCK-DATA v1.1 / v1.2）的全部要求**均已在代码中实现**。
> 上表为 v0.6 核对记录，**v0.7 功能增强轮的落地情况见下方「v0.7 落地清单」**。
>
> | # | v0.6 规范 | 代码状态 |
> |---|-----------|----------|
> | 1 | 导航：集群→**运营&运维**；删**调度与拓扑**、删**运营·监控**、删**模型库** | ✅ `features/ops`（七页）；`features/cluster`/`operations`/`model-library` 已删除；模型卡片并入镜像商城 |
> | 2 | Topbar 移除全局区域选择器；Logo 冻结；StatusBar 数值真实派生 | ✅ 区域选择器按页常驻（§3.3）；品牌条冻结；状态栏六簇全部由接口派生，无硬编码 |
> | 3 | **每个列表页可点击展开**（A/B/C 三档 + Drawer） | ✅ 资源列表 A 档（行→抽屉→整页）；运营页 B/C 档（抽屉 / 行内展开） |
> | 4 | 项目为真实实体，`GET/POST/DELETE /api/projects`，部署向导内联新建 | ✅ `fixtures/projects.ts`（默认项目不可删、有资源禁删）；向导第 1 步可内联新建并选中 |
> | 5 | 四类购买向导**各自 5 步**（字段级），裸金属按「台」 | ✅ `GpuVmWizard` / `BareMetalWizard` / `VgpuWizard` / `InferenceWizard`；裸金属台数 1–32，费用按台·小时 |
> | 6 | 四类详情页**各自独立组件与区块规则**，字段有 DB 来源（MOCK §6.8） | ✅ `ServerDetail` / `BareMetalDetail` / `VgpuDetail` / `InferenceDetail`，各自 Tabs 与字段口径 |
> | 7 | 每类详情页含「计费」Tab（实时费用/单价构成/用量明细/扣费流水） | ✅ 共享 `BillingTab`，单位随类型（裸金属显示「台·小时」，禁止按卡） |
> | 8 | 删除为真实调用 `DELETE /api/resources/:uuid` + 键入 `display_id` 确认 | ✅ 软删（置 `deleted_at`、释放配额、停止计量、保留用量与流水历史） |
> | 9 | 区域切换后 Mock 数据真实重算（G9 + 区域×池矩阵） | ✅ 资源/节点/节点池/事件/日志/成本/配额接口均按 `?region=` 过滤聚合 |
> | 10 | ARCH §12.10.3 C1–C14 约束 + §8.3 断言扩充 | ✅ `lib/consistency.ts` 运行时断言 + 计费单位语义（`per_machine_hour`/`per_cluster_hour`） |

> ### 🚀 v0.7 落地清单（2026-10-19）
>
> | # | v0.7 规范 | 代码状态 |
> |---|-----------|----------|
> | 1 | **§2.1 侧边导航**：总览为直达项（无子菜单）；其余分组点击组标题展开/收起（chevron + ≤200ms + `prefers-reduced-motion` 禁用）；收起态持久化 `rs.nav.collapsed`；激活组强制展开 | ✅ `app/layouts/Sidebar.tsx` + `stores/nav.ts` |
> | 2 | 「开发（辅助）」→ **工作台 Workbench**，路由 `/workbench/*`（旧 `/development/*` 重定向）；新增**弹性伸缩**页 | ✅ `features/workbench/*`（Notebooks / Images / Apps / ScalingPage） |
> | 3 | **§4.2.6 两类弹性策略模型**（节点池伸缩 / 服务副本伸缩，不共用表单）在四类向导落地，默认关闭 | ✅ `deployment/shared/ScalingForm.tsx` + `schemas.ts`（`nodePoolScalingSchema` / `replicaScalingSchema`） |
> | 4 | 费用明细卡**保底（min）/ 峰值（max）双档**月度预估；下单配额预检按 max 档 | ✅ `shared/pricing.ts`（`ScalingBands`）+ `handlers`（`scaleFactor`） |
> | 5 | 下单即生成 `scaling_policies` 行；资源详情「弹性」Tab 只读，写入口唯一在工作台 | ✅ `fixtures/scaling.ts` + `resources/detail/ScalingTab.tsx` |
> | 6 | **§4.5.1 Notebook 三类挂靠**（云服务器 / 裸金属 / vGPU）+ 详情页一键创建（`?resource=<uuid>`） | ✅ `features/workbench/NotebooksPage.tsx` + `DetailShell` 反向联动入口 |
> | 7 | **§3.5.1 项目页迁入运营&运维**：竞品卡片网格 + 六 Tab 整页详情 + 409 `PROJECT_HAS_RESOURCES` | ✅ `features/ops/ProjectsPage.tsx` / `ProjectDetailPage.tsx` |
> | 8 | **§3.1 i18n 中英双语**：Topbar 语言切换器 + `localStorage`（`rs.locale`）+ `<html lang>` 同步；UI 零硬编码中文，fixture 值经 `dt()` 出英译 | ✅ `src/i18n/`（1458 键，中英严格对齐）+ `stores/locale.ts` |
>
> ### 🚀 v0.8 落地清单（2026-10-19）
>
> | # | v0.8 事项 | 代码状态 |
> |---|-----------|----------|
> | 1 | **⌘K 全局命令面板**（cmdk 1.1.1，此前已装未用）：Topbar 搜索框 / `⌘K`·`Ctrl+K` 唤起；四组内容 = 资源搜索（`/api/resources?q=` 服务端过滤，最多 8 条跳详情）+ 页面导航（与 Sidebar 同源 `navModel`，RBAC 过滤）+ 四类新建向导 + 快捷操作（语言 / 主题） | ✅ `components/command/CommandPalette.tsx` + `palette.css` + `app/layouts/navModel.ts` |
> | 2 | **测试体系**：Vitest 3（`vitest.config.ts`，`pnpm test`）；65 例覆盖 money / ids / date / derive 派生公式 / i18n 中英契约 / scaling 种子契约（方向自洽、末值=实际规格、warm≤10s、人工干预与库存回退） | ✅ `src/**/*.test.ts`（7 文件 65 例全绿） |
> | 3 | **CI**：GitHub Actions（push / PR 到 main）：install → typecheck → test → build | ✅ `.github/workflows/ci.yml` |
> | 4 | **构建优化**：`manualChunks` 拆 vendor（react / charts / ui / query）；MSW 改动态导入（Mock 关闭时不打包 fixtures）；入口 chunk **1012 kB → 201 kB**（gzip 333 → 70），无 >500 kB 警告 | ✅ `vite.config.ts` + `app/providers.tsx` |
> | 5 | **测试揪出的真实缺陷已修**：`sb.runningTotal` 中文文案误写为 `{data.running_total}`（插值不生效，状态栏会显示原始占位符） | ✅ `i18n/locales/zh-CN.ts` |
>
> **已知待办（非缺陷）**：真实 IAM 成员归属由后端下发，Mock 阶段取组织内 IAM 用户的稳定子集。

## 技术栈（ARCH §1）

- **React 19** + **TypeScript 5**（strict）+ **Vite 6** + **pnpm**
- 状态管理：Zustand + TanStack Query；路由：React Router 7（路由级代码分割）
- UI 原语：Radix UI + CSS Modules（消费设计 Token）；图表：Recharts
- 表单：**React Hook Form + Zod**（部署向导分步校验，ARCH §2）
- Mock：**MSW** 拦截 `/api/*`，开关 `VITE_ENABLE_MOCK`
- 测试：**Vitest 3**（65 例：lib / derive / i18n 契约 / scaling 契约 / 架构边界）；CI：GitHub Actions
- 数据库底座：**PostgreSQL 15**；容器编排：**Docker Compose**

## 开发进度

> 阶段划分与验收口径均取自设计文档；✅ 已完成 / ⏳ 待办。

### ✅ 基础层（阶段 1）

| 内容 | 落地位置 | 依据 |
|------|----------|------|
| 领域类型 + 品牌 ID（`ResourceUuid`/`DisplayId`/`InternalId`，内部主键不出接口） | `src/types/domain.ts` | ARCH §12 DDL · PRD §5.5 |
| **单一事实来源映射表**：kind ↔ routeKey ↔ `display_id` 前缀 ↔ 类型色 | `src/lib/ids.ts` | ARCH §12.6 |
| USD 唯一格式化入口（不做汇率换算） | `src/lib/money.ts` | G3 |
| 5 角色菜单可见性与危险操作矩阵 | `src/lib/rbac.ts` | PRD §8 |
| UTC 存储 + 本地展示 + Tooltip 原始 UTC | `src/lib/date.ts` | §8.5 |

### ✅ Mock 数据层（阶段 2）

- fixtures：`gpu-specs`（§3 硬件基线）、`pricing`（§4 单价/区域系数/折扣）、`regions-pools`（§5.4 容量）、`models`（§7.3）、`images`、`thresholds`（§6，组件只读消费）
- `lib/derive.ts`：**§7 全部派生公式**（费用、6ND-8ND 吞吐、带宽受限 decode 上界、KV cache、straggler、goodput、显存分解）——金额与指标一律算出来，不硬编码（G2）
- `lib/rng.ts` mulberry32 固定种子（G5 可复现）、`lib/timeseries.ts` 五种形态模板 + 昼夜节律（§8.2）、`lib/consistency.ts` G8 红旗运行时断言（§8.3）
- `metrics.ts`：四类资源指标集（§6.2–§6.5），时序走**独立 `/api/metrics/*`**，与业务实体接口分离（§12.8）

### ✅ UI 原语与状态徽标（阶段 3）

- `components/ui`：Button / Card / Badge / StatTile / Table / Tabs / Input / **Drawer / ConfirmDialog / KeyValue / MetricCard / PageHeader / Segmented / Toast / Field / RegionSelect**（CSS Modules + Token）
- `LifecycleBadge`（资源生命周期 6 态）、`StateMachineBadge`（节点 5 态）——强制「颜色 + 图标 + 文本」

### ✅ 布局、Store 与路由（阶段 4）

- Sidebar 分组导航 + Topbar（56px）+ **StatusBar（40px，§3.2 六状态簇，紧张判据 `available/total < 0.15`）**
- 全导航路由 + 代码分割 + RBAC 可见性

### ✅ 资源模块（阶段 5，核心强制项）

- 4 类各自独立列表（`/resources/:routeKey`）+ **独立详情页组件**（`/resources/:routeKey/:uuid`），命名/路由/`display_id` 前缀对齐 §5.2.1
- 列表工具栏：区域 / 项目 / 状态筛选 + 搜索；行点击进入**快速抽屉**（概览/指标/事件三 Tab + 「查看完整详情」），删除需键入 `display_id` 确认
- 详情页覆盖 **provisioning → running/error → stopped → terminating** 全闭环（§5.3/§5.4），provisioning 展示供给子步骤、error 展示失败原因
- 四类详情各自 Tabs 与区块规则：云服务器（概览/监控/控制台/配置与存储/事件/计费）、裸金属（+ 硬件监控/带外管理/固件与驱动）、vGPU（+ 控制面/节点池/工作负载三级下钻/拓扑）、推理（实例管理/服务治理/结构化日志/vLLM 分位指标）
- **每类详情均含「计费」Tab**：实时费用卡 / 单价构成 / 用量明细（逐小时）/ 扣费流水，单位随类型（裸金属「台·小时」）
- 事件时间线带 **before→after 度量快照 + 建议动作**（§9）；监控按状态自洽（provisioning/stopped 为 `null` 而非 0，图表断点不填 0）

### ✅ 部署中心（阶段 6，PRD §4.2）

- **四类资源各自独立 5 步向导**（路由 `/deployment/:kind` 按 kind 分发）：
  - **GPU 云服务器**：规格卡片化（按区域可用性置灰并标注可用区域）→ GPU 数/vCPU/内存 → 镜像 + 系统盘/数据盘 → 网络（VPC/子网/安全组/公网 IP/带宽/SSH）→ 高级（数量/闲置关机）
  - **GPU 裸金属**：整机卡片（一台 = 8 卡，显示每台单价）→ **台数 1–32**（超出提示批量提工单）→ 直通/MIG/RAID → 网络 + IB + IPMI/BMC → OS 镜像 + 主机名 + SSH + 固件基线
  - **vGPU（CKS 式托管 K8s）**：控制面（K8s 版本/HA/公网 API）→ **多节点池**（最多 5 个，切片策略 MIG/time-slicing/MPS）→ 网络（VPC/子网/CNI/Ingress/StorageClass/PVC）→ 访问（kubeconfig/RBAC）
  - **推理服务**：模型卡片（含显存占用估算）→ 容量（量化/max_model_len/并发）→ 算力（副本数/单副本 GPU/引擎/HPA）→ 服务（端口/鉴权/灰度 canary）→ 确认；内置 **§4.2.4 显存校验闸门**（所需显存 > 单副本显存时阻断并给出改 FP8 或加 TP 卡数建议）
- 价格预估：复用 `derive.ts` §7.1，**计费单位按类型区分**——裸金属按**台·小时**、vGPU 控制面按集群·小时 + 各池 GPU·小时、推理按 GPU·小时（不按调用量/令牌）
- 下单生成 `deployment_orders`，异步映射为 `resources` 并自动跳转资源详情（§5.3）；创建时校验项目与区域池可用性（不可用返回 409）

### ✅ 运营&运维（阶段 7）

| 模块 | 页面 | 说明 |
|------|------|------|
| 运营&运维 | **节点池** / **节点** / **事件与维护** / **日志** / **成本分析** / **配额** / **工单** | 每页页头常驻区域选择器（非区域维度则禁用 + tooltip）；节点池含可用/总量/单价/空闲量比价与无货标注；节点含 5 态分布与 Xid 事件；事件含 before/after 与维护动作；日志为结构化逐行流（可跳资源详情）；成本四维下钻（项目/资源/区域/类型）；配额含占用明细（holders）；工单可关联资源并新建 |
| 开发 | **Notebook·IDE** / 镜像商城 / **AI 应用模板** | 镜像商城内并入**模型卡片**（原独立「模型库」模块已删除），模型同时作为推理向导选型来源 |
| 数据 | **数据集** / **对象存储** / **数据预处理 Pipelines** | DAG 节点与边由 `dag_json` 派生 |
| 资产 | **计算资产** / 代金券 / **预留实例** / **存储包** | 计算资产含月度折算；存储包含消耗进度 |

### ⏳ 已知缺口与待办

1. **无真实后端**：`VITE_ENABLE_MOCK=false` 后 `/api/*` 无实现；PostgreSQL 仅跑 DDL，未被应用访问。
2. **UI 层对 Mock fixtures 的有限引用已收敛为白名单**（ARCH §11）：`src/test/architecture.test.ts` 把 `features/`、`components/`、`stores/`、`app/` 中引用 `mocks/` 的 18 个文件及理由钉死，新增引用必须登记理由，防止悄悄扩散。涉及取价常量（`fixtures/pricing`）、模型目录（`fixtures/models`）、硬件规格（`fixtures/gpu-specs`）、指标语义（`fixtures/thresholds`）等——严格按 §11「Mock 关闭时派生责任移交后端」，这些应改为经 `/api/catalog/*` 下发，属后续重构项（改后会牵动向导同步取价路径，故本轮只做边界治理，未做数据源迁移）。
3. `tsconfig` 关闭了 `noUncheckedIndexedAccess`（超出 strict 要求，与确定性 fixture 的数组索引冲突）；`strict` / `noUnusedLocals` / `noUnusedParameters` 均保留。
4. ~~未铺 CI、单测~~ —— **v0.8 已补齐**：Vitest 65 例 + `.github/workflows/ci.yml`（typecheck / test / build）。E2E（Playwright）仍未铺。
5. ~~生产构建主 chunk 约 789 kB~~ —— **v0.8 已优化**：入口 chunk 201 kB（gzip 70 kB），vendor 拆为 react / charts / ui / query 四个可缓存 chunk，无 >500 kB 警告。

## 目录结构（ARCH §3）

```
src/
├─ app/
│  ├─ providers.tsx        # QueryClient + MSW 动态初始化（受 VITE_ENABLE_MOCK 控制）
│  ├─ router.tsx           # 全导航路由 + 路由级代码分割
│  └─ layouts/             # ConsoleLayout / Sidebar / Topbar / StatusBar / navModel（导航模型）
├─ components/
│  ├─ ui/                  # Button / Card / Badge / StatTile / Table / Tabs / Input /
│  │                       #   Drawer / ConfirmDialog / KeyValue / MetricCard / PageHeader /
│  │                       #   Segmented / Toast / Field / RegionSelect（CSS Modules + Token）
│  ├─ command/             # CommandPalette（⌘K 命令面板，cmdk）+ palette.css
│  ├─ state-machine/       # LifecycleBadge（6 态）/ StateMachineBadge（5 态）
│  └─ charts/MetricChart   # 固定量程 + 阈值虚线 + null 断点
├─ features/               # overview / deployment（四类独立向导）/ resources（四类列表
│                          #   + detail 四类独立详情）/ ops（运营&运维七页）/ workbench
│                          #   / data / assets / shared（BillingTab / MetricsPanel）
├─ lib/                    # api-client / rbac / ids / money / date（基础工具）
├─ mocks/
│  ├─ handlers/            # MSW 拦截器（业务实体 /api/*）
│  ├─ fixtures/            # gpu-specs / pricing / regions-pools / models / images /
│  │                       #   projects / billing / logs / workloads / nodes / scaling / …
│  ├─ lib/                 # rng / derive / timeseries / consistency / env
│  └─ metrics.ts           # 时序指标（独立 /api/metrics/*）
├─ stores/                 # auth / nav（侧栏折叠态）/ locale / theme
├─ styles/theme.css        # 设计 Token（亮/暗，DESIGN-SYSTEM §2/§4）
├─ test/                   # setup.ts（localStorage 存根）+ architecture.test.ts（架构边界）
└─ types/domain.ts         # 与 §12 DDL 同构的领域类型
vitest.config.ts           # 测试配置（与 vite.config 分离）
.github/workflows/ci.yml   # CI：typecheck + test + build
docker/
├─ frontend/Dockerfile     # 前端开发容器（Node22 + pnpm + Vite6）
└─ postgres/init/          # 01-schema.sql（§12 全量 DDL）+ 02-seed.sql（种子）
docker-compose.yml         # frontend(5173) + db(5432) + adminer(8081)
```

## 本地开发（先决：Node 22 + pnpm 9）

```bash
pnpm install
pnpm exec msw init public/ --save   # 生成 public/mockServiceWorker.js
pnpm dev        # http://localhost:5173
pnpm build      # tsc -b && vite build
pnpm test       # Vitest 单测（65 例：lib / derive / i18n / scaling / 架构边界）
pnpm typecheck  # tsc -b --noEmit
```

## Docker 开发环境

```bash
cp .env.example .env   # 按需修改；默认即可
docker compose up -d   # 前端容器 frontend + 数据库 db + 管理 UI adminer
```

- 前端：**http://127.0.0.1:5173**（请显式用 IPv4 地址；compose 已按 `127.0.0.1:5173:5173` 仅发布 IPv4，避免 Docker Desktop 的 IPv6 中继卡死导致 `localhost` 解析到 `::1` 后 60s 超时）
- PostgreSQL：**127.0.0.1:5432**（库/用户/口令见 `.env`，默认 `runsun/runsun/runsun`）
- Adminer（数据库管理）：**http://127.0.0.1:8081**
- 数据落盘：`./docker/postgres/data`（已 gitignore，销毁用 `docker compose down -v`）
- 初始化：`docker/postgres/init/*.sql` 在首次启动时被挂载到 `/docker-entrypoint-initdb.d` 自动执行

### ⚠️ 容器出网代理（务必注意）

前端容器启动时会执行 `pnpm install` 拉取 npm 包。若宿主网络需经代理访问外网（本机即如此），**容器默认不会自动走代理**，会卡在 `pnpm install` 导致**前端容器退出、`localhost:5173` 无法访问**。

- 代理已在 `docker-compose.yml` 的 `frontend.environment` 中配置，指向宿主代理 `host.docker.internal:<端口>`（容器内解析到宿主网关）。
- 端口取自 `.env` 的 `COMPOSE_HTTP_PROXY` / `COMPOSE_HTTPS_PROXY`。
- **宿主代理端口会随代理工具变动**（例如本机曾为 `62294`，现为 `56847`）。查看：

  ```bash
  echo $HTTP_PROXY   # 或 echo $env:HTTP_PROXY
  ```

- 端口变动后同步修改 `.env` 中这两个值，再 `docker compose up -d frontend` 生效。
- **已内置降级策略**：容器 entrypoint 先按代理安装 → 失败则尝试直连 → 仍失败则改用卷内已有 `node_modules` 启动，避免 Vite 完全不可用（日志会打印提示）。
- 说明：Docker daemon 自身的镜像拉取代理（`http.docker.internal:3128`）由 Docker Desktop 自动注入，与容器内出网代理是两回事。
- **文件监听（HMR）**：Docker Desktop（Windows）的 bind mount 不向容器传播 inotify 事件。`vite.config.ts` 的 `server.watch` **已禁用 `usePolling`**（轮询会对 `/app` 全量 stat，项目根曾残留 231MB `.pnpm-store` 时把 gRPC-FUSE 打满返回 EIO，Vite 反复崩溃）。现状：容器内 HMR 不生效，**修改源码后需 `docker compose up -d --force-recreate frontend`** 重建前端容器，浏览器刷新后才会拿到新代码。

## 环境变量（ARCH §12.7，构建期注入，仅 `VITE_*` 进前端产物）

| 变量 | 默认 | 说明 |
|------|------|------|
| `VITE_ENABLE_MOCK` | `true` | 是否启用 MSW 拦截 `/api/*` |
| `VITE_API_BASE_URL` | `http://localhost:8080` | Mock 关闭时的真实后端网关 |
| `VITE_DEFAULT_REGION` | `jp` | 默认区域（jp/th/sg/us） |
| `VITE_THEME_DEFAULT` | `light` | 默认主题 |
| `VITE_MOCK_SEED` | `20261017` | Mock 固定种子（保证 fixture 可复现） |
| `VITE_FEATURE_STATUS_BAR` / `VITE_FEATURE_TOPOLOGY` | `true` | 状态栏 / 拓扑图开关 |
| `VITE_LOW_BALANCE_THRESHOLD_USD` | `50` | 低余额阈值（前端兜底） |
| `COMPOSE_HTTP_PROXY` / `COMPOSE_HTTPS_PROXY` | `http://host.docker.internal:56847` | 容器内出网代理（须与宿主代理端口一致） |

## 数据库底座说明（ARCH §12）

- `01-schema.sql`：按依赖顺序建表 —— identity → supply → deployment → billing → content（当前共 33 张表）。
- `02-seed.sql`：套餐（3 档）、节点池（5 类）、示例 org/user/project。
- **边界（§12.8）**：GPU 利用率 / 显存 / 延迟等高频时序指标**不落 PG**，由时序库或 Mock 提供；PG 仅存业务实体与计费聚合量。

## 设计文档

- 需求：`PRD.md` · 架构：`ARCHITECTURE.md` · UI 规范：`DESIGN-SYSTEM.md`
- Mock 契约：`MOCK-DATA.md` · 评审：`REVIEW.md`
