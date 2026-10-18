# ARCHITECTURE — RunSun GPU Cloud 控制台（前端架构）

> 文档类型：架构说明（前端为主；后端为蓝图，不在本次实现）
> 版本：**v0.2 · 草稿（评审修订版）**
> 关联文档：`PRD.md`（需求）、`DESIGN-SYSTEM.md`（UI 规范）、`REVIEW.md`（评审报告）

---

## 1. 技术约束总览

| 维度     | 约束                                                  |
| ------ | --------------------------------------------------- |
| 前端框架   | **React 19**（并发特性、Actions、`use()`）                  |
| 语言     | **TypeScript 5**（strict 模式，禁止 `any` 泄露到领域层）          |
| 本次范围   | **仅前端展示**；数据全部来自 Mock 层                             |
| 未来后端存储 | 约定使用 **PostgreSQL 15+（pg）**（仅蓝图，见 §12）              |
| 包管理    | pnpm                                                |
| 构建     | Vite 6                                              |
| 代码质量   | ESLint + Prettier + Stylelint                       |

---

## 2. 前端技术栈

| 关注点  | 选型                                  | 理由                                  |
| ---- | ----------------------------------- | ----------------------------------- |
| 路由   | React Router 7（数据路由）                | 嵌套路由、懒加载、loader 适配 Mock             |
| 状态管理 | Zustand（全局轻量）+ TanStack Query（服务端态） | 避免 Redux 样板；Query 层天然适配 Mock/真实 API |
| 数据Mock | MSW（Mock Service Worker）          | 拦截 fetch，契约即文档；切换开关见 §12.7         |
| UI基础 | Radix UI 原语 + 自研组件                  | 无障碍优先，可控主题                          |
| 样式   | CSS Modules + Design Token（CSS 变量）   | 主题切换靠变量                             |
| 表格   | TanStack Table                      | 复杂筛选/排序/虚拟滚动（Vast.ai 风格）           |
| 图表   | Recharts（常规）+ visx（拓扑/机架定制）         | 定制能力与效率平衡                           |
| 表单   | React Hook Form + Zod               | 部署向导分步校验；Zod 同时约束 `spec_json`（§12.9） |
| 国际化  | i18next + react-i18next             | zh-CN 默认，预留 en-US                   |
| 命令面板 | cmdk                                | ⌘K 快捷操作                             |
| 实时数据 | Mock WebSocket（或轮询）                 | 利用率、goodput、节点状态流（端点由 §12.7 配置）     |

---

## 3. 目录结构

```
src/
├─ app/
│  ├─ router.tsx              # 路由表（含 RBAC 守卫）
│  ├─ layouts/                # 控制台骨架（Sidebar + Topbar + StatusBar + Outlet）
│  └─ providers.tsx           # Query / i18n / Theme / MSW 初始化（受 VITE_ENABLE_MOCK 控制）
├─ features/                  # 按业务域切分（与 PRD §2 导航一一对应）
│  ├─ overview/
│  ├─ deployment/             # 创建入口：server / baremetal / vgpu / inference 向导
│  ├─ resources/              # 展示菜单：by-type(server/baremetal/vgpu/inference)
│  ├─ cluster/                # 节点池 / 节点 / 拓扑 / 事件（辅助层）
│  ├─ development/            # notebook / images / app-templates（工具链，辅助层）
│  ├─ data/
│  ├─ operations/             # monitoring / logs / cost / quotas / tickets
│  ├─ model-library/
│  └─ assets/
├─ components/
│  ├─ ui/                     # Button/Card/Table/Tabs/Badge/Modal...
│  ├─ charts/                 # GPU 利用率 / goodput / 拓扑图
│  └─ state-machine/          # 节点状态机 & 资源生命周期可视化
├─ stores/                    # Zustand：auth / region / theme / project / billing
├─ mocks/                     # MSW handlers + fixtures + 契约 schema
│  ├─ handlers/               # 各域接口拦截
│  ├─ fixtures/               # 种子数据（与 §12 DDL 同构）
│  └─ schema/                 # Zod/TS 类型化契约（含 ResourceId/DisplayId 品牌类型）
├─ lib/                       # api-client / date / money / rbac / ids
├─ types/                     # 全局领域类型
├─ tokens/                    # 设计 Token（亮/暗）
└─ styles/                    # 全局样式、reset、主题变量注入
```

---

## 4. 路由与权限模型

### 4.1 路由表（节选，详情路由参数统一为 `resourceUuid`）

```
/overview
/deployment/server               /deployment/baremetal
/deployment/vgpu                 /deployment/inference          （创建向导，4 类）
/resources/servers               /resources/servers/:resourceUuid
/resources/baremetal             /resources/baremetal/:resourceUuid
/resources/vgpu                  /resources/vgpu/:resourceUuid
/resources/inference             /resources/inference/:resourceUuid
/cluster/pools                   /cluster/nodes        /cluster/topology   /cluster/events
/development/notebooks           /development/images   /development/apps
/data/datasets                   /data/storage         /data/pipelines
/operations/monitoring           /operations/logs      /operations/cost
/operations/quotas               /operations/tickets
/model-library
/assets/compute                  /assets/vouchers      /assets/reserved    /assets/storage
```

- `routeKey ↔ kind ↔ display_id 前缀` 的唯一映射见 **§12.6**（组件不得自定义第二套）。

### 4.2 前端 RBAC（仅控制可见性，非安全边界）

> 角色枚举以 **§12.1 `user_role`** 为准，`lib/rbac.ts` 直接消费该联合类型，避免第二套命名。

