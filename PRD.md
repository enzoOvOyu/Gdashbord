# PRD — RunSun GPU Cloud 控制台（前端设计稿）

> 文档类型：产品需求文档（仅前端功能设计，不含后端实现）
> 版本：**v0.5 · 草稿（评审修订版 + Mock 数据规范）**
> 日期：2026-10-17
> 关联文档：`ARCHITECTURE.md`（架构/数据模型）、`DESIGN-SYSTEM.md`（UI 规范）、`REVIEW.md`（评审报告）

---

## 0. 修订记录

| 版本   | 日期         | 说明                                                                                                                                                                                  |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.1 | 2026-10-17 | 初始设计稿，明确前端范围、信息架构、节点池与状态机                                                                                                                                                            |
| v0.2 | 2026-10-17 | 解耦"创建 / 展示"：部署中心改为创建入口；新增独立「资源」菜单（当时含"按资源 + 按场景"双视角）；资源类型重构为 GPU 云服务器 / GPU 裸金属 / vGPU / 推理服务；新增顶部全局条规范            |
| v0.3 | 2026-10-17 | 资源页去掉"按场景"菜单，消除"开发"一词双义；新增顶部状态栏 §3.2；新增后端数据模型约束（用户 / 资源映射 / billing 初版 DDL）                                                                                    |
| **v0.4** | **2026-10-17** | **评审修订版**：修正循环外键、补齐资源生命周期终态与状态转移图、将计费与生命周期挂钩、统一 ID 口径与枚举映射表、统一角色与币种、新增 §7 计费·套餐·配额规则与 §8 身份权限、补齐命名映射与 ID 规范、补全被 UI 引用但无模型的实体。详见 `REVIEW.md` |
| **v0.5** | **2026-10-17** | **Mock 数据规范**：新增独立文档 `MOCK-DATA.md`（真实值约束与假数据红旗清单、5 类 GPU 权威硬件基线、价格与区域系数、四类资源与集群的监控指标字典、派生公式引擎、有意义事件契约、生成器与验收清单）。§3.2 状态栏、§4.3.1–4.3.4 详情页、§4.4 集群指标、§11 范围、§12 验收清单同步引用；`ARCHITECTURE.md` §6/§8/§12.7/§12.8 与 `DESIGN-SYSTEM.md` §7/§8.3 同步。 |

---

## 1. 产品概述

### 1.1 背景

RunSun 是面向 AI/ML 团队与开发者的 NVIDIA GPU 公有云平台，提供从按需实例、容器化部署到 Kubernetes 原生集群的算力供给。本控制台是其 **Web 前端控制台（Dashboard）**，目标是把「集群 / 开发 / 数据 / 运营」四类平台辅助能力与「部署中心（创建）+ 资源（展示：GPU 云服务器 / GPU 裸金属 / vGPU / 推理服务，按资源类型分类）」整合为一体化控制台，降低 GPU 资源从选型、部署到运维的认知成本。

### 1.2 定位

- **面向人群**：公有云租户（个人开发者、算法团队、MLOps 工程师、平台管理员）。
- **核心主张**：像选商品一样选 GPU，像管服务一样管算力。
- **本次范围**：**仅前端展示**。所有数据通过 Mock 层提供；若未来需要后端持久化，约定使用 PostgreSQL（详见 `ARCHITECTURE.md` §12）。**本次不做任何后端代码与数据库实现**。

### 1.3 设计原则（取自竞品取舍）

| 来源                                          | 借鉴点                                               | 在本方案中的落点                |
| ------------------------------------------- | ------------------------------------------------- | ----------------------- |
| **CoreWeave**（CKS / SUNK / Mission Control） | 节点池、cordon/drain、straggler 检测、拓扑感知调度、goodput、机架拓扑 | 集群模块的节点池/状态机/拓扑/健康视图    |
| **RunPod**                                  | GPU 选购卡片、清晰的部署流程（镜像/环境变量/存储/端口）                   | 部署中心的卡片化资源选购与分步部署向导     |
| **AutoDL**                                  | 国内用户习惯、实例控制台（Jupyter/SSH/文件/终端）                   | GPU 云服务器控制台、区域选择习惯       |
| **Vast.ai**                                 | 复杂资源筛选、价格对比                                       | 节点池/实例的筛选器与比价视图         |
| **优云智算**                                    | 镜像商城、AI 应用一键部署                                    | 开发·镜像商城 + 应用模板一键部署      |
| **Modal**                                   | 开发者体验、监控与日志                                       | 推理服务与全局资源的实时监控与日志面板     |

---

## 2. 信息架构（导航）

采用**侧边栏分组导航 + 顶部全局条 + 顶部状态栏**的三层结构。所有页面均为前端路由，数据来自 Mock。

```
RunSun 控制台
├─ 总览 Overview                                  （全局仪表盘）
├─ 部署中心 Deployment Center                     （创建入口：4 类资源的部署向导）
│   ├─ 新建 GPU 云服务器
│   ├─ 新建 GPU 裸金属
│   ├─ 新建 vGPU 集群
│   └─ 新建 推理服务
├─ 资源 Resources            ★ 独立展示菜单（创建完成后资源的归属与详情空间，按资源类型分类）
│   ├─ GPU 云服务器   GPU Cloud Server
│   ├─ GPU 裸金属     GPU Bare Metal
│   ├─ vGPU          GPU Virtualization（托管 K8s）
│   └─ 推理服务       Inference Service
├─ 集群 Cluster                                   （辅助：节点/基础设施）
│   ├─ 节点池 Node Pools
│   ├─ 节点 Nodes
│   ├─ 调度与拓扑 Scheduling & Topology
│   └─ 事件与维护 Events & Maintenance
├─ 开发 Development                               （辅助：工具链与取用入口）
│   ├─ Notebook / IDE
│   ├─ 镜像商城 Image Marketplace
│   └─ AI 应用模板 App Templates
├─ 数据 Data
│   ├─ 数据集 Datasets
│   ├─ 对象存储 Object Storage
│   └─ 数据预处理 Pipelines
├─ 运营 Operations
│   ├─ 监控 Monitoring
│   ├─ 日志 Logs
│   ├─ 成本分析 Cost
│   ├─ 配额 Quotas
│   └─ 工单 Tickets
├─ 模型库 Model Library                           （独立一级）
└─ 资产 Assets                                    （独立一级）
    ├─ 计算资产 Compute
    ├─ 代金券 Vouchers
    ├─ 预留实例 Reserved
    └─ 存储包 Storage Packs
```

