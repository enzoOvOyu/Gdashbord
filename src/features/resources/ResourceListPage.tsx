// 四类资源列表（PRD §4.3.0：共用骨架，列与筛选器各自不同；A 档行点击 → Drawer）
import { t, dt } from '../../i18n';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Trash2, Play, Square, Plus, RefreshCw } from 'lucide-react';
import {
  ui as s,
  Card,
  Table,
  Badge,
  Button,
  Input,
  Select,
  PageHeader,
  Toolbar,
  EmptyState,
  Drawer,
  DrawerTabs,
  KeyValue,
  toast,
  ConfirmDialog,
} from '../../components/ui';
import { LifecycleBadge } from '../../components/state-machine';
import { KIND_META, KIND_ICON, kindOfRouteKey, NODE_POOL_LABEL, REGION_META } from '../../lib/ids';
import { formatUsd, formatUsdRate } from '../../lib/money';
import { runningDuration } from '../../lib/date';
import { canPerform, isResourceReadOnly } from '../../lib/rbac';
import { useAuthStore } from '../../stores/auth';
import {
  useDeleteResource,
  useEvents,
  useLifecycleAction,
  useMetrics,
  usePageRegion,
  useProjects,
  useResources,
  type ResourceListItem,
} from '../shared/api';
import type { GpuBareMetalSpec, InferenceSpec, VgpuSpec } from '../../types/domain';

const UNIT_SUFFIX: Record<string, string> = {
  get per_gpu_hour() { return t('unit.perGpuHour'); },
  get per_machine_hour() { return t('unit.perMachineHour'); },
  get per_cluster_hour() { return t('unit.perClusterHour'); },
  get per_gb_hour() { return t('unit.perGbHour'); },
  get per_instance_hour() { return t('unit.perInstanceHour'); },
};

type DrawerTab = 'overview' | 'metrics' | 'events';

interface Col {
  key: string;
  header: ReactNode;
  render: (r: ResourceListItem) => ReactNode;
  numeric?: boolean;
  mono?: boolean;
}