| 角色（`user_role`） | 可见/可操作                                        |
| ---------------- | --------------------------------------------- |
| `owner`          | 全部（含计费主体、成员管理、删除资源）                           |
| `admin`          | 除计费主体外的全部 + 用户/配额/工单管理                        |
| `member`         | 部署中心、资源（创建/启停/扩缩/控制台）、开发、数据、监控               |
| `billing`        | 资产、成本分析、发票、代金券/预留；资源**只读**（不可删除/启停）           |
| `viewer`         | 全部页面**只读**                                   |

危险操作（删除 / 扩缩 / cordon / drain / 发票作废）由 `lib/rbac.ts` 计算可见性与禁用态。

---

## 5. 状态管理层

- **全局 Store（Zustand）**：
  - `auth`：**用户（uuid/role）+ 当前 org + 当前 project**（对应 §12.1）。
  - `region`：`jp|th|sg|us`，驱动列表过滤与 Query key。
  - `theme`：light/dark → `data-theme`。
  - `billing`：余额与本月花费（来源 §12.4 表，Mock 由 `mocks/fixtures` 提供）。
- **服务端状态（TanStack Query）**：key 含 `region` + `routeKey`，多区域缓存隔离。
- **资源生命周期**：`provisioning → running | stopped | error → terminating → deleted_at`（PRD §5.4），与计量严格挂钩（PRD §7.4）。
- **节点状态机**：见 §9，UI 仅渲染派生态。

---

## 6. Mock 数据层与契约

- MSW 拦截 `/api/*`，返回 `mocks/fixtures` 种子数据；开关为 `VITE_ENABLE_MOCK`（§12.7）。
- 契约以 **TypeScript 类型 + Zod** 定义于 `mocks/schema`；**类型必须与 §12 DDL 同构**，降低联调成本。
- 关键实体（对应 §12 表）：
  - `Plan / Org / User / Project`：身份与计费主体。
  - `NodePool / GpuNode / NodeEvent`：供给侧（`gpu_nodes.state` ∈ 5 态）。
  - `Resource`（含 `kind` / `status` / `resourceUuid` / `display_id` / `spec_json`）：四类统一实体。
  - `DeploymentOrder / ResourcePlacement / ResourceEvent / ProvisioningStep`：资源映射与工作项。
  - `Invoice / BillingUsage / Transaction / Voucher / Reservation / Quota`：计费。
  - `Model / Image / AppTemplate / Notebook / Dataset / Ticket / Notification`：内容与支撑。
- **ID 契约**：`resourceUuid` 与 `display_id` 用 TS **品牌类型**（`type ResourceUuid = string & {__brand}`）区分，禁止混用（PRD §5.5）。
- **数值真实性约束（强制）**：Mock 数据受 `MOCK-DATA.md` 全文约束，要点：
  - **G1 真实量级**：硬件规格、价格、单位、阈值一律以 `MOCK-DATA.md` §3 / §4 / §6 为唯一口径，禁止自造失真数值。
  - **G2 派生优先**：金额、吞吐、KV cache、goodput、供给时长等能算的量不得硬编码，统一走 `mocks/lib/derive.ts`（对应 `MOCK-DATA.md` §7）。
  - **G4 状态自洽**：`provisioning` 无运行时指标；`stopped` 指标为 `null`（非 0）；无数据用 `null` 且图表断点，禁止填 0。
  - **G5 确定性**：固定种子 `VITE_MOCK_SEED`，同 nodeUuid/同窗口多次刷新序列一致；`Math.random()` 禁止用于初始值。
  - **G8 红旗**：见 `MOCK-DATA.md` §1 G8 清单，开发态由 `mocks/lib/consistency.ts` 运行时断言拦截。
- **指标与业务实体分离**：§6 全部时序指标走 `/api/metrics/*` 契约，**不得混入业务实体接口**（与 §12.8 边界一致）。

---

## 7. 组件分层

1. **Primitives（ui/）**：Button、Card、Input、Select、Tabs、Badge、StatusDot、Modal、Drawer、Toast、Table、Tooltip。
2. **Domain Blocks（components/）**：ResourceCard（RunPod 风选购卡）、FilterBar（Vast.ai 风）、DeployWizard、ConsolePanel（AutoDL 风）、TopologyGraph、StateMachineBadge、**LifecycleBadge**（资源生命周期 6 态）、**StatusBar**（§12.7 可开关）。
3. **Layouts**：Sidebar + Topbar + StatusBar + Outlet。
4. **Pages（features/）**：组合上述组件，绑定 Query/Store。

---

## 8. 可视化与实时数据

- **GPU 利用率 / goodput**：Recharts 面积/折线 + 实时追加（Mock WS 每 2–5s；WS 端点由 `VITE_WS_URL` 配置）。
- **节点状态占比**：环形图（5 态配色见 DESIGN-SYSTEM §8）。
- **机架拓扑**：visx 节点-连线图，表达 rack → switch → node 与 NVL72 互联。
- **straggler 标记**：节点列表警示徽标，联动 `Remediation`。

**单位与阈值规范（避免 UI 自造）**

- 单位、小数位、降采样规则统一见 `MOCK-DATA.md` §6.0（15s 原始采样；近 1h/6h/24h/7d 分别降采样到 15s/1min/5min/1h；利用率取均值、延迟取 P50–P99）。
- **告警阈值与方法必须由后端/阈下发**（Mock 期放 `fixtures/thresholds.ts`），组件只读消费，**禁止在组件内硬编码数字比较**。
- 无数据统一渲染断点而非 0 线；Y 轴不得因单点毛刺无限放大，须按指标约定量程（利用率固定 0–100%）。

> **边界声明（重要）**：GPU 利用率、goodput、QPS、延迟等**时序指标不落 PostgreSQL**，由时序库或 Mock 提供；§12 的 PG 表只存**业务实体与计费聚合量**，不存高频采样点。指标字典与真实值口径详见 `MOCK-DATA.md` §6，切换真实 API 的隔离约定见 `MOCK-DATA.md` §11。

---