> **关系澄清（重要）**：本控制台将"**创建**"与"**展示 / 管理**"解耦为两个独立入口——
>
> - **部署中心** = **创建入口**，仅承载 4 类资源的部署向导（新建 GPU 云服务器 / 裸金属 / vGPU / 推理服务），负责选型、配置与下单。
> - **资源**（★独立菜单）= **创建完成后资源的展示与管理空间**，是资源实例唯一的归属地。按**资源类型**分为 4 类，每类独立列表 + 独立详情页；**不设"按场景"的二级菜单**。
> - 资源从部署中心**创建完成后，自动映射到 4 类资源之一并出现在「资源」菜单对应类型下**（强制，见 §5），**不在部署中心重复陈列**。
> - **集群 / 开发（模块）** 为 GPU 资源使用的**辅助 / 使能能力**（非资源类型）：集群 = 供给侧节点/基础设施运维；开发 = 工具链与取用入口。
>
> **命名易混淆点（已修正，务必区分）**：
> 1. **「开发」只有一种含义** = 顶部菜单的**开发模块**（Notebook/IDE、镜像商城、应用模板），是"取用与编排 GPU 资源的工具链"，**不产生、不陈列资源实例**。
> 2. **「集群」≠「vGPU（托管 K8s）」**：集群是平台供给的**节点/基础设施**（不是你买的）；vGPU 是你购买的**托管 K8s 集群资源**，归「资源·vGPU」展示。详见 §6.2。

---

## 3. 全局能力（跨模块）

| 能力      | 说明                                                                          |
| ------- | --------------------------------------------------------------------------- |
| 多区域切换   | 顶部区域选择器：日本 JP / 泰国 TH / 新加坡 SG / 美国 US；切换写入 `region` store 并驱动资源视图过滤 |
| 账号与 IAM | 用户、**5 种角色**（Owner / Admin / Member / Billing / Viewer，见 §8）、**项目 Project** 切换；前端按角色控制菜单与操作可见性 |
| 计费与配额   | 实时余额、用量趋势、配额水位；币种统一 **USD**（见 §7.1），UI 按 locale 格式化展示                  |
| 主题      | 亮/暗主题切换，遵循 `DESIGN-SYSTEM.md` Token                                       |
| 通知中心    | 由 `notifications` 驱动的未读计数与事件流（节点 NotReady、任务失败、额度预警）                     |
| 帮助与文档   | 文档链接、快捷命令面板（⌘K）                                                             |
| 国际化     | i18n 框架（zh-CN 默认，预留 en-US）                                                  |

### 3.1 顶部全局条（Topbar）结构规范

横跨所有页面，左→右分三区，高度 56px，与侧边栏同色/同描边，下边框分隔：

```
[ 品牌区 ] [ 全局搜索 ⌘K │ 面包屑 ]                    [ 区域 ▾ ] [ + 新建 ] [ 🔔 ] [ ❓ ] [ 🌗 ] [ 👤 ▾ ]
```

- **品牌区（左）**：RunSun Logo + 产品名；点击回「总览」。
- **全局搜索（中左）**：⌘K 命令面板入口，可搜资源（按 **display_id 或 resource_uuid** / 名称 / GPU 类型）、模型、文档与快捷操作；右侧接**面包屑**（如 `资源 / GPU 云服务器 / srv-a1b2c3`，见 §5.5 ID 规范）。
- **区域选择器**：JP / TH / SG / US；切换写入 `region` store（ARCH §5）。
- **+ 新建资源**：一级创建入口，下拉 4 类，跳转部署中心对应向导。
- **通知中心**：未读徽标 + 事件流（数据源 `notifications`，ARCH §12.5）。
- **帮助**：文档链接 + 快捷键面板。
- **主题切换**：亮 / 暗，写入 `data-theme`。
- **账号菜单**：用户 / **组织（orgs.name）/ 套餐（plans.name）/ 角色（5 种）** / **项目切换** / IAM / 退出。
- **响应式**：≥1280 完整展示；<1280 搜索收为图标、账号/通知保留；移动端仅留 Logo + 区域 + 账号 + 汉堡（开侧栏抽屉）。
- **公有云贴合要点**：区域选择器为常驻核心控件；账号菜单凸显租户/套餐/计费主体；`+ 新建` 与全局搜索为高频入口。

### 3.2 顶部状态栏（StatusBar，公有云运营态）

位于 Topbar 之下、主内容之上，**高度 40px，surface-2 底 + 下边框**，呈现租户最关心的"实时运营态"。左→右状态簇，**颜色 + 图标 + 文本至少两者并存**。

```
[● 服务正常] [📍 新加坡 SG · H100 可用 / H200 紧张] [💳 余额 $1,234.56] [📊 本月已用 $328.40] [🖥 运行中 12] [⚡ 实时]
```

| 状态簇        | 数据源                                        | 语义/告警                          |
| ---------- | ------------------------------------------ | ----------------------------- |
| 服务健康       | `gpu_nodes.state` 聚合 + `node_events`         | 正常=绿✓ / 降级=琥珀⚠ / 故障=红✕       |
| 当前区域与算力供给  | `node_pools`（可用 GPU / 总量）                   | 引导切换区域或前往节点池比价                 |
| 账户余额       | `orgs.credit_balance`、`low_balance_threshold_usd` | 低于阈值转琥珀并提示充值（§7.6）             |
| 本月花费       | `billing_usage` 按 `billing_period` 汇总        | 超预算转琥珀；点击跳运营·成本分析              |
| 运行中资源数     | `resources` 中 `status='running'` 计数          | 点击跳「资源」菜单                      |
| 实时指示       | Mock WebSocket 心跳                           | 脉冲点表示监控/计费流接入                  |