export default function ResourceListPage() {
  const { routeKey = 'servers' } = useParams();
  const kind = kindOfRouteKey(routeKey) ?? 'gpu_vm';
  const meta = KIND_META[kind];
  const Icon = KIND_ICON[kind];
  const navigate = useNavigate();
  const role = useAuthStore((st) => st.role);
  const readOnly = isResourceReadOnly(role);
  const canDelete = canPerform(role, 'delete');

  const [region, setRegion] = usePageRegion();
  const [projectId, setProjectId] = useState<number | 'all'>('all');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [drawerUuid, setDrawerUuid] = useState<string | null>(null);
  const [tab, setTab] = useState<DrawerTab>('overview');
  const [pendingDelete, setPendingDelete] = useState<ResourceListItem | null>(null);

  const { data: rows = [], isLoading, refetch } = useResources({
    kind,
    region,
    projectId,
    status,
    q,
  });
  const { data: projects = [] } = useProjects() as { data: Array<{ id: number; name: string }> };
  const del = useDeleteResource();
  const lifecycle = useLifecycleAction();

  const current = useMemo(
    () => rows.find((r) => r.resource_uuid === drawerUuid) ?? null,
    [rows, drawerUuid],
  );

  const doDelete = async (): Promise<void> => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    try {
      await del.mutateAsync(target.resource_uuid as string);
      toast.success(t('ds.deleted', { v0: target.display_id }));
      setPendingDelete(null);
      if (drawerUuid === (target.resource_uuid as string)) setDrawerUuid(null);
    } catch {
      toast.error(t('rlp.deleteFailedValue', { v0: target.display_id as string }));
    }
  };

  const doLifecycle = async (r: ResourceListItem, action: 'start' | 'stop'): Promise<void> => {
    try {
      await lifecycle.mutateAsync({ uuid: r.resource_uuid as string, action });
      toast.success(
        action === 'start'
          ? t('rlp.startedValue', { v0: r.name })
          : t('rlp.stoppedValue', { v0: r.name }),
      );
    } catch {
      toast.error(t('ds.actionFailed'));
    }
  };

  // ───── 四类列定义（PRD §4.3.1–4.3.4 列表页列） ─────
  const baseCols: Col[] = [
    {
      key: 'name',
      header: t('rlp.searchLabel'),
      render: (r) => (
        <span className={s.col}>
          <b>{r.name}</b>
          <span className={s.muted} style={{ fontSize: 12 }}>
            {r.display_id as string}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (r) => (
        <LifecycleBadge status={r.status} deleted={Boolean(r.deleted_at)} showZh={false} />
      ),
    },
    { key: 'region', header: t('common.region'), render: (r) => REGION_META[r.region].iso },
  ];

  const kindCols: Record<string, Col[]> = {
    gpu_vm: [
      { key: 'pool', header: t('common.nodePool'), render: (r) => NODE_POOL_LABEL[r.node_pool] },
      {
        key: 'gpu',
        header: 'GPU',
        render: (r) =>
          `${(r.spec_json as { gpu_model?: string }).gpu_model ?? ''} × ${r.gpu_count}`,
      },
      {
        key: 'vm',
        header: t('rlp.vcpuMem'),
        render: (r) => {
          const sp = r.spec_json as { vcpu?: number; memory_gb?: number };
          return `${sp.vcpu ?? '—'}C / ${sp.memory_gb ?? '—'}G`;
        },
      },
      { key: 'storage', header: t('common.storage'), render: (r) => `${r.storage_gb} GB` },
    ],
    gpu_baremetal: [
      {
        key: 'machine',
        header: t('common.machineType'),
        render: (r) => (r.spec_json as GpuBareMetalSpec).machine_type,
      },
      {
        key: 'count',
        header: t('bm.machineCount'),
        numeric: true,
        render: (r) => t('bm.machineCountValue', { v0: (r.spec_json as GpuBareMetalSpec).machine_count }),
      },
      {
        key: 'totalGpu',
        header: t('bm.totalGpuLabel'),
        numeric: true,
        render: (r) => (
          <span title={t('rlp.totalGpuHint')}>
            {(r.spec_json as GpuBareMetalSpec).gpu_count}
          </span>
        ),
      },
      {
        key: 'nvme',
        header: t('pools.localNvme'),
        render: (r) => `${(r.spec_json as GpuBareMetalSpec).local_nvme_gb} GB`,
      },
    ],
    vgpu: [
      { key: 'pool', header: t('common.nodePool'), render: (r) => NODE_POOL_LABEL[r.node_pool] },
      { key: 'k8s', header: t('deploy.k8sVersion'), render: (r) => (r.spec_json as VgpuSpec).k8s_version },
      {
        key: 'nodes',
        header: t('common.nodeCount'),
        numeric: true,
        render: (r) => (r.spec_json as VgpuSpec).node_count,
      },
      { key: 'gpu', header: t('rlp.gpuTotal'), numeric: true, render: (r) => r.gpu_count },
    ],
    inference: [
      { key: 'model', header: t('common.model'), render: (r) => (r.spec_json as InferenceSpec).model_ref },
      {
        key: 'replicas',
        header: t('common.replicas'),
        numeric: true,
        render: (r) => (r.spec_json as InferenceSpec).replicas,
      },
      {
        key: 'gpu',
        header: t('rlp.gpuPerReplica'),
        numeric: true,
        render: (r) => (r.spec_json as InferenceSpec).gpu_count,
      },
      { key: 'pool', header: t('common.nodePool'), render: (r) => NODE_POOL_LABEL[r.node_pool] },
    ],
  };

  const actionCol: Col = {
    key: 'actions',
    header: t('common.actions'),
    render: (r) => (
      <span className={s.row}>
        {!readOnly && r.status === 'running' && (
          <Button
            size="sm"
            variant="ghost"
            title={t('common.stop')}
            aria-label={t('common.stop')}
            onClick={() => void doLifecycle(r, 'stop')}
            icon={<Square size={13} />}
          />
        )}
        {!readOnly && r.status === 'stopped' && (
          <Button
            size="sm"
            variant="ghost"
            title={t('fx.stepBoot')}
            aria-label={t('fx.stepBoot')}
            onClick={() => void doLifecycle(r, 'start')}
            icon={<Play size={13} />}
          />
        )}
        <Link
          to={`/resources/${routeKey}/${r.resource_uuid as string}`}
          title={t('common.viewDetail')}
          className={s.row}
        >
          <ExternalLink size={13} />
        </Link>
        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            title={t('common.delete')}
            aria-label={t('common.delete')}
            onClick={() => setPendingDelete(r)}
            icon={<Trash2 size={13} color="var(--rs-danger)" />}
          />
        )}
      </span>
    ),
  };

  const columns: Col[] = [
    ...baseCols,
    ...kindCols[kind],
    {
      key: 'price',
      header: t('common.unitPrice'),
      numeric: true,
      mono: true,
      render: (r) => `${formatUsdRate(r.cost.unit_price)}${UNIT_SUFFIX[r.cost.unit]}`,
    },
    {
      key: 'cost',
      header: t('rlp.perHourShort'),
      numeric: true,
      mono: true,
      render: (r) => formatUsd(r.cost.per_hour),
    },
    {
      key: 'uptime',
      header: t('common.uptime'),
      numeric: true,
      render: (r) => (r.running_since ? runningDuration(r.running_since).text : '—'),
    },
    actionCol,
  ];

  return (
    <div>
      <PageHeader
        title={
          <span className={s.row}>
            <Icon size={20} />
            {meta.label}
            <Badge tone="info">{t('common.countGeneric', { v0: rows.length })}</Badge>
          </span>
        }
        desc={t('rlp.pageHint')}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void refetch()}
              icon={<RefreshCw size={14} />}
            >
              {t('common.refresh')}
            </Button>
            {!readOnly && (
              <Link to={`/deployment/${meta.routeKey === 'servers' ? 'server' : meta.routeKey}`}>
                <Button size="sm" variant="primary" icon={<Plus size={14} />}>
                  {t('deploy.createKind', { v0: meta.label })}
                </Button>
              </Link>
            )}
          </>
        }
      />

      <Toolbar>
        <Select
          value={region}
          onChange={(e) => setRegion(e.target.value as typeof region)}
          aria-label={t('common.region')}
          title={t('rlp.regionHint')}
          style={{ minWidth: 118 }}
        >
          {(['jp', 'th', 'sg', 'us'] as const).map((r) => (
            <option key={r} value={r}>
              {REGION_META[r].label} {REGION_META[r].iso}
            </option>
          ))}
        </Select>
        <Select
          value={String(projectId)}
          onChange={(e) => setProjectId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          aria-label={t('common.project')}
        >
          <option value="all">{t('common.allProjects')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('common.status')}>
          <option value="all">{t('common.allStatus')}</option>
          <option value="running">Running</option>
          <option value="stopped">Stopped</option>
          <option value="provisioning">Provisioning</option>
          <option value="error">Error</option>
          <option value="terminating">Terminating</option>
          <option value="deleted">{t('status.released')}</option>
        </Select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('rlp.searchPlaceholder')}
          style={{ minWidth: 220 }}
        />
      </Toolbar>

      <Card>
        <Table
          rows={rows}
          rowKey={(r) => r.resource_uuid as string}
          columns={columns}
          onRowClick={(r) => {
            setDrawerUuid(r.resource_uuid as string);
            setTab('overview');
          }}
          empty={
            isLoading ? (
              <EmptyState icon="⏳" title={t('common.loading')} />
            ) : (
              <EmptyState
                icon="📭"
                title={t('rlp.emptyRegion', { v0: REGION_META[region].label, v1: meta.label })}
                hint={t('rlp.emptyHint')}
                action={
                  !readOnly ? (
                    <Link
                      to={`/deployment/${meta.routeKey === 'servers' ? 'server' : meta.routeKey}`}
                    >
                      <Button size="sm" variant="primary" icon={<Plus size={14} />}>
                        {t('rlp.createNow')}
                      </Button>
                    </Link>
                  ) : undefined
                }
              />
            )
          }
        />
      </Card>

      <ResourceQuickDrawer
        resource={current}
        routeKey={routeKey}
        tab={tab}
        onTab={setTab}
        onClose={() => setDrawerUuid(null)}
        onOpen={() => {
          if (current) {
            navigate(`/resources/${routeKey}/${current.resource_uuid as string}`);
            setDrawerUuid(null);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('ds.deleteKind', { v0: meta.label })}
        confirmText={pendingDelete ? (pendingDelete.display_id as string) : ''}
        confirmLabel={t('common.confirmDelete')}
        pending={del.isPending}
        description={
          pendingDelete ? (
            <span>
              {t('ds.aboutToDelete')} <b>{pendingDelete.name}</b>{t('common.idInParens', { v0: pendingDelete.display_id as string })}<br />
              {t('rlp.thisOpIs')}<b>{t('rlp.realSoftDelete')}</b>{t('rlp.softDeletePart1')}<code>deleted_at</code>{t('rlp.quotaReleased')}<b>{t('ds.usageKept')}</b>{t('ds.forReconciliation')}
              <br />
              {t('rlp.rateNote', { v0: formatUsd(pendingDelete.cost.per_hour) })}
            </span>
          ) : null
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void doDelete()}
      />
    </div>
  );
}

