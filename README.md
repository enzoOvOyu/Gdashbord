# RunSun Cloud 控制台

![Fleet Animation](docs/fleet-animation.svg)

一体化 GPU 云控制台：从 GPU 选购、部署交付（工作空间 / 训练任务 / 推理 Endpoint / 集群）到 **Kubernetes GPU 资源管理**、可观测性与 FinOps 成本分析。

**万卡级机队运营**：平台运营 10,016 张 GPU（103 集群 · 4 区域 · 12 可用区），服务 24 家分层客户（8 家企业专属集群 + 8 家中型节点池 + 8 家中小 Serverless），全部 KPI 由真实工作负载实算闭环。

前端为**无构建 ES Module** 架构，后端为 Express REST API + JSON 状态持久化，前后端真实联调。

## 平台规范（全局约束）

- **区域（Region）**：日本 / 泰国 / 美国三地，具体可用区为 `JP-TYO-1` / `TH-BKK-1` / `US-LAX-2` / `US-IAD-1`。
- **GPU 机型**：限定 `H100` / `H200` / `B200` / `B300` / `GB300` 五种（不再含 A100 / L40S / RTX4090）。
- **计费币种**：全站统一以美元（USD）计价，金额格式 `$ 1,234.56`。
- **界面语言**：提供中 / 英双语切换（右上角语言切换），两套文案完整覆盖；`t(key)` 负责 UI 文案，`L({ zh, en })` 负责服务端返回的双语字段。

---

## 在线演示

以下 GIF 均由 **Playwright + Chromium 在真实运行的服务上录制**（1500×940 采样后缩放合成，2 倍速播放），非设计稿、非静态图。

**演示 1 · 从选购到部署**：总览指标 → 算力市场筛选 H100 并按价格排序 → 查看 GPU 详情 → 进入部署中心走完 4 步向导 → 创建工作空间并跳转到实例列表。

![从选购到部署](docs/demo/demo-tour.gif)

**演示 2 · Kubernetes GPU 集群运维**：集群概览 → GPU 节点封锁与详情 → 调度队列触发 Gang 调度与抢占 → 工作负载管理。

![Kubernetes GPU 集群运维](docs/demo/demo-k8s.gif)

**演示 3 · 实例运维与推理调试**：工作空间启停 → Endpoint Playground 发送测试请求并拿到模拟响应 → 可观测性切换监控目标与告警 → 费用中心查看成本明细。

![实例运维与推理调试](docs/demo/demo-run.gif)

---

## Kubernetes GPU 资源管理

参考 CoreWeave **CKS**（CoreWeave Kubernetes Service）、**SUNK**（Slurm on Kubernetes）与 **Mission Control** 的运维概念实现，覆盖 GPU 节点状态、资源分配、任务调度与机架级监控。

| 能力 | 说明 |
|---|---|
| **节点池与 GPU 节点** | 5 个节点池（H100 SXM / H200 NVL / B200 NVL72 / B300 / GB300 NVL72），按区域分布的 GPU 节点状态机：Ready / Cordoned / Draining / Remediation / NotReady |
| **节点运维动作** | cordon（封锁）、uncordon、drain（驱逐并触发重调度）、remediate（自动修复）、straggler 标记清除 |
| **资源分配** | 每节点 GPU / CPU / 内存分配率条形可视化，节点池与命名空间两级水位 |
| **命名空间配额** | `nvidia.com/gpu`、CPU、内存、Pod 四维配额，Critical / High / BestEffort 三级优先级与抢占策略 |
| **拓扑感知调度** | Gang 调度要求同时拿到全部 GPU；优先收敛在同一 NVLink 域内；反碎片收敛；容量不足时按优先级抢占 |
| **机架拓扑** | Cabinet Visualizer：按机柜聚合节点，颜色映射 GPU 温度，异常节点红标 |
| **集群指标** | GPU 利用率、Goodput、MTTF、Straggler、IB 网络吞吐、GPU 温度与功耗 |
| **事件流** | `kubectl get events` 语义：FailedScheduling / GPUHealthDegraded / NVLINKDown / NodeRemediation / OOMKilling |

调度队列中的阻塞原因与真实调度器输出一致，例如：

```text
0/36 nodes are available: Insufficient nvidia.com/gpu（需 64，B200 可调度 22）
```

---

## 界面一览

以下截图均由 Playwright 在 1440×900 视口下对运行中的服务实机截取（RunSun 品牌视觉，与仓库当前代码一一对应）。