- **响应式**：≥1280 全量；<1280 折叠为「健康 + 余额 + 实时」三项图标；移动端仅留健康点 + 余额。
- 组件规范见 `DESIGN-SYSTEM.md` §5.17。
- **各状态簇的指标定义、阈值与派生方式见 `MOCK-DATA.md` §6.7**；其中"算力紧张"判据为 `available_gpu / total_gpu < 0.15`，余额/花费须由 `MOCK-DATA.md` §7.1 派生，不得硬编码。

---

## 4. 核心模块需求

### 4.1 总览 Overview

- **核心指标卡**：活跃 GPU 数、运行中的 4 类资源数、近 24h 花费（`billing_usage` 聚合）、平均 goodput。
- **资源分布**：按节点池的 GPU 占用堆叠图；按区域的资源热力。
- **节点健康概览**：5 态（Ready / Cordoned / Draining / Remediation / NotReady）占比环形图。
- **近期活动**：由 `resource_events` + `node_events` 组成的事件流。
- **快捷入口**：新建 GPU 云服务器 / 裸金属 / vGPU / 推理服务 / 浏览镜像商城。

### 4.2 部署中心 Deployment Center（创建入口）

统一**创建入口**：4 类资源各有独立部署向导，负责选型、配置与下单；创建完成后资源归入「资源」菜单（§4.3），本模块**不**承载资源列表与详情。

- **新建 GPU 云服务器**：节点池/GPU → 镜像（`images`）/系统盘 → 规格（vCPU/内存/存储）→ 网络/VPC → 确认价格。
- **新建 GPU 裸金属**：机型 → GPU 直通/本地 NVMe → 带外管理网络 → 确认。
- **新建 vGPU 集群（托管 K8s）**：K8s 版本（CKS 风格）/ 节点池 / GPU 切片策略（MIG）→ 节点数 → 网络/存储 → 确认。
- **新建 推理服务**：模型（`models`）/ 节点池 / 副本与资源规格 / 端口与鉴权 → 确认。
- **部署向导（RunPod 风格）**：四类共用分步向导：① 选择节点池/GPU → ② 选择镜像/模型 → ③ 配置规格（GPU 数、vCPU、内存、存储）→ ④ 网络与端口 → ⑤ 环境变量/启动命令 → ⑥ 确认与价格预估。末步给出价格预估并触发创建。
- **下单产物**：向导提交生成 `deployment_orders`（**工作项**，`status` 即任务状态），随后异步映射为 `resources`（§5）。

### 4.3 资源 Resources（独立展示菜单）

创建完成后所有资源实例的**唯一归属与详情空间**。按**资源类型**分 4 类，每类独立列表 + 独立详情页（强制见 §5、§6）。**不设"按场景"二级菜单**。

#### 4.3.1 GPU 云服务器 GPU Cloud Server（资源类型 ①，`kind='gpu_vm'`）

- 列表：名称、区域、节点池、GPU 规格与数量、状态、`$/时`、操作（启动/停止/控制台/删除）。
- **详情页**（独立）：概览（规格/GPU 型号数量/vCPU/内存/存储/区域节点池/状态/实时费用）；**控制台**（AutoDL 风格：JupyterLab / Web Terminal / 文件管理器 / SSH 连接串）；监控（**指标集见 `MOCK-DATA.md` §6.2**：算力概览卡 / 按卡明细 / 主机资源 / 存储 / 网络 / 进程 TOP / 实时费用，含工作负载形态模板）；存储挂载/环境变量/镜像；**事件时间线**（`resource_events`，事件须携带度量快照，见 `MOCK-DATA.md` §9）；操作（启停/重置/删除，按角色可见）。

#### 4.3.2 GPU 裸金属 GPU Bare Metal（资源类型 ②，`kind='gpu_baremetal'`）

- 列表：机型、CPU、GPU 直通型号、本地 NVMe、状态、费用。
- **详情页**（独立）：概览（机型/CPU/GPU 直通/本地盘）；**硬件监控**（**指标集见 `MOCK-DATA.md` §6.3**：GPU 健康 ECC/Row-remap、PCIe 链路降级、NIC/InfiniBand、NVMe SMART、PSU 冗余、风扇散热、BMC 带外 SEL、固件与驱动版本）；带外管理（IPMI/控制台）；物理网络（网卡/InfiniBand）；事件时间线（同 `MOCK-DATA.md` §9）；操作（重启/重置/删除）。

#### 4.3.3 vGPU GPU Virtualization（资源类型 ③，托管 K8s，`kind='vgpu'`）

- 列表：集群名、K8s 版本、区域、节点池、节点数、GPU 总量/已分配、状态。
- **详情页**（独立）：集群概览与控制面健康（Mission Control 风格）；节点池明细与 GPU 切片（MIG/虚拟化）；工作负载（Namespace/Deployment/Pod）；网络（VPC/Ingress/InfiniBand）；存储（PVC）；拓扑视图（机架/交换机/NVL72 机柜级互联，数据来源 `resource_placements` → `gpu_nodes`）；**集群指标**（**见 `MOCK-DATA.md` §6.4**：控制面健康 apiserver/etcd P99、节点池 GPU 分配率、MIG 切片与 Time-Slicing、设备插件健康、工作负载 Pod phase 与调度失败原因 `Insufficient nvidia.com/gpu`、网络与 PVC）；事件时间线。

#### 4.3.4 推理服务 Inference Service（资源类型 ④，`kind='inference'`）

- 列表：服务名、模型、副本数、节点池、QPS、延迟 P50/P99、状态。
- **详情页**（独立，两个标签页）：
  - **实例管理**：副本详情、自动扩缩策略（HPA）、调用统计、令牌吞吐、延迟分布（P50/P90/P99）、灰度/版本（多版本流量切分）、日志与监控（**指标集见 `MOCK-DATA.md` §6.5**：采用 vLLM/SGLang 语义的 TTFT / TPOT / E2E 延迟 / QPS / running·waiting·swapped 请求 / KV cache 使用率 / 前缀缓存命中率、4xx/5xx 错误率，以及 Modal 风格的结构化逐行日志）。
  - **服务治理（Serving）**：发布为在线端点（Endpoints）、推理网关（鉴权/限流/灰度）、基于 QPS/延迟的弹性策略；通过「发布为服务」动作生成。