// ─────────── 快速预览抽屉（§3.4 A 档） ───────────
function ResourceQuickDrawer({
  resource,
  routeKey,
  tab,
  onTab,
  onClose,
  onOpen,
}: {
  resource: ResourceListItem | null;
  routeKey: string;
  tab: DrawerTab;
  onTab: (t: DrawerTab) => void;
  onClose: () => void;
  onOpen: () => void;
}) {
  const meta = resource ? KIND_META[resource.kind] : null;
  const Icon = resource ? KIND_ICON[resource.kind] : null;
  if (!resource || !meta || !Icon) return null;
  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span className={s.row}>
          <Icon size={16} />
          {resource.name}
        </span>
      }
      subtitle={resource.display_id as string}
      badge={
        <LifecycleBadge status={resource.status} deleted={Boolean(resource.deleted_at)} showZh={false} />
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.off')}
          </Button>
          <Button variant="primary" size="sm" onClick={onOpen}>
            {t('common.viewDetail')}
          </Button>
        </>
      }
    >
      <div className={s.col} style={{ gap: 16 }}>
        <DrawerTabs
          items={[
            { key: 'overview', label: t('detail.overview') },
            { key: 'metrics', label: t('rlp.metrics') },
            { key: 'events', label: t('detail.events') },
          ]}
          value={tab}
          onChange={onTab}
        />
        {tab === 'overview' && (
          <KeyValue
            items={[
              { label: t('common.type'), value: meta.label },
              {
                label: t('common.region'),
                value: `${REGION_META[resource.region].label} ${REGION_META[resource.region].iso}`,
              },
              { label: t('common.nodePool'), value: NODE_POOL_LABEL[resource.node_pool] },
              { label: t('common.project'), value: resource.project_name },
              {
                label: t('cost.billingUnit'),
                value: `${formatUsdRate(resource.cost.unit_price)}${UNIT_SUFFIX[resource.cost.unit]}`,
              },
              { label: t('detail.currentHourly'), value: formatUsd(resource.cost.per_hour) },
              { label: t('bt.meteringStatus'), value: resource.cost.metering_note },
              {
                label: t('common.uptime'),
                value: resource.running_since ? runningDuration(resource.running_since).text : '—',
              },
              { label: 'UUID', value: resource.resource_uuid as string, mono: true },
            ]}
          />
        )}
        {tab === 'metrics' && <DrawerMetrics uuid={resource.resource_uuid as string} />}
        {tab === 'events' && <DrawerEvents uuid={resource.resource_uuid as string} />}
        <div className={s.muted} style={{ fontSize: 12 }}>
          {t('rlp.detailPath', { v0: routeKey, v1: resource.resource_uuid as string })}
        </div>
      </div>
    </Drawer>
  );
}