## 9. 状态机实现约定（节点 5 态 + 资源生命周期）

```text
# 节点（gpu_nodes.state）
states: Ready | Cordoned | Draining | Remediation | NotReady
events: CORDON, UNCORDON, DRAIN, EVICTED, FAIL, REMEDIATE, FIXED, REJOIN
transitions:
  Ready      --CORDON-->   Cordoned
  Cordoned   --UNCORDON--> Ready
  Cordoned   --DRAIN-->    Draining
  Draining   --EVICTED-->  NotReady
  Ready      --FAIL-->     NotReady
  NotReady   --REMEDIATE-> Remediation
  Remediation--FIXED-->    Ready
  NotReady   --REJOIN-->   Ready
  Any        --FAIL-->     NotReady

# 资源（resources.status）——闭环
states: Provisioning | Running | Stopped | Error | Terminating (+ deleted_at 软删终态)
events: READY, FAIL, STOP, START, TERMINATE, RETRY, RECYCLED
transitions:
  Provisioning --READY-->     Running        (置 running_since，起算算力费)
  Provisioning --FAIL-->      Error
  Error        --RETRY-->     Provisioning   (复用同一 order，幂等)
  Running      --STOP-->      Stopped        (算力停计，保留存储)
  Stopped      --START-->     Running
  Running      --TERMINATE--> Terminating
  Stopped      --TERMINATE--> Terminating
  Error        --TERMINATE--> Terminating
  Terminating  --RECYCLED-->  deleted_at 非空（终态）
```

`StateMachineBadge` / `LifecycleBadge` 依据 state 渲染"颜色 + 图标 + 文本"（满足可访问性）。

---

## 10. 主题与 Design System 集成

- 视觉属性全部来自 `tokens/`，以 CSS 变量注入 `:root` 与 `[data-theme="dark"]`。
- 组件不得硬编码色值，统一 `var(--rs-*)`；Token 与组件规范见 `DESIGN-SYSTEM.md`。

---

## 11. 构建与部署（前端）

- `vite build` 产出静态资源；对象存储 + CDN 托管（SPA 回退 index.html）。
- CI：lint → typecheck → build → 预览；本地 `vite dev` 可运行完整原型（含 MSW）。
- **环境变量注入时机**：构建期注入 `VITE_*`，运行期只读（见 §12.7）。

---

## 12. 后端蓝图（仅供设计参考，本次不实现）

> 声明：本节 DDL **不在本次交付范围**，仅用于前端契约对齐。脚本为 PostgreSQL 15+ 可建表语句，字段与关系对应 PRD §6.5 / §7；**前端 Mock 实体须与之同构**。
> 修订要点：拆除订单↔资源**循环外键**、补齐生命周期终态、统一 ID/枚举命名、补齐资产/配额/工单/通知/事件等被 UI 引用但此前无模型的实体。
>
> **建表顺序（重要）**：`resource_placements.node_id` 外键指向 `gpu_nodes`，故实际执行顺序应为：**§12.1 identity → §12.3 supply → §12.2 deployment → §12.4 billing → §12.5 content**。本节按"业务叙事"编排，落库时请按上述依赖顺序执行。

### 12.1 identity — 用户与组织（用户表结构）

```sql
-- ===== 枚举 =====
CREATE TYPE user_status AS ENUM ('active','suspended','pending','deleted');
CREATE TYPE user_role   AS ENUM ('owner','admin','member','billing','viewer');
CREATE TYPE project_role AS ENUM ('admin','member','viewer');

-- 套餐（PLAN）
CREATE TABLE plans (
  code              VARCHAR(32) PRIMARY KEY,        -- free / standard / enterprise
  name              VARCHAR(64)  NOT NULL,
  free_credit_usd   NUMERIC(12,2) NOT NULL DEFAULT 0,   -- 首次注册赠送（一次性）
  max_members       INT          NOT NULL DEFAULT 20,
  support_level     VARCHAR(32)  NOT NULL DEFAULT 'community',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 组织 / 租户（计费与配额主体）
CREATE TABLE orgs (
  id                 BIGSERIAL PRIMARY KEY,
  name               VARCHAR(128) NOT NULL,
  slug               VARCHAR(64)  NOT NULL UNIQUE,
  plan_code          VARCHAR(32)  NOT NULL REFERENCES plans(code) ON UPDATE CASCADE,
  credit_balance     NUMERIC(14,2) NOT NULL DEFAULT 0,        -- 账户余额（USD）
  currency           CHAR(3)      NOT NULL DEFAULT 'USD',     -- 计价币种，v1 固定 USD
  low_balance_threshold_usd NUMERIC(12,2) NOT NULL DEFAULT 50.00,
  status             VARCHAR(16)  NOT NULL DEFAULT 'active',
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_orgs_slug ON orgs(slug);

-- 用户 / 账号
CREATE TABLE users (
  id                BIGSERIAL PRIMARY KEY,
  uuid              UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  org_id            BIGINT       NOT NULL REFERENCES orgs(id) ON DELETE RESTRICT,
  email             VARCHAR(255) NOT NULL UNIQUE,
  display_name      VARCHAR(128) NOT NULL,
  status            user_status  NOT NULL DEFAULT 'active',
  role              user_role    NOT NULL DEFAULT 'member',
  identity_provider VARCHAR(32),                                -- local/google/github/saml
  mfa_enabled       BOOLEAN      NOT NULL DEFAULT false,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_users_org   ON users(org_id);
CREATE INDEX idx_users_email ON users(email);

-- 项目（Project：成本归集与切换维度）
CREATE TABLE projects (
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT      NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name       VARCHAR(128) NOT NULL,
  slug       VARCHAR(64)  NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE TABLE project_members (
  project_id BIGINT       NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    BIGINT       NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  role       project_role NOT NULL DEFAULT 'member',
  PRIMARY KEY (project_id, user_id)
);
```