- **计费口径**：推理服务按 **GPU·小时** 计费，**不按调用量/令牌计费**（v1）；QPS/延迟仅用于服务治理观测（见 §7.1）。

### 4.4 集群 Cluster（辅助：供给侧）

- **节点池 Node Pools**：5 种池，按区域展示容量、可用/已分配、单价（`node_pools`）。支持 Vast.ai 风格筛选器（GPU 型号、区域、单价、可靠性、空闲量比价）。
- **节点 Nodes**：单节点视图（`gpu_nodes`），含**状态机**（5 态）、拓扑位置（机架/交换机组）、straggler 标记。
- **调度与拓扑 Scheduling & Topology**：拓扑感知调度示意、机架拓扑图、goodput 展示（goodput 为时序指标，由 Mock/TSDB 提供，见 ARCH §12.8 边界声明）。**集群层指标见 `MOCK-DATA.md` §6.6**：节点故障按 NVIDIA Xid 标准判定（Xid 48/63/64/74/79 等与处置动作映射），训练效能按 MFU / HFU / goodput / step_time / straggler_ratio / 通信开销 / 数据加载停顿 / 节点可用性定义，且 goodput **必须可由 MFU 与可用性派生**（§7.6 公式）。
- **事件与维护 Events & Maintenance**：cordon / drain 操作记录（含操作人 `node_events.actor_user_id`）、维护窗口、Remediation 历史。

### 4.5 开发 Development（辅助：工具链）

- **Notebook / IDE**：托管开发环境（Jupyter/VS Code），可挂靠或创建于「资源·GPU 云服务器」（`notebooks.resource_id`）；运行态归资源菜单，开发模块只提供入口。
- **镜像商城 Image Marketplace**（优云智算风格）：官方/社区镜像卡片（`images`），一键用作 GPU 云服务器/推理服务基础。
- **AI 应用模板 App Templates**：一键部署的 AI 应用（`app_templates`），表单化参数后落地到某类资源。

### 4.6 数据 Data

- **数据集 Datasets**（`datasets`）：上传/注册/版本化。
- **对象存储 Object Storage**（`buckets`/`objects`）：桶与对象浏览（前端 Mock 文件系统视图）。
- **数据预处理 Pipelines**（`pipelines`）：可视化 DAG 编排。

### 4.7 运营 Operations

- **监控 Monitoring**（Modal 风格）：全局与按资源的指标面板。
- **日志 Logs**：集中式日志检索（Elastic 风格过滤器）。
- **成本分析 Cost**：按 **项目 / 资源 / 区域** 的花费拆解（`billing_usage.project_id`、`resource_id`、`region`），预算预警。
- **配额 Quotas**：GPU / vCPU / 存储 / 公网 IP 水位（`quotas`，口径见 §7.3）。
- **工单 Tickets**：提交与跟踪（`tickets`，可关联 `resource_id`）。

### 4.8 模型库 Model Library

- 模型卡片（`models`：来源 HuggingFace 镜像 / 官方 / 社区），含基础信息、量化版本、适用场景、一键部署到推理服务/GPU 云服务器。
- 分类筛选（模态、参数量、许可）、搜索、收藏（`model_favorites`）。

### 4.9 资产 Assets

| 子项             | 数据来源（ARCH §12.4）                             | 说明                |
| -------------- | ------------------------------------------- | ----------------- |
| 计算资产 Compute   | `reservations` + `resources`（按格兰特有/持有）         | 持有的预留实例、包年包月权益     |
| 代金券 Vouchers   | `vouchers` + `voucher_redemptions`          | 面额、余额、适用范围、有效期     |
| 预留实例 Reserved  | `reservations`                              | 锁定价格的 GPU 配额       |
| 存储包 Storage Packs | `storage_packs`                             | 存储容量包（剩余容量/有效期）    |

---

## 5. GPU 资源全生命周期流转机制（强制约束）

> 强制约束：资源从部署中心购买后，**必须映射到四类资源类型之一**，并**呈现在「资源」菜单对应类型的列表与独立详情页**；且必须覆盖"购买完成后"的详情页首屏与状态展示逻辑，生命周期必须**可闭环**（含终止态）。

### 5.1 流转总览：选购 → 映射 → 呈现 → 运行 → 治理 → 回收

```
选购(部署中心·新建向导)  目标形态：GPU 云服务器 | GPU 裸金属 | vGPU | 推理服务
   │
   ▼
下单/购买   → deployment_orders(status='pending' → 'provisioning')   【工作项】
   │
   ▼
供给与映射  → resources(kind 归属四类之一, status='provisioning')
   │         resource_provisioning_steps（子任务进度）
   │         resource_placements（落到 node_pools / gpu_nodes / 机架 / 卡位）
   │         resource_events（事件写入）
   ▼
呈现       → 「资源」菜单对应类型列表 + 独立详情页    ← 强制：仅在此出现
   │
   ▼
运行与观测  → status='running'：监控 / 事件 / 计费起算（§7.4）
   │
   ▼
治理       → 推理：服务治理标签 / vGPU：工作负载·网络·存储 / GPU 云服务器：控制台
   │
   ▼
变更与回收  → 启停(stopped) / 扩缩 / 删除(terminating → deleted_at)
              ← 强制：terminating 为显式过渡态，deleted_at 为终态（§5.4）
```

### 5.2 类型映射规则（强制）

- 向导中选择的**目标形态**决定类型归属，资源**不可游离于四类之外**：
  - 「云服务器 / 持久算力 / 开发环境」→ **GPU 云服务器**
  - 「物理机直通 / 极致性能 / 无虚拟化」→ **GPU 裸金属**
  - 「托管 K8s 集群 / CKS / GPU 虚拟化切片」→ **vGPU**
  - 「模型服务 / 在线推理 / 端点」→ **推理服务**
- 映射完成后，资源**仅**在「资源」菜单对应类型下出现，**不**在部署中心、集群、开发、数据中重复陈列。
- 开发模块产物（Notebook、应用模板、镜像）必须经由"创建/购买"转化为四类之一，否则不计入资源清单。

#### 5.2.1 资源类型—路由—标识 **规范映射表**（单一事实来源，强制对齐）