| 总览 Dashboard | GPU 算力市场 | 部署中心 |
|:---:|:---:|:---:|
| ![总览](docs/screenshots/ui-overview.png) | ![市场](docs/screenshots/ui-market.png) | ![部署](docs/screenshots/ui-create.png) |

| 部署向导 · 规格确认 | 工作空间与实例 | 推理服务 Endpoints |
|:---:|:---:|:---:|
| ![向导](docs/screenshots/ui-create-step3.png) | ![实例](docs/screenshots/ui-instances.png) | ![端点](docs/screenshots/ui-endpoints.png) |

| 训练任务与集群 | 模型与数据资产 | API 密钥与权限 |
|:---:|:---:|:---:|
| ![任务](docs/screenshots/ui-jobs.png) | ![资产](docs/screenshots/ui-assets.png) | ![安全](docs/screenshots/ui-security.png) |

| K8s 集群概览 | GPU 节点（23 节点 / 150 卡） | 资源配额 |
|:---:|:---:|:---:|
| ![K8s 概览](docs/screenshots/ui-k8s-overview.png) | ![节点](docs/screenshots/ui-k8s-nodes.png) | ![配额](docs/screenshots/ui-k8s-quotas.png) |

| 调度队列（Gang 调度） | 调度结果（跨节点放置 + 抢占） | 工作负载 |
|:---:|:---:|:---:|
| ![调度](docs/screenshots/ui-k8s-scheduler.png) | ![调度结果](docs/screenshots/ui-k8s-dispatch-result.png) | ![工作负载](docs/screenshots/ui-k8s-workloads.png) |

| 可观测性 | 费用与预算 | 侧栏折叠态 |
|:---:|:---:|:---:|
| ![监控](docs/screenshots/ui-monitor.png) | ![费用](docs/screenshots/ui-billing.png) | ![折叠](docs/screenshots/ui-collapsed.png) |

<details>
<summary>响应式（1280 / 768）</summary>

| 1280px | 768px |
|:---:|:---:|
| ![1280](docs/screenshots/ui-overview-1280.png) | ![768](docs/screenshots/ui-overview-768.png) |

</details>

## 管理员控制台（Admin Console）

独立完整的后台管理界面，覆盖租户 / 用户、资源与配额、计费与定价、平台运营与审计四块：

| 模块 | 能力 |
|---|---|
| **租户与用户** | 租户列表（企业 / 团队）、用户与角色（Owner / Admin / Developer / Viewer / Billing）、项目级 RBAC 矩阵 |
| **资源与配额** | 区域 GPU 容量（按机型 / 区域分配率）、租户配额、节点池水位、抢占与排队策略 |
| **计费与定价** | 价格簿（GPU 单价 / 预留 / 竞价 / 存储）、租户账单、充值、发票与 MRR |
| **平台运营与审计** | 全局 KPI（租户数 / 用户数 / 机队使用率 / MRR / 工单）、服务健康、操作审计日志、公告 |

管理端数值与部署 / 推理 / 训练 / 资产 / 运营模块同源（单一价格簿 + 成本引擎 `server/services/cost.js`），保证全站统计口径一致。

中 / 英双语：右上角一键切换，全站文案两套完整覆盖。英文示例：

| 总览（English） | 管理员控制台（English） |
|:---:|:---:|
| ![总览 EN](docs/screenshots/ui-overview-en.png) | ![Admin EN](docs/screenshots/ui-admin-en.png) |

---

## 品牌与配色（取自 runsuncloud.com）

| 类别 | 值 | 来源 |
|---|---|---|
| 品牌主色 | `#FF6000` | Logo 主色、CTA 按钮背景、强调文字 |
| 品牌渐变 | `linear-gradient(125deg, #FF9900, #FF6000, #FFCC32, #FF6A48)` | 站点 home-sustainable 条 |
| 辅助色 | `#FF9900` `#FFCC32` `#FF6A48` | 渐变分段取色 |
| 中性深色 | `#222222` / `#333333` | 深色区块 + Logo 深灰 |
| 正文 / 次要文字 | `#313233` / `#626466` | H1 与正文计算色 |
| 背景 / 浅底 | `#FFFFFF` → `#F4F5F7` | 区块背景渐变 |
| 图标 | Bootstrap Icons 线形 | 站点引用 bootstrap-icons |
| 字体 | 系统字体栈（-apple-system / Segoe UI / Noto Sans + 中文回退） | 站点未使用自定义 webfont |

全部定义在 `public/styles/tokens.css`（`--brand` / `--gradient-brand` / `--gradient-brand-soft` / `--gradient-surface` 等），业务与布局不变。

