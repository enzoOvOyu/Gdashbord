// 部署向导分发器（PRD §4.2：四类资源各有独立流程，禁止共用一套表单）
// 路由 /deployment/:kind → 对应向导；按 kind 懒加载，减少首屏体积。
import { Suspense, lazy, type ComponentType } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import type { ResourceKind } from '../../types/domain';
import { ui as s, Card, EmptyState } from '../../components/ui';
import { KIND_META, KIND_ICON } from '../../lib/ids';
import { canCreateResource } from '../../lib/rbac';
import { useAuthStore } from '../../stores/auth';

const GpuVmWizard = lazy(() => import('./GpuVmWizard'));
const BareMetalWizard = lazy(() => import('./BareMetalWizard'));
const VgpuWizard = lazy(() => import('./VgpuWizard'));
const InferenceWizard = lazy(() => import('./InferenceWizard'));

const WIZARDS: Record<ResourceKind, ComponentType> = {
  gpu_vm: GpuVmWizard,
  gpu_baremetal: BareMetalWizard,
  vgpu: VgpuWizard,
  inference: InferenceWizard,
};

/** 路由段 / 侧边栏别名 → ResourceKind（与 KIND_META.routeKey 单一映射） */
const ROUTE_ALIAS: Record<string, ResourceKind> = {
  server: 'gpu_vm',
  servers: 'gpu_vm',
  gpu_vm: 'gpu_vm',
  baremetal: 'gpu_baremetal',
  gpu_baremetal: 'gpu_baremetal',
  vgpu: 'vgpu',
  inference: 'inference',
};

function mapRouteToKind(seg: string): ResourceKind | null {
  const direct = (Object.keys(KIND_META) as ResourceKind[]).find(
    (k) => KIND_META[k].routeKey === seg,
  );
  return ROUTE_ALIAS[seg] ?? direct ?? null;
}

export default function DeploymentWizard() {
  const { kind: kindParam } = useParams<{ kind: string }>();
  const role = useAuthStore((st) => st.role);
  const kind = mapRouteToKind(kindParam ?? '');

  if (!kind) {
    return (
      <Card title="未知的资源类型">
        <EmptyState
          icon="🧭"
          title={`未识别的资源类型：${kindParam ?? '（空）'}`}
          hint="请从左侧「部署中心」选择 GPU 云服务器 / GPU 裸金属 / vGPU / 推理服务"
        />
      </Card>
    );
  }

  if (!canCreateResource(role)) {
    const Icon = KIND_ICON[kind];
    return (
      <Card title="无创建权限">
        <div className={s.row} style={{ alignItems: 'flex-start', gap: 12 }}>
          <ShieldAlert size={18} color="var(--rs-warning)" style={{ flex: 'none' }} />
          <span className={s.muted}>
            当前角色（{role}）不允许创建{KIND_META[kind].label}。请联系组织 Owner 或 Admin 调整角色。
          </span>
          <Icon size={18} />
        </div>
      </Card>
    );
  }

  const Wizard = WIZARDS[kind];
  return (
    <Suspense
      fallback={
        <div className={s.muted} style={{ padding: 24 }}>
          正在加载「{KIND_META[kind].label}」创建流程…
        </div>
      }
    >
      <Wizard />
    </Suspense>
  );
}
