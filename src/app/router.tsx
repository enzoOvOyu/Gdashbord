// 路由表（ARCH §4.1；详情路由参数统一为 resourceUuid）
// 路由级代码分割（PRD §10 性能）；未实现页面先用占位，保持导航完整。
import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ConsoleLayout } from './layouts/ConsoleLayout';
import ComingSoon from '../components/ComingSoon';

const OverviewPage = lazy(() => import('../features/overview/OverviewPage'));
const ResourceListPage = lazy(() => import('../features/resources/ResourceListPage'));
const ResourceDetailPage = lazy(() => import('../features/resources/ResourceDetailPage'));
const NodePoolsPage = lazy(() => import('../features/cluster/NodePoolsPage'));
const NodesPage = lazy(() => import('../features/cluster/NodesPage'));
const ModelLibraryPage = lazy(() => import('../features/model-library/ModelLibraryPage'));
const ImagesPage = lazy(() => import('../features/development/ImagesPage'));
const CostPage = lazy(() => import('../features/operations/CostPage'));
const QuotasPage = lazy(() => import('../features/operations/QuotasPage'));
const VouchersPage = lazy(() => import('../features/assets/VouchersPage'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ConsoleLayout />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: 'overview', element: <OverviewPage /> },

      // 部署中心（创建入口，4 类向导）
      { path: 'deployment/server', element: <ComingSoon title="新建 GPU 云服务器" /> },
      { path: 'deployment/baremetal', element: <ComingSoon title="新建 GPU 裸金属" /> },
      { path: 'deployment/vgpu', element: <ComingSoon title="新建 vGPU 集群（托管 K8s）" /> },
      { path: 'deployment/inference', element: <ComingSoon title="新建 推理服务" /> },

      // 资源（独立展示菜单，4 类：列表 + 详情）
      { path: 'resources/:routeKey', element: <ResourceListPage /> },
      { path: 'resources/:routeKey/:resourceUuid', element: <ResourceDetailPage /> },

      // 集群（辅助）
      { path: 'cluster/pools', element: <NodePoolsPage /> },
      { path: 'cluster/nodes', element: <NodesPage /> },
      { path: 'cluster/topology', element: <ComingSoon title="调度与拓扑" /> },
      { path: 'cluster/events', element: <ComingSoon title="事件与维护" /> },

      // 开发（辅助）
      { path: 'development/notebooks', element: <ComingSoon title="Notebook / IDE" /> },
      { path: 'development/images', element: <ImagesPage /> },
      { path: 'development/apps', element: <ComingSoon title="AI 应用模板" /> },

      // 数据
      { path: 'data/datasets', element: <ComingSoon title="数据集" /> },
      { path: 'data/storage', element: <ComingSoon title="对象存储" /> },
      { path: 'data/pipelines', element: <ComingSoon title="数据预处理" /> },

      // 运营
      { path: 'operations/monitoring', element: <ComingSoon title="监控" /> },
      { path: 'operations/logs', element: <ComingSoon title="日志" /> },
      { path: 'operations/cost', element: <CostPage /> },
      { path: 'operations/quotas', element: <QuotasPage /> },
      { path: 'operations/tickets', element: <ComingSoon title="工单" /> },

      // 模型库 / 资产
      { path: 'model-library', element: <ModelLibraryPage /> },
      { path: 'assets/compute', element: <ComingSoon title="计算资产" /> },
      { path: 'assets/vouchers', element: <VouchersPage /> },
      { path: 'assets/reserved', element: <ComingSoon title="预留实例" /> },
      { path: 'assets/storage', element: <ComingSoon title="存储包" /> },

      { path: '*', element: <ComingSoon title="页面不存在" /> },
    ],
  },
]);