### 12.2 deployment — 资源映射（资源映射相关表结构）

> 对应 PRD §5：下单 → 映射为四类之一 → 落到节点池/节点 → 呈现于「资源」菜单。

```sql
-- ===== 枚举 =====
CREATE TYPE region_code     AS ENUM ('jp','th','sg','us');
CREATE TYPE node_pool_code  AS ENUM ('H100_SXM','H200_NVL','B200_NVL72','B300','GB300_NVL72');
CREATE TYPE resource_kind   AS ENUM ('gpu_vm','gpu_baremetal','vgpu','inference');
CREATE TYPE resource_status AS ENUM ('provisioning','running','stopped','error','terminating');
CREATE TYPE order_status    AS ENUM ('pending','provisioning','fulfilled','failed');
CREATE TYPE source_type     AS ENUM ('direct','image','model','template','notebook');
CREATE TYPE step_state      AS ENUM ('pending','running','done','failed','skipped');
CREATE TYPE event_level     AS ENUM ('info','warning','error','success');

-- 部署中心：创建订单（即"工作项"，status 为任务状态）
CREATE TABLE deployment_orders (
  id               BIGSERIAL PRIMARY KEY,
  order_uuid       UUID          NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  org_id           BIGINT        NOT NULL REFERENCES orgs(id),
  owner_id         BIGINT        NOT NULL REFERENCES users(id),
  project_id       BIGINT        REFERENCES projects(id),
  resource_kind    resource_kind NOT NULL,
  requested_spec   JSONB         NOT NULL,          -- 请求规格（用户所选）
  region           region_code   NOT NULL,
  node_pool        node_pool_code,
  source_type      source_type   NOT NULL DEFAULT 'direct',
  source_ref_id    BIGINT,                          -- images.id / models.id / app_templates.id / notebooks.id
  price_snapshot   NUMERIC(14,4),                   -- 下单时预估单价（$/GPU·h）
  status           order_status  NOT NULL DEFAULT 'pending',
  failure_reason   TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_org ON deployment_orders(org_id, status);

-- 资源实例主表（映射后呈现于「资源」菜单）
CREATE TABLE resources (
  id             BIGSERIAL PRIMARY KEY,
  resource_uuid  UUID          NOT NULL UNIQUE DEFAULT gen_random_uuid(),   -- 对外/路由
  display_id     VARCHAR(32)   NOT NULL UNIQUE,                             -- UI 短码 srv-a1b2c3
  org_id         BIGINT        NOT NULL REFERENCES orgs(id),
  owner_id       BIGINT        NOT NULL REFERENCES users(id),
  project_id     BIGINT        REFERENCES projects(id),
  order_id       BIGINT        REFERENCES deployment_orders(id),            -- 唯一来源（单向，避免循环）
  kind           resource_kind NOT NULL,
  name           VARCHAR(128)  NOT NULL,
  region         region_code   NOT NULL,
  node_pool      node_pool_code NOT NULL,          -- 主节点池
  spec_json      JSONB         NOT NULL,           -- 实际供给规格（契约见 §12.9）
  gpu_count      INT           NOT NULL DEFAULT 0,
  storage_gb     NUMERIC(12,2) NOT NULL DEFAULT 0,
  status         resource_status NOT NULL DEFAULT 'provisioning',
  running_since  TIMESTAMPTZ,                      -- 算力计费起算点
  stopped_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ                       -- 软删终态
);
CREATE INDEX idx_resources_org_kind ON resources(org_id, kind);
CREATE INDEX idx_resources_status   ON resources(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_resources_order    ON resources(order_id);

-- 资源 ↔ 节点供给映射（实际落位）
CREATE TABLE resource_placements (
  id           BIGSERIAL PRIMARY KEY,
  resource_id  BIGINT         NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  node_pool    node_pool_code NOT NULL,            -- 实际落位节点池（与主 node_pool 可不同：多节点场景）
  node_id      BIGINT         REFERENCES gpu_nodes(id),   -- 实际节点
  rack_id      VARCHAR(64),
  gpu_indices  INT[],                              -- 占用的 GPU 卡序号
  assigned_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_placements_resource ON resource_placements(resource_id);

-- 资源事件（详情页"事件时间线"数据源）
CREATE TABLE resource_events (
  id          BIGSERIAL PRIMARY KEY,
  resource_id BIGINT      NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  org_id      BIGINT      NOT NULL REFERENCES orgs(id),
  type        VARCHAR(48) NOT NULL,                -- created/provisioned/started/stopped/error...
  level       event_level NOT NULL DEFAULT 'info',
  message     TEXT        NOT NULL,
  actor_user_id BIGINT    REFERENCES users(id),    -- 人/系统触发者
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_res_events ON resource_events(resource_id, created_at DESC);

-- 供给子任务（Provisioning 进度步骤数据源）
CREATE TABLE resource_provisioning_steps (
  id          BIGSERIAL PRIMARY KEY,
  resource_id BIGINT     NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  seq         SMALLINT   NOT NULL,
  step_key    VARCHAR(48) NOT NULL,                -- schedule/provision/pull_image/attach_storage/ready
  state       step_state NOT NULL DEFAULT 'pending',
  message     TEXT,
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  UNIQUE (resource_id, step_key)
);
```

> **循环外键已拆除（评审修订）**：旧版 `deployment_orders.resulting_resource_id ↔ resources.order_id` 双向引用会造成插入时序死锁且两份关系可能不一致。现仅保留 **单向** `resources.order_id`；"某订单产出了什么资源"通过 `WHERE order_id = ?` 查询获得。

### 12.3 supply — 供给侧（集群模块）

> 旧版 `resource_placements.node_id` 指向了**不存在的节点实体**；现补齐 `node_pools` / `gpu_nodes` / `node_events`。