## 设计参考

参考 CoreWeave（CKS / SUNK / Mission Control：节点池、cordon / drain、straggler、拓扑感知调度、goodput、机架拓扑）、RunPod（GPU 选购卡片与部署流程）、AutoDL（国内用户习惯与实例控制台）、Vast.ai（复杂资源筛选与价格比较）、优云智算（镜像商城与 AI 应用一键部署）、Modal（开发者体验、监控与日志），重新组织为「集群 / 开发 / 训练 / 推理 / 数据 / 运营」一体化控制台。

## 视觉规范

现代云控制台设计系统（`public/styles/tokens.css` + `public/styles/main.css`，参考 Vercel / Railway / shadcn-ui / Tremor）：
- Design Tokens 统一管理：Primary #2563EB、Sidebar #111827、Background #F8FAFC、Border #E2E8F0，8px 间距阶梯、10px 卡片圆角、轻微阴影
- 240px 可折叠深色侧栏（64px 图标模式，状态持久化）、60px 吸顶 Header、紧凑 sticky 表格
- 统一状态：Loading（骨架屏 + 顶部进度条）/ Empty / Error / Disabled / Hover / Selected；键盘焦点环与 aria 标注；prefers-reduced-motion 适配
- 响应式：1440 / 1280 / 1024 / 768 四档，窄屏下无横向溢出

---

## 架构对齐关系（原型 → 本工程）

以单文件原型为唯一标准：目录结构、模块划分、命名规范与代码风格严格对齐，原型缺失的部分按其架构思路补齐。

| 原型（单文件） | 本工程 |
|---|---|
| `GPU / IMAGES / MODELS / NAV` 常量 | `server/data/catalog.js` + `GET /api/catalog` |
| `init` 状态 + `localStorage` | `server/data/seed.js` + `server/store.js`（JSON 持久化）+ 前端 `store.js`（UI 态） |
| `S` / `set(path,value)` / `save()` | 前端 `public/js/store.js`；领域写入走 `PATCH /api/state` |
| `render()` / `shell()` / `nav()` | `public/js/app.js` / `shell.js` |
| `pages{...}` 页面表 | `public/js/pages/*.js`（11 个同名模块）+ `server/routes/*.js`（10 个同名路由） |
| `deploy()` / `instanceAction()` | `server/services/workload.js`（同名函数，服务端执行） |
| `metric/card/section/field/input/select/btn/segmented/chart/status/toast/modal/copy/esc/money` | `public/js/ui.js`（同名同签名） |
| `series()` 模拟时序 | `services/workload.js#series` + `GET /api/monitor/metrics` |
| `styles` 内联 CSS | `public/styles/main.css` + `public/styles/dense.css`（高密度视觉层） |

**Kubernetes 模块**（新增）：`server/data/k8s.js`（节点池 / 节点 / 配额 / 工作负载 / 事件数据模型）+ `server/services/k8s.js`（节点运维、Gang 调度模拟、配额计算、机架拓扑）+ `server/routes/k8s.js` + `public/js/pages/kubernetes.js`（5 个高密度 Tab）。

## 目录结构

```
/opt/gdashboard/repo
├── config.js                  # 独立配置（端口/数据文件/日志/静态目录）
├── server/
│   ├── index.js               # 入口：挂载 API + 托管前端
│   ├── store.js               # 状态仓库（load/save/set/pushEvent/reset）
│   ├── data/{catalog,seed}.js # 目录常量与领域数据种子
│   ├── data/k8s.js            # K8s 数据模型：节点池/节点/配额/工作负载/事件
│   ├── services/workload.js   # 业务逻辑：deploy / instanceAction / series
│   ├── services/k8s.js        # K8s 业务逻辑：节点运维/Gang 调度/配额/拓扑
│   ├── services/admin.js      # 管理后台业务逻辑：租户/配额/价格/审计
│   ├── services/cost.js       # 单一价格簿 + 成本引擎（OPERATIONS 一致性）
│   └── routes/                # overview market workloads endpoints jobs assets security kubernetes monitor billing admin
├── public/
│   ├── index.html
│   ├── styles/{main,dense}.css
│   └── js/
│       ├── api.js             # 前后端联调
│       ├── store.js           # 状态（UI 态持久化 + 领域态来自服务端）
│       ├── ui.js  shell.js  app.js
│       └── pages/             # 12 个页面模块（含 kubernetes.js、admin.js）
├── docs/
│   ├── demo/                  # 演示 GIF
│   └── screenshots/           # 页面截图
├── data/state.json            # 服务端状态持久化（工程内，不入库）
└── log/server.log
```

