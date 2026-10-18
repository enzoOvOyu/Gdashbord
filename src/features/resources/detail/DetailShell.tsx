// 详情页外壳（PRD §4.3.0：四类共用外层，内层各自独立）
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Play, Square } from 'lucide-react';
import {
  ui as s,
  Card,
  Tabs,
  Badge,
  Button,
  ConfirmDialog,
  toast,
} from '../../../components/ui';
import { LifecycleBadge } from '../../../components/state-machine';
import { KIND_META, KIND_ICON, NODE_POOL_LABEL, REGION_META } from '../../../lib/ids';
import { formatUsd, formatUsdRate } from '../../../lib/money';
import { formatDateTime, runningDuration } from '../../../lib/date';
import { canPerform, isResourceReadOnly } from '../../../lib/rbac';
import { useAuthStore } from '../../../stores/auth';
import {
  useDeleteResource,
  useLifecycleAction,
  type ResourceDetail,
} from '../../shared/api';

const UNIT_SUFFIX: Record<string, string> = {
  per_gpu_hour: '/GPU·时',
  per_machine_hour: '/台·时',
  per_cluster_hour: '/集群·时',
  per_gb_hour: '/GB·时',
  per_instance_hour: '/实例·时',
};

export interface ShellTab {
  key: string;
  label: string;
}

export function DetailShell({
  detail,
  tabs,
  active,
  onTab,
  children,
}: {
  detail: ResourceDetail;
  tabs: ShellTab[];
  active: string;
  onTab: (k: string) => void;
  children: ReactNode;
}) {
  const { routeKey = 'servers' } = useParams();
  const navigate = useNavigate();
  const role = useAuthStore((st) => st.role);
  const readOnly = isResourceReadOnly(role);
  const canDelete = canPerform(role, 'delete');
  const meta = KIND_META[detail.kind];
  const Icon = KIND_ICON[detail.kind];
  const [confirming, setConfirming] = useState(false);
  const del = useDeleteResource();
  const lifecycle = useLifecycleAction();

  const doDelete = async (): Promise<void> => {
    try {
      await del.mutateAsync(detail.resource_uuid as string);
      toast.success(`已删除 ${detail.display_id as string}（软删：配额已释放、计量已停止）`);
      setConfirming(false);
      navigate(`/resources/${routeKey}`);
    } catch {
      toast.error('删除失败，请重试');
    }
  };

  const doLifecycle = async (action: 'start' | 'stop'): Promise<void> => {
    try {
      await lifecycle.mutateAsync({ uuid: detail.resource_uuid as string, action });
      toast.success(action === 'start' ? '已启动' : '已停止（算力停计，仅计存储）');
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  return (
    <div>
      <div className={s.pageHead}>
        <div className={s.pageHeadText}>
          <h1 className={s.pageHeadTitle}>
            <Icon size={20} />
            {detail.name}
            <LifecycleBadge status={detail.status} deleted={Boolean(detail.deleted_at)} />
          </h1>
          <p className={s.pageHeadDesc}>
            <span className={s.mono}>{detail.display_id as string}</span>
            {' · '}
            {REGION_META[detail.region].label} {REGION_META[detail.region].iso} ·{' '}
            {NODE_POOL_LABEL[detail.node_pool]} · {meta.label} · 项目 {detail.project_name} ·{' '}
            {formatUsdRate(detail.cost.unit_price)}
            {UNIT_SUFFIX[detail.cost.unit]} · {formatUsd(detail.cost.per_hour)}/时 ·{' '}
            {detail.running_since
              ? `已运行 ${runningDuration(detail.running_since).text}`
              : '未运行'}
            {' · '}
            创建于 {formatDateTime(detail.created_at)}
          </p>
        </div>
        <div className={s.pageHeadActions}>
          <Button
            size="sm"
            variant="secondary"
            icon={<ArrowLeft size={14} />}
            onClick={() => navigate(`/resources/${routeKey}`)}
          >
            返回列表
          </Button>
          {!readOnly && detail.status === 'running' && (
            <Button size="sm" variant="secondary" icon={<Square size={14} />} onClick={() => void doLifecycle('stop')}>
              停止
            </Button>
          )}
          {!readOnly && detail.status === 'stopped' && (
            <Button size="sm" variant="secondary" icon={<Play size={14} />} onClick={() => void doLifecycle('start')}>
              启动
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={14} />}
              onClick={() => setConfirming(true)}
            >
              删除
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className={s.cardHeader}>
          <Tabs items={tabs} value={active} onChange={onTab} />
          <div className={s.cardActions}>
            <Badge tone={detail.cost.remaining_hours === null ? 'muted' : 'info'}>
              {detail.cost.metering_note}
            </Badge>
          </div>
        </div>
        <div className={s.cardBody}>{children}</div>
      </Card>

      <ConfirmDialog
        open={confirming}
        title={`删除 ${meta.label}`}
        confirmText={detail.display_id as string}
        confirmLabel="确认删除"
        pending={del.isPending}
        description={
          <span>
            即将删除 <b>{detail.name}</b>（{detail.display_id as string}）。
            <br />
            真实软删：进入 terminating 并标记 <code>deleted_at</code>，配额立即释放、计量立即停止；
            <b>已发生的用量与扣费流水保留</b>用于对账。
            <br />
            当前时单价 {formatUsd(detail.cost.per_hour)}/时（
            {formatUsdRate(detail.cost.unit_price)}
            {UNIT_SUFFIX[detail.cost.unit]} × {detail.cost.quantity}）。
          </span>
        }
        onCancel={() => setConfirming(false)}
        onConfirm={() => void doDelete()}
      />
    </div>
  );
}

/** 供给中：展示子步骤进度（PRD §5.3） */
export function ProvisioningNotice({
  steps,
  kindLabel,
}: {
  steps: Array<{ step_key: string; state: string; message: string | null }>;
  kindLabel: string;
}) {
  const done = steps.filter((x) => x.state === 'done').length;
  return (
    <div
      style={{
        border: '1px solid var(--rs-border)',
        background: 'var(--rs-surface-2)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
      }}
    >
      <b>{kindLabel}供给中</b>：{done}/{steps.length} 个子步骤已完成。
      <div className={s.muted} style={{ fontSize: 12 }}>
        供给完成后自动进入 Running 并开始计量；若失败将置为 Error 并给出具体原因。
      </div>
    </div>
  );
}