```sql
CREATE TYPE node_state AS ENUM ('ready','cordoned','draining','remediation','notready');

CREATE TABLE node_pools (
  code            node_pool_code PRIMARY KEY,
  display_name    VARCHAR(32)  NOT NULL,           -- H100 SXM / H200 NVL ...
  gpu_model       VARCHAR(32)  NOT NULL,
  gpus_per_node   INT          NOT NULL DEFAULT 8,
  vram_gb         INT          NOT NULL,
  interconnect    VARCHAR(32),                     -- NVLink / NVL72 / IB
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE gpu_nodes (
  id            BIGSERIAL PRIMARY KEY,
  node_uid      VARCHAR(64)  NOT NULL UNIQUE,
  pool_code     node_pool_code NOT NULL REFERENCES node_pools(code),
  region        region_code  NOT NULL,
  rack_id       VARCHAR(64),
  switch_group  VARCHAR(64),
  gpu_count     INT          NOT NULL DEFAULT 0,
  state         node_state   NOT NULL DEFAULT 'ready',
  straggler     BOOLEAN      NOT NULL DEFAULT false,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_nodes_pool_region ON gpu_nodes(pool_code, region);
CREATE INDEX idx_nodes_state       ON gpu_nodes(state);

CREATE TABLE node_events (
  id            BIGSERIAL PRIMARY KEY,
  node_id       BIGINT      NOT NULL REFERENCES gpu_nodes(id) ON DELETE CASCADE,
  type          VARCHAR(48) NOT NULL,              -- cordon/uncordon/drain/evicted/fail/remediate/fixed/rejoin
  level         event_level NOT NULL DEFAULT 'info',
  message       TEXT,
  actor_user_id BIGINT      REFERENCES users(id),  -- 运维操作者（可空=系统自动）
  payload       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_node_events ON node_events(node_id, created_at DESC);
```

### 12.4 billing — 计费与资产（billing 表结构）

> 对应 PRD §7：按 GPU·小时统一计量、实时客帐扣费 + 月结对账单、代金券/预留/配额落库。

```sql
-- ===== 枚举 =====
CREATE TYPE rate_unit         AS ENUM ('per_gpu_hour','per_gb_hour','per_instance_hour');
CREATE TYPE invoice_status    AS ENUM ('open','paid','overdue','void');
CREATE TYPE txn_type          AS ENUM ('charge','refund','credit','adjustment');
CREATE TYPE voucher_status    AS ENUM ('unused','partial','used','expired','void');
CREATE TYPE reservation_status AS ENUM ('scheduled','active','expired','cancelled','refunded');
CREATE TYPE quota_metric      AS ENUM ('gpu','vcpu','storage_gb','public_ip');

-- 单价表（资源类型 × 节点池 × 区域 × 单位 × 有效期）
CREATE TABLE billing_rates (
  id            BIGSERIAL PRIMARY KEY,
  resource_kind resource_kind NOT NULL,
  node_pool     node_pool_code NOT NULL,
  region        region_code   NOT NULL,
  unit          rate_unit     NOT NULL,
  price         NUMERIC(10,4) NOT NULL,           -- 单价（USD）
  currency      CHAR(3)       NOT NULL DEFAULT 'USD',
  effective_from DATE         NOT NULL,
  effective_to   DATE,                            -- 空=当前有效
  UNIQUE (resource_kind, node_pool, region, unit, effective_from)
);

-- 用量 / 计费事件（按小时聚合）
CREATE TABLE billing_usage (
  id             BIGSERIAL PRIMARY KEY,
  org_id         BIGINT        NOT NULL REFERENCES orgs(id),
  project_id     BIGINT        REFERENCES projects(id),
  resource_id    BIGINT        NOT NULL REFERENCES resources(id),
  resource_kind  resource_kind NOT NULL,
  node_pool      node_pool_code NOT NULL,
  region         region_code   NOT NULL,
  unit           rate_unit     NOT NULL,
  quantity       NUMERIC(12,4) NOT NULL,          -- GPU·h / GB·h
  unit_price     NUMERIC(10,4) NOT NULL,          -- 定价时快照
  amount         NUMERIC(14,4) NOT NULL,          -- 不可变金额快照
  billing_period DATE          NOT NULL,          -- 账期 yyyy-mm-01
  usage_hour     TIMESTAMPTZ   NOT NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (resource_id, usage_hour, unit)          -- 幂等防重复计量
);
CREATE INDEX idx_usage_org_period ON billing_usage(org_id, billing_period);
CREATE INDEX idx_usage_resource   ON billing_usage(resource_id);

-- 发票 / 月结对账单（凭证，不是二次扣费）
CREATE TABLE invoices (
  id             BIGSERIAL PRIMARY KEY,
  invoice_uuid   UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  org_id         BIGINT       NOT NULL REFERENCES orgs(id),
  billing_period DATE         NOT NULL,
  subtotal       NUMERIC(14,2) NOT NULL,
  tax            NUMERIC(14,2) NOT NULL DEFAULT 0,
  total          NUMERIC(14,2) NOT NULL,
  currency       CHAR(3)      NOT NULL DEFAULT 'USD',
  status         invoice_status NOT NULL DEFAULT 'open',
  due_at         TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_org_period ON invoices(org_id, billing_period);

-- 账户交易流水（实时客帐：正=入账，负=扣费）
CREATE TABLE billing_transactions (
  id             BIGSERIAL PRIMARY KEY,
  org_id         BIGINT       NOT NULL REFERENCES orgs(id),
  type           txn_type     NOT NULL,
  amount         NUMERIC(14,2) NOT NULL,
  currency       CHAR(3)      NOT NULL DEFAULT 'USD',
  balance_after  NUMERIC(14,2) NOT NULL,
  reference_type VARCHAR(32),                     -- invoice/usage/plan_signup/refund/manual/voucher/reservation
  reference_id   BIGINT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_org ON billing_transactions(org_id, created_at DESC);

-- 代金券（资产·代金券）
CREATE TABLE vouchers (
  id             BIGSERIAL PRIMARY KEY,
  org_id         BIGINT      NOT NULL REFERENCES orgs(id),
  code           VARCHAR(48) NOT NULL UNIQUE,
  amount         NUMERIC(12,2) NOT NULL,
  balance        NUMERIC(12,2) NOT NULL,
  currency      CHAR(3)      NOT NULL DEFAULT 'USD',
  applicable_kind  resource_kind,                 -- 空=不限类型
  applicable_region region_code,                  -- 空=不限区域
  status         voucher_status NOT NULL DEFAULT 'unused',
  valid_from     TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to       TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE voucher_redemptions (
  id          BIGSERIAL PRIMARY KEY,
  voucher_id  BIGINT       NOT NULL REFERENCES vouchers(id),
  invoice_id  BIGINT       REFERENCES invoices(id),
  amount      NUMERIC(12,2) NOT NULL,
  applied_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_redemptions_voucher ON voucher_redemptions(voucher_id);

-- 预留实例（资产·预留实例 / 计算资产）
CREATE TABLE reservations (
  id             BIGSERIAL PRIMARY KEY,
  org_id         BIGINT        NOT NULL REFERENCES orgs(id),
  node_pool      node_pool_code NOT NULL,
  region         region_code   NOT NULL,
  gpu_count      INT           NOT NULL,
  committed_price_per_gpu_hour NUMERIC(10,4) NOT NULL,
  start_at       TIMESTAMPTZ   NOT NULL,
  end_at         TIMESTAMPTZ   NOT NULL,
  status         reservation_status NOT NULL DEFAULT 'scheduled',
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_reservations_org ON reservations(org_id, status);

-- 存储包（资产·存储包）
CREATE TABLE storage_packs (
  id           BIGSERIAL PRIMARY KEY,
  org_id       BIGINT       NOT NULL REFERENCES orgs(id),
  size_gb      NUMERIC(12,2) NOT NULL,
  remaining_gb NUMERIC(12,2) NOT NULL,
  valid_from   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  valid_to     TIMESTAMPTZ  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 配额（运营·配额；resource_kind/region 为 NULL 表示不限该维度）
CREATE TABLE quotas (
  id            BIGSERIAL PRIMARY KEY,
  org_id        BIGINT      NOT NULL REFERENCES orgs(id),
  resource_kind resource_kind,
  region        region_code,
  metric        quota_metric NOT NULL,
  limit_value   NUMERIC(14,2) NOT NULL,
  used_value    NUMERIC(14,2) NOT NULL DEFAULT 0,   -- 派生值，定时重算
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, resource_kind, region, metric)
);
```