## 运行

```bash
cd /opt/gdashboard/repo
npm install     # 仅安装到本工程 node_modules，不全局安装
npm start       # 端口 8080
```

远程访问（8080 未对公网开放时用 SSH 隧道，本地端口避开占用）：

```bash
ssh -i ~/.ssh/enzo-using.pem -N -L 18080:127.0.0.1:8080 ubuntu@13.158.38.7
# 浏览器访问 http://localhost:18080
```

## API

- `GET /api/catalog`、`GET /api/state`、`PATCH /api/state`、`POST /api/state/reset`
- `GET /api/overview`
- `GET /api/market?query=&gpu=&region=&sort=`、`GET /api/market/:id`
- `GET /api/workloads`、`POST /api/workloads/deploy`、`POST /api/workloads/:id/action`
- `GET /api/endpoints`、`POST /api/endpoints/:id/action`（scale/playground/logs/curl）
- `GET /api/jobs`、`POST /api/jobs/:id/retry`、`POST /api/jobs/:id/logs`
- `GET/POST /api/assets`
- `GET /api/security`、`POST /api/security/keys`、`DELETE /api/security/keys/:id`、`POST /api/security/secrets`
- `GET /api/monitor/metrics?tab=&range=`、`GET /api/monitor/events`、`POST /api/monitor/alerts`
- `GET /api/billing`、`POST /api/billing/budget`、`POST /api/billing/recharge`、`GET /api/billing/export`

**管理员控制台**

- `GET /api/admin/overview` — 全局 KPI（租户 / 用户 / 机队 / MRR / 工单）
- `GET /api/admin/tenants`、`POST /api/admin/tenants/:id/status`、`POST /api/admin/tenants/:id/quota`、`POST /api/admin/users`、`POST /api/admin/users/:id/role`、`POST /api/admin/users/:id/status` — 租户与用户
- `GET /api/admin/capacity` — 区域 GPU 容量与分配
- `GET /api/admin/billing`、`POST /api/admin/price` — 价格簿与账单
- `GET /api/admin/ops`、`POST /api/admin/tickets/:id/resolve`、`POST /api/admin/announcements` — 运维与审计
- `GET /api/admin/cluster-skus` — 集群规格价目

**Kubernetes GPU 资源管理**

- `GET /api/k8s/summary` — 集群总览：节点/GPU 汇总、分配率、Goodput、MTTF、straggler
- `GET /api/k8s/nodes?pool=&status=` — GPU 节点列表；`GET /api/k8s/nodes/:id` — 节点详情与其上 Pod
- `POST /api/k8s/nodes/:id/action` — 节点运维：cordon / uncordon / drain / remediate / restore / clear-straggler / delete
- `GET /api/k8s/quotas`、`POST /api/k8s/quotas` — 命名空间配额读取与调整
- `GET /api/k8s/workloads?ns=&phase=` — 工作负载列表；`POST /api/k8s/workloads/:id/action` — restart / delete / preempt
- `GET /api/k8s/scheduler` — 调度队列；`POST /api/k8s/scheduler/dispatch` — 触发调度（含拓扑感知与抢占）
- `GET /api/k8s/topology` — 机架拓扑（Cabinet Visualizer 数据）
- `GET /api/k8s/metrics?tab=&range=` — 集群指标；`GET /api/k8s/events` — 集群事件

## 隔离说明

- 工程目录：`/opt/gdashboard/repo`，与开发机其他项目（`/opt/keel`、`/opt/keel-tools`、`/opt/containerd`）完全独立
- 依赖：`npm install` 仅写入本工程 `node_modules`，未做任何全局安装
- 端口：8080（启动前已确认无其他服务占用）
- 配置：`config.js` 自有配置，不复用其他项目配置
- 数据/日志：写入工程内 `data/`、`log/` 目录，已加入 `.gitignore`

## 演示素材制作

`docs/demo/` 下的 GIF 由 Playwright 录制帧序列 + `pngjs` 降采样 + `gif-encoder` 合成，全部依赖装在隔离目录 `/opt/gdashboard/smoke`（不在本工程内）：

```bash
node demo-record.mjs tour   # 录制「选购 → 部署」帧序列
node demo-record.mjs k8s    # 录制「K8s 集群运维」帧序列
node demo-record.mjs run    # 录制「运维 → 调试」帧序列
node gif.mjs tour out/demo-tour.gif 860 150 2   # 合成 GIF（宽 860 / 150ms / 抽 2 帧）
```