| `resources.kind`（枚举/落库） | 路由段 `routeKey` | 显示名（UI） | `display_id` 前缀 | 类型色 Token                |
| ------------------------- | -------------- | --------- | --------------- | ------------------------ |
| `gpu_vm`                  | `servers`      | GPU 云服务器  | `srv-`          | `--rs-type-server`       |
| `gpu_baremetal`           | `baremetal`    | GPU 裸金属   | `bm-`           | `--rs-type-baremetal`    |
| `vgpu`                    | `vgpu`         | vGPU      | `vgpu-`         | `--rs-type-vgpu`         |
| `inference`               | `inference`    | 推理服务      | `inf-`          | `--rs-type-inference`    |

- 路由形如 `/resources/:routeKey`（列表）与 `/resources/:routeKey/:resourceUuid`（详情）。
- 任何新页面/组件引用类型都必须取本表同一份常量，**禁止再出现第二套命名**。

### 5.3 购买完成后：资源详情页展示逻辑（重点补全）

四类共用以下首屏与状态框架，再叠加各自专属区块。

1. **创建中 Provisioning**
   - 下单成功自动跳转详情页，路由 `/resources/:routeKey/:resourceUuid`（`resourceUuid` = `resources.resource_uuid`）。
   - 进度步骤来自 **`resource_provisioning_steps`**（`schedule → provision → attach_storage → ready`），每步含 `state(pending/running/done/failed)` 与时间；状态徽标 `Provisioning`（info 蓝）。
   - 镜像/模型拉取由 `step_key='pull_image'` 子步骤体现。
2. **就绪 Running（默认态）**
   - 概览：规格（GPU 型号/数量、vCPU、内存、存储）、区域/节点池、状态、运行时长（`running_since`）、实时费用 **`$/时`**（§7）。
   - 监控：GPU 利用率、显存占用、网络吞吐（实时追加）。
   - 访问/控制台：SSH 串 / Jupyter / Web Terminal（云服务器·裸金属）、端点 URL（推理服务）、kubeconfig / 控制台（vGPU）。
   - 关联资源：来源镜像/模型（`deployment_orders.source_type`+`source_ref_id`）、挂载存储、网络/VPC。
   - 事件时间线：`resource_events` 倒序。
   - 操作：启停 / 扩缩 / 删除（按角色可见）。
3. **异常 Error 与回退**
   - 供给失败进入 `Error`（danger 红），展示失败原因（`resource_events`）+「重试/工单」；重试语义：`order` 重新置 `provisioning` 并重建 steps；**不产生第二条作废 resource**（同一 order 幂等重试）。
4. **停止 Stopped**
   - 状态 muted；**算力费停计、仅计存储**（§7.4）；保留详情与数据，可重新启动。
5. **终止 Terminating / 已释放**
   - Terminating（石板灰）为过渡态，立即停计最后一小时按实际秒数结算；完成后软删（`deleted_at` 非空），从列表消失并可在「回收站/历史」（可选，v1 不实现）查看。
6. **状态语义色彩**：见 `DESIGN-SYSTEM.md` §8。

> 强制：任何资源的详情页都必须覆盖"创建中 → 就绪/异常 → 运行/停止 → 终止"；**禁止购买后无详情页、禁止停留在列表层、禁止没有终止态**。

### 5.4 资源生命周期状态机（闭环，强制）

```
        ┌──────────────┐
        │ Provisioning │◄───────────┐ (retry)
        └──────┬───────┘            │
   ready │     │ fail               │
         ▼     ▼                    │
   ┌──────────┐  ┌────────┐  stop   │
   │ Running  │─►│ Stopped │        │
   └────┬─────┘  └───┬────┘        │
        │            │ start        │
        │◄───────────┘              │
        │                            │
   stop │            ┌────────┐     │
        ├───────────►│  Error │─────┘
        │            └────┬───┘
        │                 │ terminate
terminate│                ▼
        │            ┌─────────────┐
        └───────────►│ Terminating │────► deleted_at 非空（终态/软删）
                     └─────────────┘
```

| 转移               | 事件          | 副作用                                          |
| ---------------- | ----------- | -------------------------------------------- |
| → provisioning   | 下单受理        | 写 `resource_provisioning_steps`、`resource_events` |
| provisioning → running | 供给完成    | 置 `running_since`；**算力+存储开始计量**（§7.4）         |
| provisioning → error | 供给失败     | 记 failure 事件；`deployment_orders.status='failed'` |
| running → stopped | 用户停止       | 算力停计、存储继续；释放 gpu/vcpu 配额，保留 storage 配额        |
| stopped → running | 用户启动       | 重新占配额；算力恢复计量                                  |
| running/stopped → terminating | 删除请求 | 立即停计，最后一小时按秒结算                                |
| terminating → (deleted) | 回收完成   | `deleted_at` 非空；释放全部配额                        |
| error → provisioning | 重试        | 复用同一 `deployment_orders`（幂等），重建 steps         |
| error → terminating | 放弃/清理     | 同上回收                                          |

### 5.5 ID 与标识规范（消除多套口径）

| 标识                | 用途                        | 是否落库/路由使用             |
| ----------------- | ------------------------- | --------------------- |
| `resources.id`（BIGINT） | **仅内部主键**，不对外暴露           | ❌ 不出接口/路由             |
| `resource_uuid`（UUID） | **对外 API 标识**，详情路由参数      | ✅ `/resources/:routeKey/:resourceUuid` |
| `display_id`（短码）    | **UI 展示/搜索/面包屑**，如 `srv-a1b2c3` | ✅ UI；⌘K 可按其搜索         |

- `display_id` = `<类型前缀><6位小写字母数字>`，前缀见 §5.2.1 表，全局唯一索引。
- 面包屑示例：`资源 / GPU 云服务器 / srv-a1b2c3`（统一采用 display_id 显示）。
- **禁止**再出现 `gpu-srv-0a1b` 之类未在规范中定义的 ID 写法。

### 5.6 跨空间联动（非重复陈列）

- **总览**：聚合四类资源的健康与花费（只读摘要）。
- **部署中心**：仅承载 4 类创建向导；创建完成后不陈列实例列表。
- **资源**（独立菜单）：资源实例唯一陈列与详情空间。
- **集群**：节点状态经 `node_events` 事件流影响租户资源可调度量与可用 GPU，但**不陈列租户资源实例**。
- **运营 / 数据**：监控、日志、成本、配额按资源维度检索，**不持有资源实例**。