> **余额一致性**：每小时用量聚合后在同一事务内生成 `billing_transactions(type='charge')` 并更新 `orgs.credit_balance`；低于 `low_balance_threshold_usd` 由 billing 服务写 `notifications` 告警（联动 PRD §3.2 状态栏）。

### 12.5 content / 支撑实体（模型库、商城、数据、工单、通知）

> 补齐"被 UI 引用但此前无数据模型"的实体，使来源追溯与工单关联可落地。

```sql
-- 模型库
CREATE TABLE models (
  id           BIGSERIAL PRIMARY KEY,
  slug         VARCHAR(128) NOT NULL UNIQUE,
  name         VARCHAR(160) NOT NULL,
  source       VARCHAR(32)  NOT NULL,             -- hf_mirror/official/community
  modality     VARCHAR(32),                        -- llm/diffusion/embedding...
  param_size   VARCHAR(16),                        -- 7B/70B...
  license      VARCHAR(64),
  quantization VARCHAR(32),
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE model_favorites (
  user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_id BIGINT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, model_id)
);

-- 镜像商城
CREATE TABLE images (
  id            BIGSERIAL PRIMARY KEY,
  name          VARCHAR(128) NOT NULL,
  registry      VARCHAR(255) NOT NULL,
  tag           VARCHAR(64)  NOT NULL,
  framework     VARCHAR(64),                       -- pytorch/tensorflow...
  cuda_version  VARCHAR(32),
  size_gb       NUMERIC(10,2),
  is_official   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI 应用模板
CREATE TABLE app_templates (
  id          BIGSERIAL PRIMARY KEY,
  slug        VARCHAR(128) NOT NULL UNIQUE,
  name        VARCHAR(160) NOT NULL,
  category    VARCHAR(64),                         -- chatbot/embedding/comfyui...
  default_image_id BIGINT REFERENCES images(id),
  form_schema JSONB       NOT NULL DEFAULT '{}',   -- 表单化参数
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notebook（开发模块；挂靠到已有资源，不产生资源实例）
CREATE TABLE notebooks (
  id          BIGSERIAL PRIMARY KEY,
  org_id      BIGINT      NOT NULL REFERENCES orgs(id),
  user_id     BIGINT      NOT NULL REFERENCES users(id),
  resource_id BIGINT      REFERENCES resources(id) ON DELETE SET NULL,
  type        VARCHAR(16) NOT NULL DEFAULT 'jupyter',  -- jupyter/vscode
  status      VARCHAR(16) NOT NULL DEFAULT 'running',
  url_path    VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 数据模块（最小集）
CREATE TABLE datasets (
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT      NOT NULL REFERENCES orgs(id),
  name       VARCHAR(160) NOT NULL,
  version    VARCHAR(32) NOT NULL DEFAULT 'v1',
  size_gb    NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE buckets (
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT      NOT NULL REFERENCES orgs(id),
  name       VARCHAR(128) NOT NULL,
  region     region_code NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE TABLE objects (
  id         BIGSERIAL PRIMARY KEY,
  bucket_id  BIGINT      NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
  key        VARCHAR(512) NOT NULL,
  size_bytes BIGINT      NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pipelines (
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT      NOT NULL REFERENCES orgs(id),
  name       VARCHAR(160) NOT NULL,
  dag_json   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 工单（运营·工单；可关联资源）
CREATE TYPE ticket_status   AS ENUM ('open','pending','resolved','closed');
CREATE TYPE ticket_priority AS ENUM ('low','normal','high','urgent');

CREATE TABLE tickets (
  id          BIGSERIAL PRIMARY KEY,
  org_id      BIGINT      NOT NULL REFERENCES orgs(id),
  user_id     BIGINT      NOT NULL REFERENCES users(id),
  resource_id BIGINT      REFERENCES resources(id) ON DELETE SET NULL,
  subject     VARCHAR(200) NOT NULL,
  description TEXT,
  status      ticket_status   NOT NULL DEFAULT 'open',
  priority    ticket_priority NOT NULL DEFAULT 'normal',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_org ON tickets(org_id, status);

-- 通知中心
CREATE TABLE notifications (
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT      NOT NULL REFERENCES orgs(id),
  user_id    BIGINT      REFERENCES users(id),     -- 空=组织级广播
  type       VARCHAR(48) NOT NULL,                 -- node_notready/task_failed/balance_alert...
  level      event_level NOT NULL DEFAULT 'info',
  title      VARCHAR(200) NOT NULL,
  body       TEXT,
  link       VARCHAR(255),
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_org_user ON notifications(org_id, user_id, read_at);
```

