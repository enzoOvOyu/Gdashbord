# RunSun 控制台（GPU 云控制台）

一体化 GPU 云控制台（GPU 选购 / 部署交付 / K8s GPU 资源管理 / 可观测性 / FinOps）的前端实现。
严格对齐工作空间设计文档：`PRD.md` / `ARCHITECTURE.md` / `DESIGN-SYSTEM.md` / `MOCK-DATA.md` / `REVIEW.md`。

> 当前范围：**仅前端展示 + Mock 层**。真实后端未实现，全部接口由 MSW 拦截 `/api/*`；
> PostgreSQL 由 Docker 提供，仅作为数据底座与 DDL 验证载体，详见 `ARCHITECTURE.md §12`。

## 技术栈（ARCH §1）

- **React 19** + **TypeScript 5**（strict）+ **Vite 6** + **pnpm**
- 状态管理：Zustand + TanStack Query；路由：React Router 7（路由级代码分割）
- UI 原语：Radix UI + CSS Modules（消费设计 Token）；图表：Recharts
- 表单：**React Hook Form + Zod**（部署向导分步校验，ARCH §2）
- Mock：**MSW** 拦截 `/api/*`，开关 `VITE_ENABLE_MOCK`
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

- `components/ui`：Button / Card / Badge / StatTile / Table / Tabs / Input（CSS Modules + Token）
- `LifecycleBadge`（资源生命周期 6 态）、`StateMachineBadge`（节点 5 态）——强制「颜色 + 图标 + 文本」

### ✅ 布局、Store 与路由（阶段 4）

- Sidebar 分组导航 + Topbar（56px）+ **StatusBar（40px，§3.2 六状态簇，紧张判据 `available/total < 0.15`）**
- 全导航路由 + 代码分割 + RBAC 可见性

### ✅ 资源模块（阶段 5，核心强制项）

- 4 类各自独立列表 + 独立详情页，命名/路由/`display_id` 前缀对齐 §5.2.1
- 详情页覆盖 **provisioning → running/error → stopped → terminating** 全闭环（§5.3/§5.4）
- 事件时间线带 **before→after 度量快照 + 建议动作**（§9）；监控按状态自洽（provisioning/stopped 为 `null` 而非 0，图表断点不填 0）

### ✅ 部署中心（阶段 6，PRD §4.2）

- 4 类共用六步向导：① 选型 → ② 镜像/模型 → ③ 规格 → ④ 网络与端口 → ⑤ 环境变量 → ⑥ 确认与价格预估
- 路由：`/deployment/:kind`（兼容 `server` / `baremetal` / `vgpu` / `inference`）
- Zod schema 逐键对齐 ARCH §12.9 `spec_json` 契约；`requested_spec` 与供给 `spec_json` 允许降级差异
- 下单生成 `deployment_orders`（工作项），异步映射为 `resources` 并**自动跳转资源详情**（§5.3）
- 价格预估复用 `derive.ts` §7.1：GPU·小时 + 块存储 + 公网 IP；vGPU 含托管控制面（HA ×3）；推理按 **GPU·小时**计费（不按调用量/令牌）

### ✅ 其余模块（阶段 7）

| 模块 | 页面 | 说明 |
|------|------|------|
| 集群 | 节点池 / 节点 / **调度与拓扑** / **事件与维护** | 拓扑按机架与交换机组聚合，附 NVIDIA Xid 判定表（§6.6） |
| 开发 | **Notebook·IDE** / 镜像商城 / **AI 应用模板** | 模板一键跳转对应部署向导 |
| 数据 | **数据集** / **对象存储** / **数据预处理 Pipelines** | DAG 节点与边由 `dag_json` 派生 |
| 运营 | **监控** / **日志** / 成本分析 / 配额 / **工单** | 监控展示 MFU/HFU/goodput/step_time/straggler（§6.6）；日志为结构化逐行流 |
| 资产 | **计算资产** / 代金券 / **预留实例** / **存储包** | 计算资产含月度折算；存储包含消耗进度 |

### ⏳ 已知缺口与待办

1. **无真实后端**：`VITE_ENABLE_MOCK=false` 后 `/api/*` 无实现；PostgreSQL 仅跑 DDL，未被应用访问。
2. **UI 层仍直接引用 Mock fixtures**（如 `pricing`、`gpu-specs`、`thresholds`、`XID_TABLE`）用于读取常量与参考数据。
   严格按 ARCH §11「Mock 关闭时派生责任移交后端」的要求，应改为经 `/api/catalog/*` 等接口下发。已记录待重构，暂与既有页面保持一致。
3. **资源操作为前端态**：启停/重置/删除等未串联完整的后端写链路。
4. `tsconfig` 关闭了 `noUncheckedIndexedAccess`（超出 strict 要求，与确定性 fixture 的数组索引冲突）；`strict` / `noUnusedLocals` / `noUnusedParameters` 均保留。
5. 未铺 CI、单测与 E2E；i18n（react-i18next）已装依赖但未接翻译文案。

## 目录结构（ARCH §3）

```
src/
├─ app/
│  ├─ providers.tsx        # QueryClient + MSW 初始化（受 VITE_ENABLE_MOCK 控制）
│  ├─ router.tsx           # 全导航路由 + 路由级代码分割
│  └─ layouts/             # ConsoleLayout / Sidebar / Topbar / StatusBar
├─ components/
│  ├─ ui/                  # Button / Card / Badge / StatTile / Table / Tabs / Input
│  ├─ state-machine/       # LifecycleBadge（6 态）/ StateMachineBadge（5 态）
│  └─ charts/MetricChart   # 固定量程 + 阈值虚线 + null 断点
├─ features/               # overview / deployment / resources / cluster /
│                          # development / data / operations / model-library / assets
├─ lib/                    # api-client / rbac / ids / money / date（基础工具）
├─ mocks/
│  ├─ handlers/            # MSW 拦截器（业务实体 /api/*）
│  ├─ fixtures/            # gpu-specs / pricing / regions-pools / models / images / …
│  ├─ lib/                 # rng / derive / timeseries / consistency / env
│  └─ metrics.ts           # 时序指标（独立 /api/metrics/*）
├─ stores/auth.ts          # auth / region / theme
├─ styles/theme.css        # 设计 Token（亮/暗，DESIGN-SYSTEM §2/§4）
└─ types/domain.ts         # 与 §12 DDL 同构的领域类型
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
```

## Docker 开发环境

```bash
cp .env.example .env   # 按需修改；默认即可
docker compose up -d   # 前端容器 frontend + 数据库 db + 管理 UI adminer
```

- 前端：**http://localhost:5173**
- PostgreSQL：**localhost:5432**（库/用户/口令见 `.env`，默认 `runsun/runsun/runsun`）
- Adminer（数据库管理）：**http://localhost:8081**
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
