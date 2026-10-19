// 路由表（ARCH §4.1；详情路由参数统一为 resourceUuid）
// v0.6：集群 + 运营 合并为「运营&运维 /ops/*」；删除调度与拓扑页、运营·监控页、模型库一级菜单。
// 路由级代码分割（PRD §10 性能）。
import { t } from '../i18n';
import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ConsoleLayout } from './layouts/ConsoleLayout';
import ComingSoon from '../components/ComingSoon';

const OverviewPage = lazy(() => import('../features/overview/OverviewPage'));
const ResourceListPage = lazy(() => import('../features/resources/ResourceListPage'));
const ResourceDetailPage = lazy(() => import('../features/resources/ResourceDetailPage'));
const NodePoolsPage = lazy(() => import('../features/ops/NodePoolsPage'));
const NodesPage = lazy(() => import('../features/ops/NodesPage'));
const EventsPage = lazy(() => import('../features/ops/EventsPage'));
const LogsPage = lazy(() => import('../features/ops/LogsPage'));
const CostPage = lazy(() => import('../features/ops/CostPage'));
const QuotasPage = lazy(() => import('../features/ops/QuotasPage'));
const TicketsPage = lazy(() => import('../features/ops/TicketsPage'));
// A 档整页详情（§3.4：行 → Drawer → 整页）
const NodePoolsDetailPage = lazy(() => import('../features/ops/NodePoolsDetailPage'));
const NodesDetailPage = lazy(() => import('../features/ops/NodesDetailPage'));
const TicketsDetailPage = lazy(() => import('../features/ops/TicketsDetailPage'));
const NotebooksPage = lazy(() => import('../features/workbench/NotebooksPage'));
const ImagesPage = lazy(() => import('../features/workbench/ImagesPage'));
const AppTemplatesPage = lazy(() => import('../features/workbench/AppTemplatesPage'));
const DatasetsPage = lazy(() => import('../features/data/DatasetsPage'));
const StoragePage = lazy(() => import('../features/data/StoragePage'));
const PipelinesPage = lazy(() => import('../features/data/PipelinesPage'));
const ComputeAssetsPage = lazy(() => import('../features/assets/ComputeAssetsPage'));
const VouchersPage = lazy(() => import('../features/assets/VouchersPage'));
const ReservationsPage = lazy(() => import('../features/assets/ReservationsPage'));
const StoragePacksPage = lazy(() => import('../features/assets/StoragePacksPage'));
const DeploymentWizard = lazy(() => import('../features/deployment/DeploymentWizard'));
// v0.7 工作台·弹性伸缩（PRD §4.5.2）
const ScalingPage = lazy(() => import('../features/workbench/ScalingPage'));
// v0.7 运营&运维·项目（PRD §3.5 / §4.4.1）
const ProjectsPage = lazy(() => import('../features/ops/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('../features/ops/ProjectDetailPage'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ConsoleLayout />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: 'overview', element: <OverviewPage /> },

      // 部署中心（创建入口，四类各自独立向导 §4.2）
      { path: 'deployment/:kind', element: <DeploymentWizard /> },

      // 资源（独立展示菜单，4 类：列表 + 详情）
      { path: 'resources/:routeKey', element: <ResourceListPage /> },
      { path: 'resources/:routeKey/:resourceUuid', element: <ResourceDetailPage /> },

      // 运营&运维（原集群 + 原运营合并；拓扑仅作为 vGPU 详情页子区块，不设独立页）
      // v0.7：项目自用户菜单迁入运营&运维首项（PRD §3.5 / §4.4.1）
      { path: 'ops/projects', element: <ProjectsPage /> },
      { path: 'ops/projects/:id', element: <ProjectDetailPage /> },
      { path: 'ops/pools', element: <NodePoolsPage /> },
      { path: 'ops/pools/:code', element: <NodePoolsDetailPage /> },
      { path: 'ops/nodes', element: <NodesPage /> },
      { path: 'ops/nodes/:nodeUid', element: <NodesDetailPage /> },
      { path: 'ops/events', element: <EventsPage /> },
      { path: 'ops/logs', element: <LogsPage /> },
      { path: 'ops/cost', element: <CostPage /> },
      { path: 'ops/quotas', element: <QuotasPage /> },
      { path: 'ops/tickets', element: <TicketsPage /> },
      { path: 'ops/tickets/:id', element: <TicketsDetailPage /> },

      // v0.7：「开发（辅助）」更名「工作台 Workbench」（PRD §4.5）；旧 /development/* 重定向
      { path: 'development/*', element: <Navigate to="/workbench/notebooks" replace /> },
      { path: 'workbench/notebooks', element: <NotebooksPage /> },
      { path: 'workbench/images', element: <ImagesPage /> },
      { path: 'workbench/apps', element: <AppTemplatesPage /> },
      { path: 'workbench/scaling', element: <ScalingPage /> },

      // 数据
      { path: 'data/datasets', element: <DatasetsPage /> },
      { path: 'data/storage', element: <StoragePage /> },
      { path: 'data/pipelines', element: <PipelinesPage /> },

      // 资产
      { path: 'assets/compute', element: <ComputeAssetsPage /> },
      { path: 'assets/vouchers', element: <VouchersPage /> },
      { path: 'assets/reserved', element: <ReservationsPage /> },
      { path: 'assets/storage', element: <StoragePacksPage /> },

      { path: '*', element: <ComingSoon title={t('err.pageNotFound')} /> },
    ],
  },
]);