### 12.6 统一枚举与命名映射（单一事实来源，强制）

> 组件/路由/Mock 必须引用下表同一份常量，禁止自定义第二套（来源：PRD §5.2.1、§9.1、§9.2）。

| `resource_kind`   | 路由 `routeKey` | 显示名     | `display_id` 前缀 |
| ----------------- | ------------- | ------- | --------------- |
| `gpu_vm`          | `servers`     | GPU 云服务器 | `srv-`          |
| `gpu_baremetal`   | `baremetal`   | GPU 裸金属  | `bm-`           |
| `vgpu`            | `vgpu`        | vGPU    | `vgpu-`         |
| `inference`       | `inference`   | 推理服务    | `inf-`          |

| `region_code` | 显示名 | ISO |
| ------------- | --- | --- |
| `jp`          | 日本  | JP  |
| `th`          | 泰国  | TH  |
| `sg`          | 新加坡 | SG  |
| `us`          | 美国  | US  |

| `node_pool_code` | 显示名        |
| ---------------- | ---------- |
| `H100_SXM`       | H100 SXM   |
| `H200_NVL`       | H200 NVL   |
| `B200_NVL72`     | B200 NVL72 |
| `B300`           | B300       |
| `GB300_NVL72`    | GB300 NVL72 |

```
路由：/resources/:routeKey                 （列表）
路由：/resources/:routeKey/:resourceUuid   （详情，参数为 resource_uuid）
展示：display_id（srv-a1b2c3），⌘K 可按 display_id 或 resource_uuid 搜索
内部：resources.id 仅作主键，禁止出现在接口响应与 URL
```

### 12.7 环境变量与开关（评审新增，消除悬空配置）

> 旧版文档声明"关闭 MSW 指向网关"却未定义如何切换。下表为唯一配置来源，`lib/api-client` 与 `app/providers.tsx` 消费。

| 变量                         | 类型      | 默认值                       | 消费位置                                | 说明             |
| -------------------------- | ------- | ------------------------- | ----------------------------------- | -------------- |
| `VITE_ENABLE_MOCK`         | boolean | `true`                    | `app/providers.tsx`（MSW 初始化开关）       | `false` 时不再拦截请求 |
| `VITE_API_BASE_URL`        | string  | `http://localhost:8080`   | `lib/api-client`（baseURL）           | Mock 关闭时的网关地址  |
| `VITE_DEFAULT_REGION`      | enum    | `jp`                      | `stores/region` 初始值                  | ∈ jp/th/sg/us  |
| `VITE_WS_URL`              | string  | 空                         | `lib/api-client`（实时通道）              | 为空则退化为轮询       |
| `VITE_POLL_INTERVAL_MS`    | number  | `3000`                    | 轮询降级路径                              | 仅在无 WS 时生效     |
| `VITE_FEATURE_STATUS_BAR`  | boolean | `true`                    | `layouts`（StatusBar 渲染开关）           | 紧急下线状态栏时用      |
| `VITE_FEATURE_TOPOLOGY`    | boolean | `true`                    | `features/cluster/topology`         | 拓扑图较重，可降级      |
| `VITE_THEME_DEFAULT`       | enum    | `light`                   | `stores/theme` 初始值                  | light/dark     |
| `VITE_LOW_BALANCE_THRESHOLD_USD` | number | `50`                 | StatusBar 提示阈值（真实阈值以后端 `orgs.low_balance_threshold_usd` 为准） | 前端兜底展示  |
| `VITE_MOCK_SEED`           | number  | `20261017`                | `mocks/lib/rng.ts`（种子随机）          | 固定种子保证 fixture 可复现（G5） |
| `VITE_ENABLE_CONSISTENCY_CHECK` | boolean | `true`（仅 dev）      | `mocks/lib/consistency.ts`  | Mock 数据运行时断言开关（§8.3） |
| `VITE_MOCK_FAULT`          | enum    | 空                         | `mocks/lib/fault-injector.ts`     | ∈ oom/xid48/network/straggler/insufficient/billing；亦可用 `?fault=` 覆盖 |