---

## 6. 服务边界定义：集群 / 开发 作为辅助能力（强制约束）

### 6.1 定位结论

资源类型只有 **GPU 云服务器 / GPU 裸金属 / vGPU / 推理服务** 四类；资源实例统一归属「资源」独立菜单。**集群（Cluster）** 与 **开发（Development）** **不作为资源类型**，而是 GPU 资源使用的**辅助 / 使能能力**：集群 = 供给侧基础设施与节点运维层；开发 = 工具链与取用入口层。

### 6.2 集群（Cluster）边界

- **职责**：管理平台供给的 GPU 算力池与节点健康——节点池（5 类）、节点（5 态状态机）、拓扑感知调度、机架拓扑、cordon/drain、straggler 检测、goodput、维护事件（`node_pools`/`gpu_nodes`/`node_events`）。
- **不做什么**：**不**管理租户资源实例；**不**持有"用户购买的集群"列表（用户购买的 vGPU 集群是租户资源，归「资源·vGPU」）。
- **协同**：
  - 用户 vGPU 集群运行在集群提供的**节点池**之上（供给→消费），通过 `resource_placements.node_id → gpu_nodes` 关联。
  - 节点状态变化经 `node_events` 影响其上租户资源的可调度量，但资源实例仍在「资源」菜单呈现。
  - 命名区分：一级「集群」理解为"节点 / 基础设施"，避免与「资源·vGPU（托管 K8s）」混淆。

### 6.3 开发（Development）边界

- **职责**：取用与编排 GPU 资源的工具链——Notebook / IDE（`notebooks`）、镜像商城（`images`）、AI 应用模板（`app_templates`）。
- **不做什么**：**不**持有持久资源实例；Notebook 为轻量/临时入口（`notebooks.resource_id` 挂靠到已有云服务器）；镜像商城只分发镜像，不当作资源陈列；应用模板是"部署快捷方式"。
- **协同**：所有产物必须经"创建/购买"转化为四类之一（§5.2），并通过 `deployment_orders.source_type='image'|'template'|'notebook'` + `source_ref_id` 记录来源，保证可追溯（ARCH §13）。

### 6.4 边界总览

| 模块                               | 是否资源类型    | 角色                          | 协作落点                 |
| -------------------------------- | --------- | --------------------------- | -------------------- |
| 资源（GPU 云服务器 / 裸金属 / vGPU / 推理服务） | ✅ 是       | 资源归属与生命周期主场（独立菜单，4 类）      | 资源唯一陈列空间             |
| 部署中心                             | ❌ 否（创建入口） | 4 类资源部署向导，产出 `deployment_orders` | 创建后映射并跳转「资源」         |
| 集群 Cluster                       | ❌ 否       | 辅助：供给侧节点 / 基础设施运维          | 为 vGPU 资源提供底层算力，状态联动 |
| 开发 Development                   | ❌ 否       | 辅助：工具链与取用入口                | 产物转为「资源」，来源可追溯       |
| 数据 / 运营                          | ❌ 否       | 横向支撑（存储 / 监控 / 成本 / 配额 / 工单） | 按资源维度检索，不持有实例        |

### 6.5 后端数据模型约束（强制）

> 落地后端必须建立下列数据模型，**字段与关系真实可用**（不可占位）；完整 DDL 见 `ARCHITECTURE.md` §12；前端 Mock 实体结构须与之对齐，切换真实后端零改动。

| 组                    | 必须表                                                                                                        | 对应本文档    |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| **identity**         | `plans`、`orgs`、`users`、`projects`、`project_members`                                                          | §3、§7.2、§8 |
| **deployment（资源映射）** | `deployment_orders`、`resources`、`resource_placements`、`resource_events`、`resource_provisioning_steps`       | §5        |
| **supply（供给侧）**      | `node_pools`、`gpu_nodes`、`node_events`                                                                       | §4.4、§9   |
| **billing**          | `billing_rates`、`billing_usage`、`invoices`、`billing_transactions`、`vouchers`、`voucher_redemptions`、`reservations`、`storage_packs`、`quotas` | §7        |
| **content / 支撑**     | `models`、`model_favorites`、`images`、`app_templates`、`notebooks`、`datasets`、`buckets`、`objects`、`pipelines`、`tickets`、`notifications` | §4.5–§4.9 |

> **边界声明**：GPU 利用率 / goodput / QPS / 延迟等**时序指标**不落 PostgreSQL，由时序库或 Mock 提供（ARCH §12.8）；`billing_usage` 只存计费聚合量。

---

## 7. 计费、套餐与配额规则（强制）

### 7.1 计费模型

- **计价对象**：4 类资源**统一按 GPU·小时**（`unit='per_gpu_hour'`）计量：`quantity = gpu_count × 运行时长(小时)`。
- **推理服务**：v1 **不按调用量/令牌计费**（其 QPS/令牌吞吐仅用于服务治理观测），与其余三类口径一致 → 避免单价模型分裂。
- **存储**：数据盘按 **GB·小时**（`unit='per_gb_hour'`），`running` 与 `stopped` 均计。
- **保留单位**：`per_instance_hour` **保留为扩展单位，v1 不启用**（不得在 v1 定价中出现）。
- **单价来源**：`billing_rates(resource_kind, node_pool, region, unit, 有效期)`；取价规则 = 结算时刻落在 `[effective_from, effective_to)` 区间的**最新**记录。
- **币种与精度**：**USD 为唯一计价币种**（`currency CHAR(3) DEFAULT 'USD'`）；用量金额 `NUMERIC(14,4)`，账单/余额 `NUMERIC(14,2)`（四舍五入到分）。UI 按 locale 格式化展示，**不做实时汇率换算**。
- **金额公式**：`amount = quantity × unit_price`；`billing_usage.amount` 为**定价后的不可变快照**（防止改价追溯污染历史账单）。

### 7.2 套餐（Plans）

