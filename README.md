# Gdashboard — GPU 云控制台

参考 RunPod / AutoDL / Vast.ai / 优云智算 / Modal 设计的 GPU 云算力控制台。

## 技术栈

- **后端**：Node.js 22 + Express（端口 8080，REST API + 托管前端静态文件）
- **前端**：Vue 3 + Vite 6 + Element Plus + ECharts
- 全部依赖安装在项目目录内（`node_modules`），不影响服务器其他项目

## 设计参考要点

| 平台 | 借鉴点 |
|------|--------|
| RunPod | GPU 选购卡片（型号/VRAM/时价/云类型标签）、三步部署向导（GPU→镜像→配置确认） |
| AutoDL | 实例控制台（六色状态、无卡模式开机、保存镜像、JupyterLab/SSH 连接、存储进度条） |
| Vast.ai | 市场复杂筛选（显存/价格/地域/云类型）+ 性价比排序（DLPerf/价格） |
| 优云智算 | 镜像商城、AI 应用一键部署 |
| Modal | 监控中心（5s 级实时指标曲线 + 深色流式日志查看器） |

## 目录结构

```
gdashboard/
├── server/          # Express 后端 + Mock 数据
│   ├── index.js     # API 路由 + 静态托管
│   └── data.js      # 种子随机 Mock 数据（GPU/实例/账单/公告）
└── client/          # Vue 3 前端
    └── src/
        ├── layouts/MainLayout.vue   # 顶栏 + 侧边栏
        └── views/                   # Dashboard/市场/创建/实例/监控/镜像/费用
```

## 本地开发

```bash
npm run install:all   # 安装后端 + 前端依赖
npm run dev:server    # 后端 :8080
npm run dev:client    # 前端 :5174（代理 /api -> :8080）
```

## 生产部署

```bash
npm run install:all
npm run build         # 构建前端到 client/dist
npm start             # 单端口 8080 承载 API + 前端
```

## API 一览

- `GET  /api/overview?range=7`     Dashboard 聚合数据
- `GET  /api/gpus?minVram=&maxPrice=&region=&cloudType=&sort=`  GPU 市场
- `GET  /api/instances`            实例列表
- `POST /api/instances`            创建实例
- `POST /api/instances/:id/action` 开机/关机/无卡模式/重启/释放
- `GET  /api/instances/:id/metrics` 实时监控指标
- `GET  /api/instances/:id/logs`   实例日志
- `GET  /api/images?category=`     镜像商城
- `GET  /api/billing`              费用中心