> 所有 `VITE_*` 在**构建期注入**；涉及安全的配置严禁放前端（如数据库口令、内部服务凭证）。
> `VITE_MOCK_SEED` / `VITE_ENABLE_CONSISTENCY_CHECK` / `VITE_MOCK_FAULT` 仅在 `VITE_ENABLE_MOCK=true` 时生效，Mock 关闭后 `mocks/lib/derive.ts` **不得被调用**（派生责任移交后端）。

### 12.8 边界声明

- **不落 PostgreSQL**：GPU 利用率、显存、goodput、温度、QPS、延迟等**时序采样**（由时序库或 Mock 提供；完整指标字典与真实值口径见 `MOCK-DATA.md` §6）。
- **落 PostgreSQL**：业务实体（identity/deployment/supply/content）、计费**聚合量**（`billing_usage`）、事件与审计（`*_events`）。
- `quotas.used_value` 为派生字段，**禁止业务代码直接写入**，仅由重算任务更新，避免双写不一致。

### 12.9 `spec_json` 契约（Zod 校验）

| `kind`           | 必需键                                                                                 | 可选键                                        |
| ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| `gpu_vm`         | `gpu_model`, `gpu_count`, `vcpu`, `memory_gb`, `storage_gb`, `image_ref`            | `env`, `ports`, `ssh_pubkey`               |
| `gpu_baremetal`  | `machine_type`, `gpu_model`, `gpu_count`, `passthrough`(bool), `cpu_model`, `local_nvme_gb` | `ipmi_enabled`, `ib_enabled`         |
| `vgpu`           | `k8s_version`, `node_count`, `gpu_count`, `slicing_policy`(MIG profile), `storage_gb` | `network_plugin`, `ingress_enabled`        |
| `inference`      | `model_ref`, `replicas`, `gpu_count`, `port`, `auth_enabled`                         | `hpa`(min/max/target), `traffic_split`     |

- `requested_spec`（订单请求）与 `spec_json`（实际供给）**允许不同**，UI 详情展示"实际规格"，差异来自库存/调度降级；两者皆过 Zod。

---

## 13. 实体追溯链路与工作项关联（评审新增）

> 回答"实体能否关联到具体工作项/任务、链路与字段是否可落地"。

### 13.1 主链路（单一可追溯闭环）

```
plans/orgs/users/projects                      身份与计费主体
   └─ deployment_orders  【工作项：status 即任务状态】
        ├─ source_type + source_ref_id ──► images / models / app_templates / notebooks   （来源追溯）
        └─ resources.order_id           ──► resources 【资源实例】
              ├─ resource_provisioning_steps  【子任务：step_key + state + 时间】
              ├─ resource_placements ─────► gpu_nodes ─► node_pools                    （供给落位）
              ├─ resource_events            【事件时间线 / 审计】
              └─ billing_usage ─► billing_transactions ─► orgs.credit_balance           （成本/扣费）
                    └─ billing_period ─► invoices ─► voucher_redemptions ─► vouchers   （账单/优惠）
```

### 13.2 UI → 表 → 关键字段 对照表

| UI 模块/要素                 | 主要表                                                    | 关联字段                                                |
| ----------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| 部署向导 / 下单               | `deployment_orders`                                    | `order_uuid`, `resource_kind`, `source_type/ref_id` |
| Provisioning 进度条（PRD §5.3） | `resource_provisioning_steps`                          | `resource_id`, `step_key`, `state`                  |
| 资源列表 / 详情                | `resources` + placements + events                      | `resource_uuid`(路由), `display_id`(展示)                |
| 详情页事件时间线                 | `resource_events`                                      | `resource_id`, `created_at DESC`                    |
| 来源（镜像/模型/模板）             | `images`/`models`/`app_templates`  ← orders            | `orders.source_type` + `source_ref_id`              |
| 拓扑视图（vGPU）               | `resource_placements` → `gpu_nodes` → `node_pools`     | `node_id`, `rack_id`, `gpu_indices`                 |
| 集群事件与维护                  | `node_events` + `gpu_nodes`                            | `node_id`, `actor_user_id`                          |
| 顶部状态栏（健康/余额/花费/运行中）      | `gpu_nodes`, `orgs`, `billing_usage`, `resources`      | `state`, `credit_balance`, `billing_period`         |
| 成本分析（按项目/资源/区域）          | `billing_usage` → `projects`/`resources`               | `project_id`, `resource_id`, `region`               |
| 配额水位                    | `quotas`                                               | `metric`, `limit_value`, `used_value`               |
| 资产（代金券/预留/存储包）           | `vouchers`, `reservations`, `storage_packs`            | `status`, `balance`, `end_at`                       |
| 工单                      | `tickets`                                               | `resource_id`（可关联到出问题的资源）                            |
| 通知中心                    | `notifications`                                        | `org_id`, `user_id`, `read_at`                      |

### 13.3 幂等与一致性要点

| 场景           | 机制                                                            |
| ------------ | ------------------------------------------------------------- |
| 重复计量/重复扣费    | `billing_usage UNIQUE (resource_id, usage_hour, unit)`        |
| 订单重试         | 复用同一 `order_uuid`，不新建 resource（避免孤儿实例）                         |
| 余额漂移         | `billing_transactions.balance_after` 与 `orgs.credit_balance` 同事务写入 |
| 配额不准         | `quotas.used_value` 仅由重算任务更新（派生值）                              |
| 软删与清算        | `resources.deleted_at` 非空即释放配额并停止计量                            |

---

## 14. 安全（前端侧）

- 鉴权态存内存 + 短期 token（不落 localStorage 长期密钥）。
- 密钥/凭证不在前端明文展示，危险操作二次确认。
- 所有外部跳转与用户内容做防注入/转义（React 默认转义 + 富文本白名单）。
- RBAC 仅用于体验优化，**真实鉴权与授权以后端为准**。
- `VITE_*` 仅含非敏感配置；任何私有凭证不得进入前端构建产物。