| code         | 免费额度（首次）             | 成员上限  | 支持级别      | 说明                 |
| ------------ | -------------------- | ----- | --------- | ------------------ |
| `free`       | `$10` 一次性试用额度        | 3     | 社区        | org 创建时发放**一次**     |
| `standard`   | 无                    | 20    | 工单        | 默认按需，无承诺折扣        |
| `enterprise` | 合同金额（承诺消费）           | 不限    | 专属/TAM    | 折扣走 `billing_rates` 或合同价 |

- 免费额度发放方式：一笔 `billing_transactions(type='credit', reference_type='plan_signup')` 入账并同步 `orgs.credit_balance` → **可追溯、可对账**。
- 升降级规则见 §7.6。

### 7.3 配额（Quotas）

- **维度**：`quota_metric ∈ {gpu, vcpu, storage_gb, public_ip}`；作用域 `(org_id, resource_kind?, region?)`，`NULL` 表示不限该维度。
- **占用口径（明确，避免歧义）**：
  - `gpu` / `vcpu`：**占用于** `status ∈ {provisioning, running}`；`stopped` **释放**算力配额。
  - `storage_gb`：**占用于** `status ∈ {provisioning, running, stopped}`（数据盘保留）。
  - `terminating` / `deleted_at` 非空：**全部释放**。
- **超限**：新建时若 `used_value + 请求量 > limit_value`，`deployment_orders.status='failed'`（附加 reason=`QUOTA_EXCEEDED`），UI 提示配额不足并引导提额工单（`tickets`）。
- `quotas.used_value` 为**派生值**，由定时任务按上述口径重算，避免双写不一致。

### 7.4 计量触发点（与生命周期严格挂钩）

| resource 状态       | 算力费（per_gpu_hour） | 存储费（per_gb_hour） | 说明                     |
| ----------------- | ------------------ | ----------------- | ---------------------- |
| `provisioning`    | ❌ 不计               | ❌ 不计              | 供给未就绪不计费               |
| `running`         | ✅ 计                | ✅ 计               | 起算点 `running_since`    |
| `stopped`         | ❌ 不计               | ✅ 计               | 保留数据盘                  |
| `error`           | ❌ 不计               | ✅ 计               | 数据仍在，不计算力             |
| `terminating`     | ❌ 立即停计             | ❌ 立即停计            | 最后一小时按实际秒数比例结算          |
| `deleted_at` 非空   | ❌ 不计               | ❌ 不计              | 已释放                    |

- **聚合节奏**：billing 服务每整点汇总上一小时用量写 `billing_usage`；不足整小时按实际秒数折算：`quantity = gpu_count × 3600⁻¹ × 秒数`。
- **幂等**：`UNIQUE (resource_id, usage_hour, unit)` 唯一索引，防止重复计量/重复扣费。

### 7.5 账单与扣费

- **实时客帐（主路径）**：每小时聚合后生成 `billing_transactions(type='charge')` 负向扣减 `orgs.credit_balance`（同一事务更新余额），并记录 `balance_after`。
- **月结对账单（凭证）**：自然月账期（`billing_period = 月初日期`，UTC+0）结束后汇总该期 `billing_usage` 生成 `invoices`；**invoice 只是账单凭证，不是二次扣费**（避免重复收费逻辑冲突）。
- **发票状态**：`open → paid`（余额/外部支付结清）；到期未付 `overdue`；作废 `void`。
- **预警**：`orgs.low_balance_threshold_usd`（默认 `$50`）触发通知 + 状态栏琥珀提示。

### 7.6 计费边界（额度、超限、升降级、退款）

- **免费额度**：仅 org 创建首次发放一次；**不可提现、不可转赠**；在结算时先于现金抵扣。
- **余额不足/超限（明确处置链）**：
  1. 低于阈值 → 状态栏琥珀 + `notifications` 预警；
  2. **立即限制新建**（新的 `deployment_orders` 直接 failed，避免欠费扩大）；
  3. 宽限 **24h**，存量资源继续运行；
  4. 宽限到期仍未补足 → 存量资源**自动 Stopped**（保留数据、停算力费）；
  5. 再 **7 天**未补足 → 进入 `terminating` 释放。
- **停止/删除**：停止仅**停算力费**，存储继续计费（见 §7.4）；删除/终止前的最后一小时按实际秒数结算，**不留尾计费**。
- **退款**：
  - **已消耗用量不退**（已按小时/GB·小时结算）。
  - 供给失败或未进入 `running` 的小时**不结算**；若已误扣，用 `type='adjustment'` 反向冲正。
  - 人工/协商退款走 `type='refund'`，**优先返还代金券**（原券未过期时），其次现金。
  - 退款必须写 `reference_type/reference_id`，可追溯到 invoice 或 usage。
- **升降级（套餐）**：
  - 升级：**立即生效**，按剩余天数比例补差价（proration）。
  - 降级：**下一账期生效**，已享折扣不追溯退还。
  - 免费额度**不因升降级重复发放**。

### 7.7 代金券与预留实例

- **代金券 `vouchers`**：面额/余额/适用 `resource_kind`/`region`/有效期；结算时**优先消耗最先到期**的券；抵扣关系写入 `voucher_redemptions(voucher_id → invoice_id, amount)`，保证可追溯。
- **预留实例 `reservations`**：锁定 `(region, node_pool, gpu_count, 起止时间, 承诺单价)`；有效期内**覆盖额度内的用量按预留价**结算，超出部分按按需单价；**未开始可全额退**，**已开始不退预留费**（算力仍按预留价结算）。
- **资产模块读取口径**：计算资产 = `reservations` + 持有中的资源权益；代金券 = `vouchers`；预留实例 = `reservations`；存储包 = `storage_packs`（剩余容量/到期）。

---

## 8. 身份与角色（统一口径）

| 角色（`users.role` 枚举） | 可见/可操作范围                                  |
| ------------------- | ----------------------------------------- |
| `owner`             | 全部，含计费主体、组织与成员管理、删除资源                     |
| `admin`             | 除计费主体外的全部 + 用户/配额/工单管理                    |
| `member`            | 部署中心、资源（创建/启停/扩缩/控制台）、开发、数据、监控            |
| `billing`           | 资产、成本分析、发票、代金券/预留；资源**只读**（不可删除/启停）       |
| `viewer`            | 全部页面**只读**                               |

