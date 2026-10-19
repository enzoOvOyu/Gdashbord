// 详情页外壳（PRD §4.3.0：四类共用外层，内层各自独立）
import { t, dt } from '../../../i18n';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Play, Square, Code2 } from 'lucide-react';
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
  get per_gpu_hour() { return t('unit.perGpuHour'); },
  get per_machine_hour() { return t('unit.perMachineHour'); },
  get per_cluster_hour() { return t('unit.perClusterHour'); },
  get per_gb_hour() { return t('unit.perGbHour'); },
  get per_instance_hour() { return t('unit.perInstanceHour'); },
};

export interface ShellTab {
  key: string;
  label: string;
}

/**
 * 可挂靠 Notebook / IDE 的形态（PRD §4.5.1）：
 * GPU 云服务器 / GPU 裸金属 / vGPU 集群三类；推理服务无 SSH 面，不挂开发环境。
 */
const NOTEBOOK_ATTACHABLE: ReadonlyArray<string> = ['gpu_vm', 'gpu_baremetal', 'vgpu'];

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
      toast.success(t('ds.deleted', { v0: detail.display_id as string }));
      setConfirming(false);
      navigate(`/resources/${routeKey}`);
    } catch {
      toast.error(t('ds.deleteFailed'));
    }
  };

  const doLifecycle = async (action: 'start' | 'stop'): Promise<void> => {
    try {
      await lifecycle.mutateAsync({ uuid: detail.resource_uuid as string, action });
      toast.success(action === 'start' ? t('ds.started') : t('ds.stopped'));
    } catch {
      toast.error(t('ds.actionFailed'));
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
            {NODE_POOL_LABEL[detail.node_pool]} · {t('detail.metaProject', { v0: meta.label, v1: dt(detail.project_name) })} ·{' '}
            {formatUsdRate(detail.cost.unit_price)}
            {UNIT_SUFFIX[detail.cost.unit]} · {t('detail.perHourSuffix', { v0: formatUsd(detail.cost.per_hour) })}{detail.running_since
              ? t('detail.runningSince', { v0: runningDuration(detail.running_since).text })
              : t('detail.notRunning')}
            {' · '}
            {t('detail.createdAt', { v0: formatDateTime(detail.created_at) })}</p>
        </div>
        <div className={s.pageHeadActions}>
          <Button
            size="sm"
            variant="secondary"
            icon={<ArrowLeft size={14} />}
            onClick={() => navigate(`/resources/${routeKey}`)}
          >
            {t('common.backToList')}
          </Button>
          {/* v0.7 反向联动：资源 → 工作台（?resource=<uuid> 预填宿主，PRD §4.5.1） */}
          {NOTEBOOK_ATTACHABLE.includes(detail.kind) && !detail.deleted_at && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Code2 size={14} />}
              onClick={() =>
                navigate(`/workbench/notebooks?resource=${encodeURIComponent(detail.resource_uuid as string)}`)
              }
            >
              {t('ds.createNotebook')}
            </Button>
          )}
          {!readOnly && detail.status === 'running' && (
            <Button size="sm" variant="secondary" icon={<Square size={14} />} onClick={() => void doLifecycle('stop')}>
              {t('common.stop')}
            </Button>
          )}
          {!readOnly && detail.status === 'stopped' && (
            <Button size="sm" variant="secondary" icon={<Play size={14} />} onClick={() => void doLifecycle('start')}>
              {t('fx.stepBoot')}
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={14} />}
              onClick={() => setConfirming(true)}
            >
              {t('common.delete')}
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
        title={t('ds.deleteKind', { v0: meta.label })}
        confirmText={detail.display_id as string}
        confirmLabel={t('common.confirmDelete')}
        pending={del.isPending}
        description={
          <span>
            {t('ds.aboutToDelete')} <b>{detail.name}</b>{t('common.idInParens', { v0: detail.display_id as string })}<br />
            {t('ds.softDelete')} <code>deleted_at</code>{t('ds.quotaReleased')}<b>{t('ds.usageKept')}</b>{t('ds.forReconciliation')}
            <br />
            {t('ds.currentRate', { v0: formatUsd(detail.cost.per_hour), v1: formatUsdRate(detail.cost.unit_price), v2: UNIT_SUFFIX[detail.cost.unit], v3: detail.cost.quantity })}
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
      <b>{t('ds.provisioning', { v0: kindLabel })}</b>{t('ds.substepColon', { v0: done })}/{t('ds.substepsDone', { v0: steps.length })}<div className={s.muted} style={{ fontSize: 12 }}>
        {t('ds.provisionHint')}
      </div>
    </div>
  );
}
