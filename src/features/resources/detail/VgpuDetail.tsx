// vGPU 详情（PRD §4.3.3：CoreWeave CKS / 火山引擎 VKE 三级视图 —— 控制面 → 节点池 → 工作负载）
import { t, dt } from '../../../i18n';
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
import { ScalingTab } from './ScalingTab';
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
  | 'elastic'
  | 'events'
  | 'billing';

export const VGPU_TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', get label() { return t('detail.overview'); } },
  { key: 'control', get label() { return t('deploy.cpStep'); } },
  { key: 'pools', get label() { return t('common.nodePool'); } },
  { key: 'workloads', get label() { return t('vgpu.workloads'); } },
  { key: 'network', get label() { return t('detail.netStorage'); } },
  ...(VITE_FEATURE_TOPOLOGY ? [{ key: 'topology' as TabKey, get label() { return t('vgpu.topology'); } }] : []),
  { key: 'elastic', get label() { return t('detail.elastic'); } },
  { key: 'events', get label() { return t('detail.events'); } },
  { key: 'billing', get label() { return t('detail.billing'); } },
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
          title={t('vgpu.clusterInfo')}
          items={[
            { label: t('vgpu.clusterName'), value: detail.name },
            { label: t('deploy.k8sVersion'), value: `v${spec.k8s_version}` },
            { label: t('deploy.cpSpec'), value: spec.control_plane_tier === 'ha' ? t('vgpu.ha3') : t('vgpu.std1') },
            {
              label: t('common.region'),
              value: `${REGION_META[detail.region].label} ${REGION_META[detail.region].iso}`,
            },
            { label: t('vgpu.poolCount'), value: spec.pools.length },
            { label: t('common.nodeCount'), value: spec.node_count },
            { label: 'API Server', value: `https://${detail.resource_uuid as string}.${detail.region}.cks.runsun.cloud:6443`, mono: true },
            { label: t('common.createdAtFull'), value: formatDateTime(detail.created_at) },
            { label: t('deploy.cni'), value: spec.network_plugin },
            { label: t('vgpu.kubeconfig'), value: spec.kubeconfig_access === 'download' ? t('common.download') : t('common.managedConsole') },
          ]}
        />
        <div>
          <div className={s.metricLabel} style={{ marginBottom: 6 }}>
            {t('vgpu.capacityVsAllocated')}</div>
          <Progress
            value={allocated}
            max={totalGpu}
            label={t('vgpu.allocated', { v0: allocated, v1: totalGpu })}
            right={`${((allocated / Math.max(totalGpu, 1)) * 100).toFixed(1)}%`}
          />
        </div>
        <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <StatTile
            label={t('vgpu.cpFee')}
            value={t('vgpu.cpRate', { v0: formatUsdRate(detail.cost.control_plane_per_hour) })}
            hint={spec.control_plane_tier === 'ha' ? t('vgpu.haNote') : 'Standard'}
          />
          <StatTile label={t('detail.currentHourly')} value={formatUsd(detail.cost.per_hour)} hint={detail.cost.metering_note} />
          <StatTile label={t('cost.mtd')} value={formatUsd(detail.cost_summary.mtd)} />
          <StatTile
            label={t('common.uptime')}
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
          title={t('vgpu.components')}
          items={[
            { label: 'API Server', value: t('vgpu.readyCount', { v0: spec.control_plane_tier === 'ha' ? '3/3' : '1/1' }) },
            { label: 'etcd', value: t('vgpu.readyCount', { v0: spec.control_plane_tier === 'ha' ? '3/3' : '1/1' }) },
            { label: 'Scheduler', value: t('vgpu.ready11') },
            { label: 'Controller-Manager', value: t('vgpu.ready11') },
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
                  {p.autoscale ? `Autoscaler ${p.autoscale.min}–${p.autoscale.max}` : t('vgpu.autoScaleOff')}
                </Badge>
              </div>
            </div>
            <div className={s.cardBody}>
              <KeyValue
                items={[
                  { label: t('common.nodeCount'), value: p.node_count },
                  { label: t('rlp.gpuTotal'), value: p.node_count * gpusPer },
                  {
                    label: t('vgpu.slicePolicy'),
                    value:
                      p.slicing_policy === 'none' ? t('vgpu.fullPassthrough')
                      : p.slicing_policy === 'mig' ? t('vgpu.migProfile', { v0: p.mig_profile ?? '—' })
                      : p.slicing_policy === 'time_slicing' ? t('vgpu.timeSlicing', { v0: p.time_slice_share ?? '—' })
                      : 'MPS',
                  },
                  { label: t('common.machineType'), value: dt(GPU_SPECS[p.node_pool as keyof typeof GPU_SPECS].productName) },
                ]}
              />
              <h3 className={s.sectionTitle} style={{ margin: '16px 0 8px' }}>
                {t('vgpu.nodeList')}
              </h3>
              <Table
                rows={poolNodes.slice(0, 12)}
                rowKey={(n) => n.node_uid}
                empty={<EmptyState icon="🖥" title={t('vgpu.noNodes')} />}
                columns={[
                  { key: 'uid', header: t('nodes.uid'), mono: true, render: (n) => n.node_uid.slice(0, 12) },
                  {
                    key: 'state',
                    header: t('common.status'),
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
                  { key: 'rack', header: t('common.rack'), mono: true, render: (n) => n.rack_id ?? '—' },
                  { key: 'switch', header: t('common.switchGroup'), render: (n) => n.switch_group ?? '—' },
                  {
                    key: 'straggler',
                    header: 'Straggler',
                    render: (n) => (n.straggler ? <Badge tone="warning">{t('nodes.slowNode')}</Badge> : '—'),
                  },
                  { key: 'hosted', header: t('pools.bearingResources'), numeric: true, render: (n) => n.hosted_resources },
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
            {t('vgpu.podPhases')}</h2>
          <KeyValue
            items={Object.entries(wl?.phaseDistribution ?? {}).map(([k, v]) => ({
              label: k,
              value: v,
            }))}
          />
        </div>
        <div>
          <h2 className={s.sectionTitle} style={{ marginBottom: 12 }}>
            {t('vgpu.schedFailTopN')}
          </h2>
          {(wl?.schedulingFailures ?? []).length === 0 ? (
            <EmptyState icon="✅" title={t('vgpu.noSchedFail')} />
          ) : (
            <Table
              rows={wl?.schedulingFailures ?? []}
              rowKey={(f) => f.reason}
              columns={[
                { key: 'reason', header: t('vgpu.failedReason'), render: (f) => f.reason, mono: true },
                { key: 'count', header: t('common.count'), numeric: true, render: (f) => f.count },
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
                      { key: 'node', header: t('inf.node'), render: (p) => p.node ?? '—' },
                      { key: 'restarts', header: t('inf.restarts'), numeric: true, render: (p) => p.restarts },
                      { key: 'oom', header: 'OOMKilled', numeric: true, render: (p) => p.oomKilled },
                      {
                        key: 'reason',
                        header: t('vgpu.waitingReason'),
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
          title={t('common.network')}
          items={[
            { label: t('vgpu.cniPlugin'), value: spec.network_plugin },
            { label: 'Ingress', value: spec.ingress_enabled ? t('vgpu.enabledValue', { v0: spec.ingress_class ?? 'nginx' }) : t('common.disabled') },
            { label: 'InfiniBand', value: spec.ib_enabled ? t('common.enabled') : t('common.disabled') },
            { label: t('deploy.apiPublic'), value: spec.api_server_public ? t('common.opened') : t('vgpu.privateOnly') },
          ]}
        />
        <InfoCard
          title={t('common.storage')}
          items={[
            { label: 'StorageClass', value: spec.storage_class },
            { label: t('vgpu.defaultPvc'), value: spec.default_pvc_gb ? `${spec.default_pvc_gb} GB` : t('vgpu.notProvisioned') },
            { label: t('vgpu.pvcCapacity'), value: `${spec.storage_gb} GB` },
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

  if (tab === 'elastic') {
    return <ScalingTab resourceUuid={detail.resource_uuid as string} />;
  }

  return <BillingTab detail={detail} />;
}

// ───── 机架 / 交换机 / 节点 拓扑（§4.3.3：仅 vGPU 详情内，不设独立页面） ─────
function TopologyView({ nodes }: { nodes: Array<{ node_uid: string; rack_id: string | null; switch_group: string | null; state: string; straggler: boolean }> }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (nodes.length === 0) {
    return <EmptyState icon="🕸" title={t('vgpu.noTopology')} hint={t('vgpu.topologyHint')} />;
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
        {t('vgpu.topologyLegend')}
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
            {t('vgpu.selectedNode', { v0: selected })}
          </div>
        </div>
      )}
    </div>
  );
}

export { toast };