- 前端 `lib/rbac.ts` 依据角色计算菜单与危险操作（删除/扩缩/cordon/drain）的可见性与禁用态；**RBAC 仅做体验优化，真实鉴权以后端为准**。
- **禁止再出现"Dev"等第二套角色命名**；本文 §3、ARCH §4.2、`users.role` 枚举三处必须一致。

---

## 9. GPU 节点池与状态机规范

### 9.1 节点池（5 类）— 命名映射

| `node_pools.code`（落库） | 显示名（UI）      | 典型形态                  | 说明           |
| -------------------- | ----------- | --------------------- | ------------ |
| `H100_SXM`           | H100 SXM    | 8×H100 SXM5 / 节点      | 主流算力         |
| `H200_NVL`           | H200 NVL    | H200 NVL 互联           | 大显存推理/训练     |
| `B200_NVL72`         | B200 NVL72  | NVL72 机柜级             | 新一代大集群       |
| `B300`               | B300        | B300 单卡/节点            | 下一代算力        |
| `GB300_NVL72`        | GB300 NVL72 | Grace+Blackwell NVL72 | CPU+GPU 超级芯片 |

### 9.2 区域（4 个）— 命名映射

| `region_code` | 显示名 | ISO |
| ------------- | --- | --- |
| `jp`          | 日本  | JP  |
| `th`          | 泰国  | TH  |
| `sg`          | 新加坡 | SG  |
| `us`          | 美国  | US  |

### 9.3 节点状态机（5 态）

```
        ┌─────────┐
        │  Ready  │◄───────────────┐
        └────┬────┘                │
   cordon    │              remediate / uncordon
        ▼    │                     │
   ┌──────────────┐    ┌──────────────┐
   │  Cordoned    │    │ Remediation  │
   │(禁止新调度)  │    │(自愈/修复中) │
   └──────┬───────┘    └──────┬───────┘
     drain│                   │ fixed
          ▼                   │
   ┌──────────────┐           │
   │  Draining    │           │
   │(驱逐负载中)  │           │
   └──────┬───────┘           │
     evicted│                 │
          ▼                   │
   ┌──────────────┐           │
   │  NotReady    │───────────┘ (rejoin)
   │(失联/异常)   │
   └──────────────┘
```

- **Ready** 可调度 / **Cordoned** 禁止新调度 / **Draining** 驱逐中 / **Remediation** 自愈修复中 / **NotReady** 异常不可调度。
- 每次转移写 `node_events`（含 `actor_user_id` 与原因），保证运维可追溯。
- 状态语义色彩映射见 `DESIGN-SYSTEM.md` §8。

---

## 10. 非功能性需求

- **性能**：路由级代码分割；列表虚拟滚动；图表按需渲染。
- **可访问性**：WCAG 2.1 AA 对比度；键盘可达；状态不只靠颜色（图标/文本）。
- **响应式**：≥1280 双栏工作台；平板抽屉导航；移动端核心查看。
- **国际化**：文案走 i18n，不硬编码；**金额统一按 USD + locale 格式化**（不做汇率换算）。
- **安全（前端）**：鉴权态存内存+短期 token；敏感操作二次确认；不向前端暴露密钥。

---

## 11. 范围与边界

- ✅ 本次交付：四份设计文档（PRD / ARCHITECTURE / DESIGN-SYSTEM / **MOCK-DATA**）+ 评审报告；前端可交互原型（如需）所需的组件/路由/Mock 约定。
- ✅ Mock 数据受 `MOCK-DATA.md` 约束：真实值口径、单位与精度、状态自洽、派生公式、假数据红旗清单（原文 §1、§7、§12）。
- ❌ 本次不做：任何后端服务、数据库建表与迁移、真实鉴权与计费的实现。
- 🔜 后端蓝图（仅供参考，不在本次实现）：PostgreSQL 主存储，数据模型与 API 风格见 `ARCHITECTURE.md` §12；**时序监控指标**不落 PG，切换真实后端时的接口隔离见 `MOCK-DATA.md` §11。

---

## 12. 验收清单（设计层面）

- [ ] 导航覆盖「总览 / 部署中心（4 类向导）/ 资源（4 类独立菜单，无"按场景"）/ 集群 / 开发 / 数据 / 运营 / 模型库 / 资产」。
- [ ] 四类资源在「资源」菜单均有独立列表与独立详情页；命名与 §5.2.1 映射表一致。
- [ ] 资源从部署中心创建后映射到四类之一并呈现于「资源」菜单，部署中心不重复陈列（§5.2）。
- [ ] 生命周期可闭环：`provisioning → running/stopped/error → terminating → deleted_at`，并与 §7.4 计量挂钩（§5.4）。
- [ ] ID 口径唯一：`routeUuid`、内部 `id` 不出接口、`display_id` 仅展示/搜索（§5.5）。
- [ ] 角色三处一致（本文 §8 / ARCH §4.2 / `users.role` 枚举），无"Dev"等第二套命名。
- [ ] 币种全局统一 USD，无遗留 `¥` 表述（§7.1）。
- [ ] 计费完整性：免费额度/计量触发点/扣费路径/超限处置链/升降级与退款规则齐备（§7）。
- [ ] 资产、配额、工单、通知、事件时间线、进度步骤、镜像/模型/模板来源均有对应数据模型（§6.5）。
- [ ] 节点池 5 类、区域 4 个、节点状态机 5 态在集群模块完整呈现。
- [ ] 顶部全局条与顶部状态栏按 §3.1 / §3.2 与 DESIGN §5.16 / §5.17 实现。
- [ ] 全部页面基于 React 19 + TypeScript 5，数据来自 Mock 层；Mock 开关键符合 ARCH §12.7 环境变量约定。
- [ ] **Mock 数据合规**：通过 `MOCK-DATA.md` §12 全部验收项——硬件规格可核对、单位统一、无常理红旗（显存超容量 / P99<P50 / stopped 有运行指标等）、金额与费用均由 §7.1 公式派生、每个非 Ready 节点有 Xid 事件、每条事件携带 before/after 度量、`?fault=*` 六场景可触发且自愈（§12）。
- [ ] 设计符合 `DESIGN-SYSTEM.md` Token、组件与交叉引用规范。