function DrawerMetrics({ uuid }: { uuid: string }) {
  const { data } = useMetrics(uuid, '1h');
  const series = (data ?? []) as Array<{
    key: string;
    label: string;
    unit: string;
    current: number | null;
  }>;
  if (series.length === 0) {
    return <EmptyState icon="📉" title={t('common.noMetrics')} hint={t('rlp.noMetricsHint')} />;
  }
  return (
    <KeyValue
      items={series.slice(0, 8).map((m) => ({
        label: m.label,
        value: m.current === null ? t('common.dashNoData') : `${m.current.toFixed(1)} ${m.unit}`,
      }))}
    />
  );
}

function DrawerEvents({ uuid }: { uuid: string }) {
  const { data = [] } = useEvents(uuid);
  if (data.length === 0) return <EmptyState icon="🕘" title={t('common.noEvents')} />;
  return (
    <div className={s.col} style={{ gap: 10 }}>
      {data.slice(0, 6).map((e) => (
        <div key={e.id} className={s.col}>
          <span>
            <Badge
              tone={e.level === 'error' ? 'danger' : e.level === 'warning' ? 'warning' : 'info'}
            >
              {dt(e.title)}
            </Badge>
          </span>
          <span className={s.muted} style={{ fontSize: 12 }}>
            {dt(e.detail)}
          </span>
        </div>
      ))}
    </div>
  );
}
