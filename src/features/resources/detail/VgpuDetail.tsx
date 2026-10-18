// vGPU 详情（PRD §4.3.3：CoreWeave CKS / 火山引擎 VKE 三级视图 —— 控制面 → 节点池 → 工作负载）
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ui as s,
  KeyValue,
  InfoCard,
  Badge,
  Progress,
  EmptyState,
  StatTile,
  Table,
  Card,
  toast,
} from '../../../components/ui';
import { MetricsGrid, RangeTabs } from '../../shared/MetricsPanel';
import { EventsTimeline } from '../../shared/EventsTimeline';
import { BillingTab } from '../../shared/BillingTab';
import { useEvents, useMetrics, useNodes, type ResourceDetail } from '../../shared/api';
import { NODE_POOL_LABEL, REGION_META } from '../../../lib/ids';
import { formatUsd, formatUsdRate } from '../../../lib/money';
import { formatDateTime, runningDuration } from '../../../lib/date';
import { api } from '../../../lib/api-client';
import type { RangeKey } from '../../../mocks/lib/timeseries';
import type { VgpuSpec, NodeState } from '../../../types/domain';
import { NODE_STATE_META } from '../../../components/state-machine';
import { VITE_FEATURE_TOPOLOGY } from '../../../mocks/lib/env';
import { GPU_SPECS } from '../../../mocks/fixtures/gpu-specs';

type TabKey =
  | 'overview'
  | 'control'
  | 'pools'
  | 'workloads'
  | 'network'
  | 'topology'
  | 'events'
  | 'billing';

export const VGPU_TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'control', label: '控制面' },
  { key: 'pools', label: '节点池' },
  { key: 'workloads', label: '工作负载' },
  { key: 'network', label: '网络与存储' },
  ...(VITE_FEATURE_TOPOLOGY ? [{ key: 'topology' as TabKey, label: '拓扑' }] : []),
  { key: 'events', label: '事件' },
  { key: 'billing', label: '计费' },
];

interface WorkloadResponse {
  namespaces: Array<{
    name: string;
    deployments: Array<{
      name: string;
      desired: number;
      ready: number;
      pods: Array<{
        name: string;
        phase: string;
        node: string | null;
        restarts: number;
        oomKilled: number;
        waitingReason: string | null;
      }>;
    }>;
  }>;
  schedulingFailures: Array<{ reason: string; count: number }>;
  phaseDistribution: Record<string, number>;
}

