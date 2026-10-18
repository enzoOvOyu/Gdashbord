// 路由表（ARCH §4.1；详情路由参数统一为 resourceUuid）
// 路由级代码分割（PRD §10 性能）。
import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ConsoleLayout } from './layouts/ConsoleLayout';
import ComingSoon from '../components/ComingSoon';

const OverviewPage = lazy(() => import('../features/overview/OverviewPage'));
const ResourceListPage = lazy(() => import('../features/resources/ResourceListPage'));
const ResourceDetailPage = lazy(() => import('../features/resources/ResourceDetailPage'));
const NodePoolsPage = lazy(() => import('../features/cluster/NodePoolsPage'));
const NodesPage = lazy(() => import('../features/cluster/NodesPage'));
const TopologyPage = lazy(() => import('../features/cluster/TopologyPage'));
const EventsPage = lazy(() => import('../features/cluster/EventsPage'));
const NotebooksPage = lazy(() => import('../features/development/NotebooksPage'));
const ImagesPage = lazy(() => import('../features/development/ImagesPage'));
const AppTemplatesPage = lazy(() => import('../features/development/AppTemplatesPage'));
const DatasetsPage = lazy(() => import('../features/data/DatasetsPage'));
const StoragePage = lazy(() => import('../features/data/StoragePage'));
const PipelinesPage = lazy(() => import('../features/data/PipelinesPage'));
const MonitoringPage = lazy(() => import('../features/operations/MonitoringPage'));
const LogsPage = lazy(() => import('../features/operations/LogsPage'));
const CostPage = lazy(() => import('../features/operations/CostPage'));
const QuotasPage = lazy(() => import('../features/operations/QuotasPage'));
const TicketsPage = lazy(() => import('../features/operations/TicketsPage'));
const ModelLibraryPage = lazy(() => import('../features/model-library/ModelLibraryPage'));
const ComputeAssetsPage = lazy(() => import('../features/assets/ComputeAssetsPage'));
const VouchersPage = lazy(() => import('../features/assets/VouchersPage'));
const ReservationsPage = lazy(() => import('../features/assets/ReservationsPage'));
const StoragePacksPage = lazy(() => import('../features/assets/StoragePacksPage'));
const DeploymentWizard = lazy(() => import('../features/deployment/DeploymentWizard'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ConsoleLayout />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: 'overview', element: <OverviewPage /> },

      // 部署中心（创建入口，4 类向导共用同一路由参数 PRD §4.2）
      { path: 'deployment/:kind', element: <DeploymentWizard /> },

      // 资源（独立展示菜单，4 类：列表 + 详情）
      { path: 'resources/:routeKey', element: <ResourceListPage /> },
      { path: 'resources/:routeKey/:resourceUuid', element: <ResourceDetailPage /> },

      // 集群（辅助：供给侧）
      { path: 'cluster/pools', element: <NodePoolsPage /> },
      { path: 'cluster/nodes', element: <NodesPage /> },
      { path: 'cluster/topology', element: <TopologyPage /> },
      { path: 'cluster/events', element: <EventsPage /> },

      // 开发（辅助：工具链）
      { path: 'development/notebooks', element: <NotebooksPage /> },
      { path: 'development/images', element: <ImagesPage /> },
      { path: 'development/apps', element: <AppTemplatesPage /> },

      // 数据
      { path: 'data/datasets', element: <DatasetsPage /> },
      { path: 'data/storage', element: <StoragePage /> },
      { path: 'data/pipelines', element: <PipelinesPage /> },

      // 运营
      { path: 'operations/monitoring', element: <MonitoringPage /> },
      { path: 'operations/logs', element: <LogsPage /> },
      { path: 'operations/cost', element: <CostPage /> },
      { path: 'operations/quotas', element: <QuotasPage /> },
      { path: 'operations/tickets', element: <TicketsPage /> },

      // 模型库 / 资产
      { path: 'model-library', element: <ModelLibraryPage /> },
      { path: 'assets/compute', element: <ComputeAssetsPage /> },
      { path: 'assets/vouchers', element: <VouchersPage /> },
      { path: 'assets/reserved', element: <ReservationsPage /> },
      { path: 'assets/storage', element: <StoragePacksPage /> },

      { path: '*', element: <ComingSoon title="页面不存在" /> },
    ],
  },
]);
