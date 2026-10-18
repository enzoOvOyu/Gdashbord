// 四类资源列表（PRD §4.3.0：共用骨架，列与筛选器各自不同；A 档行点击 → Drawer）
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
  per_gpu_hour: '/GPU·时',
  per_machine_hour: '/台·时',
  per_cluster_hour: '/集群·时',
  per_gb_hour: '/GB·时',
  per_instance_hour: '/实例·时',
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
      toast.success(`已删除 ${target.display_id}（软删：配额已释放、计量已停止）`);
      setPendingDelete(null);
      if (drawerUuid === (target.resource_uuid as string)) setDrawerUuid(null);
    } catch {
      toast.error(`删除失败：${target.display_id as string}`);
    }
  };

  const doLifecycle = async (r: ResourceListItem, action: 'start' | 'stop'): Promise<void> => {
    try {
      await lifecycle.mutateAsync({ uuid: r.resource_uuid as string, action });
      toast.success(
        action === 'start'
          ? `已启动 ${r.name}`
          : `已停止 ${r.name}（算力停计，仅计存储）`,
      );
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  // ───── 四类列定义（PRD §4.3.1–4.3.4 列表页列） ─────
  const baseCols: Col[] = [
    {
      key: 'name',
      header: '名称 / ID',
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
      header: '状态',
      render: (r) => (
        <LifecycleBadge status={r.status} deleted={Boolean(r.deleted_at)} showZh={false} />
      ),
    },
    { key: 'region', header: '区域', render: (r) => REGION_META[r.region].iso },
  ];

  const kindCols: Record<string, Col[]> = {
    gpu_vm: [
      { key: 'pool', header: '节点池', render: (r) => NODE_POOL_LABEL[r.node_pool] },
      {
        key: 'gpu',
        header: 'GPU',
        render: (r) =>
          `${(r.spec_json as { gpu_model?: string }).gpu_model ?? ''} × ${r.gpu_count}`,
      },
      {
        key: 'vm',
        header: 'vCPU/内存',
        render: (r) => {
          const sp = r.spec_json as { vcpu?: number; memory_gb?: number };
          return `${sp.vcpu ?? '—'}C / ${sp.memory_gb ?? '—'}G`;
        },
      },
      { key: 'storage', header: '存储', render: (r) => `${r.storage_gb} GB` },
    ],
    gpu_baremetal: [
      {
        key: 'machine',
        header: '机型',
        render: (r) => (r.spec_json as GpuBareMetalSpec).machine_type,
      },
      {
        key: 'count',
        header: '台数',
        numeric: true,
        render: (r) => `${(r.spec_json as GpuBareMetalSpec).machine_count} 台`,
      },
      {
        key: 'totalGpu',
        header: '整机总卡数',
        numeric: true,
        render: (r) => (
          <span title="台数 × 单节点 GPU 数，仅展示；计费按「台·小时」">
            {(r.spec_json as GpuBareMetalSpec).gpu_count}
          </span>
        ),
      },
      {
        key: 'nvme',
        header: '本地 NVMe',
        render: (r) => `${(r.spec_json as GpuBareMetalSpec).local_nvme_gb} GB`,
      },
    ],
    vgpu: [
      { key: 'pool', header: '节点池', render: (r) => NODE_POOL_LABEL[r.node_pool] },
      { key: 'k8s', header: 'K8s 版本', render: (r) => (r.spec_json as VgpuSpec).k8s_version },
      {
        key: 'nodes',
        header: '节点数',
        numeric: true,
        render: (r) => (r.spec_json as VgpuSpec).node_count,
      },
      { key: 'gpu', header: 'GPU 总量', numeric: true, render: (r) => r.gpu_count },
    ],
    inference: [
      { key: 'model', header: '模型', render: (r) => (r.spec_json as InferenceSpec).model_ref },
      {
        key: 'replicas',
        header: '副本数',
        numeric: true,
        render: (r) => (r.spec_json as InferenceSpec).replicas,
      },
      {
        key: 'gpu',
        header: '单副本 GPU',
        numeric: true,
        render: (r) => (r.spec_json as InferenceSpec).gpu_count,
      },
      { key: 'pool', header: '节点池', render: (r) => NODE_POOL_LABEL[r.node_pool] },
    ],
  };

  const actionCol: Col = {
    key: 'actions',
    header: '操作',
    render: (r) => (
      <span className={s.row}>
        {!readOnly && r.status === 'running' && (
          <Button
            size="sm"
            variant="ghost"
            title="停止"
            aria-label="停止"
            onClick={() => void doLifecycle(r, 'stop')}
            icon={<Square size={13} />}
          />
        )}
        {!readOnly && r.status === 'stopped' && (
          <Button
            size="sm"
            variant="ghost"
            title="启动"
            aria-label="启动"
            onClick={() => void doLifecycle(r, 'start')}
            icon={<Play size={13} />}
          />
        )}
        <Link
          to={`/resources/${routeKey}/${r.resource_uuid as string}`}
          title="查看完整详情"
          className={s.row}
        >
          <ExternalLink size={13} />
        </Link>
        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            title="删除"
            aria-label="删除"
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
      header: '单价',
      numeric: true,
      mono: true,
      render: (r) => `${formatUsdRate(r.cost.unit_price)}${UNIT_SUFFIX[r.cost.unit]}`,
    },
    {
      key: 'cost',
      header: '$/时',
      numeric: true,
      mono: true,
      render: (r) => formatUsd(r.cost.per_hour),
    },
    {
      key: 'uptime',
      header: '运行时长',
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
            <Badge tone="info">{rows.length} 个</Badge>
          </span>
        }
        desc="区域与项目切换均由接口真实重算（G9）；点击任意行可展开快速预览。"
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void refetch()}
              icon={<RefreshCw size={14} />}
            >
              刷新
            </Button>
            {!readOnly && (
              <Link to={`/deployment/${meta.routeKey === 'servers' ? 'server' : meta.routeKey}`}>
                <Button size="sm" variant="primary" icon={<Plus size={14} />}>
                  新建 {meta.label}
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
          aria-label="区域"
          title="切换区域后列表按该区域重新计算"
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
          aria-label="项目"
        >
          <option value="all">全部项目</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="状态">
          <option value="all">全部状态</option>
          <option value="running">Running</option>
          <option value="stopped">Stopped</option>
          <option value="provisioning">Provisioning</option>
          <option value="error">Error</option>
          <option value="terminating">Terminating</option>
          <option value="deleted">已释放</option>
        </Select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索 display_id / uuid / 名称"
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
              <EmptyState icon="⏳" title="加载中…" />
            ) : (
              <EmptyState
                icon="📭"
                title={`${REGION_META[region].label} 区域暂无${meta.label}`}
                hint="切换区域，或创建该类资源"
                action={
                  !readOnly ? (
                    <Link
                      to={`/deployment/${meta.routeKey === 'servers' ? 'server' : meta.routeKey}`}
                    >
                      <Button size="sm" variant="primary" icon={<Plus size={14} />}>
                        立即创建
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
        title={`删除 ${meta.label}`}
        confirmText={pendingDelete ? (pendingDelete.display_id as string) : ''}
        confirmLabel="确认删除"
        pending={del.isPending}
        description={
          pendingDelete ? (
            <span>
              即将删除 <b>{pendingDelete.name}</b>（{pendingDelete.display_id as string}）。
              <br />
              该操作为<b>真实软删</b>：资源进入 terminating 并标记 <code>deleted_at</code>，
              配额立即释放、计量立即停止；<b>已发生的用量与扣费流水保留</b>用于对账。
              <br />
              当前时单价 {formatUsd(pendingDelete.cost.per_hour)}/时，删除后不再产生新费用。
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
            关闭
          </Button>
          <Button variant="primary" size="sm" onClick={onOpen}>
            查看完整详情
          </Button>
        </>
      }
    >
      <div className={s.col} style={{ gap: 16 }}>
        <DrawerTabs
          items={[
            { key: 'overview', label: '概览' },
            { key: 'metrics', label: '指标' },
            { key: 'events', label: '事件' },
          ]}
          value={tab}
          onChange={onTab}
        />
        {tab === 'overview' && (
          <KeyValue
            items={[
              { label: '类型', value: meta.label },
              {
                label: '区域',
                value: `${REGION_META[resource.region].label} ${REGION_META[resource.region].iso}`,
              },
              { label: '节点池', value: NODE_POOL_LABEL[resource.node_pool] },
              { label: '项目', value: resource.project_name },
              {
                label: '计费单位',
                value: `${formatUsdRate(resource.cost.unit_price)}${UNIT_SUFFIX[resource.cost.unit]}`,
              },
              { label: '当前 $/时', value: formatUsd(resource.cost.per_hour) },
              { label: '计量状态', value: resource.cost.metering_note },
              {
                label: '运行时长',
                value: resource.running_since ? runningDuration(resource.running_since).text : '—',
              },
              { label: 'UUID', value: resource.resource_uuid as string, mono: true },
            ]}
          />
        )}
        {tab === 'metrics' && <DrawerMetrics uuid={resource.resource_uuid as string} />}
        {tab === 'events' && <DrawerEvents uuid={resource.resource_uuid as string} />}
        <div className={s.muted} style={{ fontSize: 12 }}>
          完整详情路径：/resources/{routeKey}/{resource.resource_uuid as string}
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
    return <EmptyState icon="📉" title="暂无指标" hint="供给中或已停止的资源不采集指标" />;
  }
  return (
    <KeyValue
      items={series.slice(0, 8).map((m) => ({
        label: m.label,
        value: m.current === null ? '—（无数据）' : `${m.current.toFixed(1)} ${m.unit}`,
      }))}
    />
  );
}

function DrawerEvents({ uuid }: { uuid: string }) {
  const { data = [] } = useEvents(uuid);
  if (data.length === 0) return <EmptyState icon="🕘" title="暂无事件" />;
  return (
    <div className={s.col} style={{ gap: 10 }}>
      {data.slice(0, 6).map((e) => (
        <div key={e.id} className={s.col}>
          <span>
            <Badge
              tone={e.level === 'error' ? 'danger' : e.level === 'warning' ? 'warning' : 'info'}
            >
              {e.title}
            </Badge>
          </span>
          <span className={s.muted} style={{ fontSize: 12 }}>
            {e.detail}
          </span>
        </div>
      ))}
    </div>
  );
}
