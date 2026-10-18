# RunSun 控制台 · 基础开发环境

一体化 GPU 云控制台（GPU 选购 / 部署交付 / K8s GPU 资源管理 / 可观测性 / FinOps）的前端工程骨架。
本仓库为**目标架构的基础开发环境**（重构起点），严格对齐设计文档 `PRD.md` / `ARCHITECTURE.md` / `DESIGN-SYSTEM.md` / `MOCK-DATA.md` / `REVIEW.md`。

> 当前范围：**仅前端展示 + Mock 层**；真实后端（PostgreSQL 蓝图）仅作数据底座，详见 `ARCHITECTURE.md §12`。

## 技术栈（ARCH §1）

- **React 19** + **TypeScript 5**（strict） + **Vite 6** + **pnpm**
- 状态：Zustand + TanStack Query；路由：React Router 7；UI 原语：Radix UI；图表：Recharts
- Mock：**MSW** 拦截 `/api/*`，开关 `VITE_ENABLE_MOCK`
- 数据库底座：**PostgreSQL 15**（Docker 提供，初始化脚本见 `docker/postgres/init`）
- 容器编排：**Docker Compose**（前端容器 + PG 容器 + Adminer）

## 目录结构（ARCH §3）

```
src/
├─ app/providers.tsx   # Query / i18n / Theme / MSW 初始化（受 VITE_ENABLE_MOCK 控制）
├─ lib/                # api-client / rbac / ids / money（基础工具，已落地）
├─ mocks/              # MSW handlers + 浏览器 worker（拦截示例见 handlers.ts）
├─ styles/theme.css    # 设计 Token（亮/暗，DESIGN-SYSTEM §2/§4）
├─ main.tsx / App.tsx  # 入口与占位页
docker/
├─ frontend/Dockerfile # 前端开发容器（Node22 + pnpm + Vite6）
├─ postgres/init/      # 01-schema.sql（§12 全量 DDL）+ 02-seed.sql（种子）
docker-compose.yml     # frontend(5173) + db(5432) + adminer(8081)
```

## 本地开发（先决：Node 22 + pnpm 9）

```bash
pnpm install           # 安装依赖（生成 pnpm-lock.yaml）
pnpm dev               # 启动 Vite 开发服务器（默认 5173，MSW 默认开启）
pnpm build             # tsc 类型检查 + 生产构建
pnpm typecheck         # 仅类型检查
```

> MSW 服务 worker 已通过 `pnpm exec msw init public/ --save` 生成至 `public/mockServiceWorker.js`（已提交）。

## Docker 开发环境

```bash
cp .env.example .env   # 按需修改；默认即可
docker compose up -d   # 前台容器 frontend + 数据库 db + 管理 UI adminer
```

- 前端：**http://localhost:5173**
- PostgreSQL：**localhost:5432**（库/用户/口令见 `.env`，默认 `runsun/runsun/runsun`）
- Adminer（数据库管理）：**http://localhost:8081**
- 数据落盘：`./docker/postgres/data`（已 gitignore，销毁用 `docker compose down -v`）
- 初始化：`docker/postgres/init/*.sql` 在首次启动时被挂载到 `/docker-entrypoint-initdb.d` 自动执行

### ⚠️ 容器出网代理（必须，否则前端容器起不来）

前端容器启动时会执行 `pnpm install` 拉取 npm 包。若宿主网络需经代理访问外网（本机即如此），**容器默认不会自动走代理**，会卡在 `pnpm install` 导致前端容器无法就绪。

- 代理已在 `docker-compose.yml` 的 `frontend.environment` 中配置，指向宿主代理 `host.docker.internal:<端口>`（容器内解析到宿主网关）。
- 端口取自 `.env` 的 `COMPOSE_HTTP_PROXY` / `COMPOSE_HTTPS_PROXY`，默认 `62294`，**须与你的宿主代理端口一致**。
- 查看/修改宿主代理端口：`echo $HTTP_PROXY`（本机）；
- 若端口变动，同步修改 `.env`（以及 `.env.example`）中的这两个值后，执行 `docker compose up -d --build` 重新生效。
- 说明：Docker daemon 自身的镜像拉取代理（`http.docker.internal:3128`）由 Docker Desktop 自动注入，与上面"容器内出网代理"是两回事。

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

## 数据库底座说明（ARCH §12）

- `01-schema.sql`：按依赖顺序建表 —— identity → supply → deployment → billing → content。
- `02-seed.sql`：套餐（3 档）、节点池（5 类）、示例 org/user/project。
- **边界（§12.8）**：GPU 利用率 / 显存 / 延迟等高频时序指标**不落 PG**，由时序库或 Mock 提供；PG 仅存业务实体与计费聚合量。

## 设计文档

- 需求：`PRD.md` · 架构：`ARCHITECTURE.md` · UI 规范：`DESIGN-SYSTEM.md`
- Mock 契约：`MOCK-DATA.md` · 评审：`REVIEW.md`