export function VgpuDetail({ detail, tab }: { detail: ResourceDetail; tab: TabKey }) {
  const spec = detail.spec_json as VgpuSpec;
  const [range, setRange] = useState<RangeKey>('1h');
  const { data: metrics = [] } = useMetrics(detail.resource_uuid as string, range);
  const { data: events = [] } = useEvents(detail.resource_uuid as string);
  const { data: nodes = [] } = useNodes(detail.region);
  const { data: wl } = useQuery<WorkloadResponse>({
    queryKey: ['workloads', detail.resource_uuid],
    queryFn: () => api.get<WorkloadResponse>(`/api/resources/${detail.resource_uuid as string}/workloads`),
  });

  const poolNodes = nodes.filter((n) => n.pool_code === detail.node_pool);
  const gpusPer = GPU_SPECS[detail.node_pool].gpusPerNode;
  const totalGpu = spec.node_count * gpusPer;
  const allocated = Math.round(totalGpu * 0.72);

  if (tab === 'overview') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <InfoCard
          title="集群信息"
          items={[
            { label: '集群名', value: detail.name },
            { label: 'K8s 版本', value: `v${spec.k8s_version}` },
            { label: '控制面规格', value: spec.control_plane_tier === 'ha' ? 'HA（3 副本）' : 'Standard（单副本）' },
            {
              label: '区域',
              value: `${REGION_META[detail.region].label} ${REGION_META[detail.region].iso}`,
            },
            { label: '节点池数', value: spec.pools.length },
            { label: '节点数', value: spec.node_count },
            { label: 'API Server', value: `https://${detail.resource_uuid as string}.${detail.region}.cks.runsun.cloud:6443`, mono: true },
            { label: '创建时间', value: formatDateTime(detail.created_at) },
            { label: '网络插件', value: spec.network_plugin },
            { label: 'kubeconfig 获取', value: spec.kubeconfig_access === 'download' ? '下载文件' : '托管控制台' },
          ]}
        />
        <div>
          <div className={s.metricLabel} style={{ marginBottom: 6 }}>
            GPU 容量 vs 已分配
          </div>
          <Progress
            value={allocated}
            max={totalGpu}
            label={`已分配 ${allocated} / ${totalGpu} 卡`}
            right={`${((allocated / Math.max(totalGpu, 1)) * 100).toFixed(1)}%`}
          />
        </div>
        <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <StatTile
            label="控制面费"
            value={`${formatUsdRate(detail.cost.control_plane_per_hour)} /集群·时`}
            hint={spec.control_plane_tier === 'ha' ? 'HA 为 Standard 的 3 倍' : 'Standard'}
          />
          <StatTile label="当前 $/时" value={formatUsd(detail.cost.per_hour)} hint={detail.cost.metering_note} />
          <StatTile label="本月花费" value={formatUsd(detail.cost_summary.mtd)} />
          <StatTile
            label="运行时长"
            value={detail.running_since ? runningDuration(detail.running_since).text : '—'}
          />
        </div>
        <MetricsGrid metrics={metrics.filter((m) => m.key.startsWith('apiserver') || m.key.startsWith('etcd') || m.key === 'gpu_allocation')} />
      </div>
    );
  }

  if (tab === 'control') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <RangeTabs value={range} onChange={setRange} />
        <MetricsGrid metrics={metrics} />
        <InfoCard
          title="组件状态"
          items={[
            { label: 'API Server', value: `${spec.control_plane_tier === 'ha' ? '3/3' : '1/1'} 就绪` },
            { label: 'etcd', value: `${spec.control_plane_tier === 'ha' ? '3/3' : '1/1'} 就绪` },
            { label: 'Scheduler', value: '1/1 就绪' },
            { label: 'Controller-Manager', value: '1/1 就绪' },
          ]}
        />
      </div>
    );
  }

  if (tab === 'pools') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        {spec.pools.map((p) => (
          <Card key={`${p.node_pool}-${p.node_count}`}>
            <div className={s.cardHeader}>
              <div className={s.cardTitle}>{NODE_POOL_LABEL[p.node_pool as keyof typeof NODE_POOL_LABEL]}</div>
              <div className={s.cardActions}>
                <Badge tone={p.autoscale ? 'info' : 'muted'}>
                  {p.autoscale ? `Autoscaler ${p.autoscale.min}–${p.autoscale.max}` : '未启用自动扩缩'}
                </Badge>
              </div>
            </div>
            <div className={s.cardBody}>
              <KeyValue
                items={[
                  { label: '节点数', value: p.node_count },
                  { label: 'GPU 总量', value: p.node_count * gpusPer },
                  {
                    label: '切片策略',
                    value:
                      p.slicing_policy === 'none' ? '整卡直通'
                      : p.slicing_policy === 'mig' ? `MIG（${p.mig_profile ?? '—'}）`
                      : p.slicing_policy === 'time_slicing' ? `Time-Slicing（${p.time_slice_share ?? '—'} 共享）`
                      : 'MPS',
                  },
                  { label: '机型', value: GPU_SPECS[p.node_pool as keyof typeof GPU_SPECS].productName },
                ]}
              />
              <h3 className={s.sectionTitle} style={{ margin: '16px 0 8px' }}>
                节点列表
              </h3>
              <Table
                rows={poolNodes.slice(0, 12)}
                rowKey={(n) => n.node_uid}
                empty={<EmptyState icon="🖥" title="该区域/节点池暂无节点" />}
                columns={[
                  { key: 'uid', header: '节点 UID', mono: true, render: (n) => n.node_uid.slice(0, 12) },
                  {
                    key: 'state',
                    header: '状态',
                    render: (n) => (
                      <Badge
                        tone={
                          n.state === 'ready' ? 'success'
                          : n.state === 'notready' ? 'danger'
                          : n.state === 'remediation' ? 'warning'
                          : 'muted'
                        }
                      >
                        {NODE_STATE_META[n.state as NodeState]?.label ?? n.state}
                      </Badge>
                    ),
                  },
                  { key: 'rack', header: '机架位', mono: true, render: (n) => n.rack_id ?? '—' },
                  { key: 'switch', header: '交换机组', render: (n) => n.switch_group ?? '—' },
                  {
                    key: 'straggler',
                    header: 'Straggler',
                    render: (n) => (n.straggler ? <Badge tone="warning">慢节点</Badge> : '—'),
                  },
                  { key: 'hosted', header: '承载资源', numeric: true, render: (n) => n.hosted_resources },
                ]}
              />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (tab === 'workloads') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <div>
          <h2 className={s.sectionTitle} style={{ marginBottom: 12 }}>
            Pod 阶段分布
          </h2>
          <KeyValue
            items={Object.entries(wl?.phaseDistribution ?? {}).map(([k, v]) => ({
              label: k,
              value: v,
            }))}
          />
        </div>
        <div>
          <h2 className={s.sectionTitle} style={{ marginBottom: 12 }}>
            调度失败原因 TopN
          </h2>
          {(wl?.schedulingFailures ?? []).length === 0 ? (
            <EmptyState icon="✅" title="无调度失败" />
          ) : (
            <Table
              rows={wl?.schedulingFailures ?? []}
              rowKey={(f) => f.reason}
              columns={[
                { key: 'reason', header: 'FailedScheduling 原因', render: (f) => f.reason, mono: true },
                { key: 'count', header: '次数', numeric: true, render: (f) => f.count },
              ]}
            />
          )}
        </div>
        {(wl?.namespaces ?? []).map((ns) => (
          <Card key={ns.name}>
            <div className={s.cardHeader}>
              <div className={s.cardTitle}>Namespace · {ns.name}</div>
            </div>
            <div className={s.cardBody}>
              {ns.deployments.map((d) => (
                <div key={d.name} style={{ marginBottom: 12 }}>
                  <div className={s.row} style={{ justifyContent: 'space-between' }}>
                    <b>{d.name}</b>
                    <span className={s.muted}>
                      {d.ready}/{d.desired} Ready
                    </span>
                  </div>
                  <Table
                    rows={d.pods}
                    rowKey={(p) => p.name}
                    zebra
                    columns={[
                      { key: 'name', header: 'Pod', mono: true, render: (p) => p.name },
                      {
                        key: 'phase',
                        header: 'Phase',
                        render: (p) => (
                          <Badge
                            tone={
                              p.phase === 'Running' ? 'success'
                              : p.phase === 'Pending' ? 'warning'
                              : p.phase === 'Failed' ? 'danger'
                              : 'muted'
                            }
                          >
                            {p.phase}
                          </Badge>
                        ),
                      },
                      { key: 'node', header: '所在节点', render: (p) => p.node ?? '—' },
                      { key: 'restarts', header: '重启次数', numeric: true, render: (p) => p.restarts },
                      { key: 'oom', header: 'OOMKilled', numeric: true, render: (p) => p.oomKilled },
                      {
                        key: 'reason',
                        header: 'Waiting 原因',
                        render: (p) =>
                          p.waitingReason ? (
                            <span className={s.mono} style={{ color: 'var(--rs-warning)' }}>
                              {p.waitingReason}
                            </span>
                          ) : '—',
                      },
                    ]}
                  />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (tab === 'network') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <InfoCard
          title="网络"
          items={[
            { label: 'CNI 插件', value: spec.network_plugin },
            { label: 'Ingress', value: spec.ingress_enabled ? `已启用（${spec.ingress_class ?? 'nginx'}）` : '未启用' },
            { label: 'InfiniBand', value: spec.ib_enabled ? '已启用' : '未启用' },
            { label: 'API Server 公网访问', value: spec.api_server_public ? '已开启' : '仅私网' },
          ]}
        />
        <InfoCard
          title="存储"
          items={[
            { label: 'StorageClass', value: spec.storage_class },
            { label: '默认 PVC', value: spec.default_pvc_gb ? `${spec.default_pvc_gb} GB` : '未预置' },
            { label: 'PVC 容量', value: `${spec.storage_gb} GB` },
          ]}
        />
        <MetricsGrid metrics={metrics.filter((m) => m.key.includes('cni') || m.key.includes('ingress') || m.key.includes('pvc') || m.key.includes('csi'))} />
      </div>
    );
  }

  if (tab === 'topology') {
    return <TopologyView nodes={poolNodes} />;
  }

  if (tab === 'events') {
    return <EventsTimeline events={events} />;
  }

  return <BillingTab detail={detail} />;
}

// ───── 机架 / 交换机 / 节点 拓扑（§4.3.3：仅 vGPU 详情内，不设独立页面） ─────
function TopologyView({ nodes }: { nodes: Array<{ node_uid: string; rack_id: string | null; switch_group: string | null; state: string; straggler: boolean }> }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (nodes.length === 0) {
    return <EmptyState icon="🕸" title="该区域暂无节点拓扑数据" hint="切换区域或查看其他节点池" />;
  }
  const racks = new Map<string, typeof nodes>();
  for (const n of nodes) {
    const key = n.rack_id ?? 'unknown';
    const arr = racks.get(key) ?? [];
    arr.push(n);
    racks.set(key, arr);
  }
  return (
    <div className={s.col} style={{ gap: 12 }}>
      <div className={s.muted} style={{ fontSize: 12 }}>
        机架 → 交换机组 → 节点；节点按状态着色，straggler 加警示环。点击节点查看 UID。
      </div>
      {[...racks.entries()].map(([rack, list]) => (
        <div key={rack} className={s.card} style={{ padding: 12 }}>
          <div className={s.metricLabel} style={{ marginBottom: 8 }}>
            🗄 {rack}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {list.map((n) => {
              const c =
                n.state === 'ready' ? 'var(--rs-success)'
                : n.state === 'notready' ? 'var(--rs-danger)'
                : n.state === 'remediation' ? 'var(--rs-warning)'
                : n.state === 'draining' ? 'var(--rs-info)'
                : 'var(--rs-text-muted)';
              return (
                <button
                  key={n.node_uid}
                  type="button"
                  onClick={() => setSelected(n.node_uid)}
                  title={`${n.node_uid} · ${n.state}${n.straggler ? ' · straggler' : ''} · ${n.switch_group ?? '—'}`}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    border: `2px solid ${c}`,
                    background: selected === n.node_uid ? 'var(--rs-brand-soft)' : 'var(--rs-surface-2)',
                    color: 'var(--rs-text)',
                    cursor: 'pointer',
                    fontFamily: 'var(--rs-font-mono)',
                    fontSize: 10,
                    boxShadow: n.straggler ? `0 0 0 2px var(--rs-warning)` : undefined,
                  }}
                >
                  {n.node_uid.slice(0, 4)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {selected && (
        <div className={s.card} style={{ padding: 12 }}>
          <div className={s.mono} style={{ fontSize: 12 }}>
            选中节点：{selected}
          </div>
        </div>
      )}
    </div>
  );
}

export { toast };
