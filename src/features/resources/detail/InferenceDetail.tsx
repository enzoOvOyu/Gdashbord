// 推理服务详情（PRD §4.3.4：RunPod Serverless 端点 + vLLM/SGLang 指标语义）
import { t } from '../../../i18n';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ui as s,
  InfoCard,
  Badge,
  EmptyState,
  StatTile,
  Table,
  Card,
  Segmented,
  Progress,
} from '../../../components/ui';
import { MetricsGrid, RangeTabs, QuantileCards } from '../../shared/MetricsPanel';
import { EventsTimeline } from '../../shared/EventsTimeline';
import { BillingTab } from '../../shared/BillingTab';
import { ScalingTab } from './ScalingTab';
import { LogFilters, LogsList } from '../../shared/LogsView';
import {
  useEvents,
  useLogs,
  useMetrics,
  type ResourceDetail,
} from '../../shared/api';
import { formatNumber } from '../../../lib/money';
import { api } from '../../../lib/api-client';
import type { RangeKey } from '../../../mocks/lib/timeseries';
import type { InferenceSpec } from '../../../types/domain';
import { endpointsOf } from './endpoints';

type TabKey =
  | 'instances'
  | 'monitor'
  | 'serving'
  | 'logs'
  | 'config'
  | 'elastic'
  | 'events'
  | 'billing';

export const INFERENCE_TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'instances', get label() { return t('inf.instances'); } },
  { key: 'monitor', get label() { return t('detail.monitor'); } },
  { key: 'serving', get label() { return t('inf.governance'); } },
  { key: 'logs', get label() { return t('nav.logs'); } },
  { key: 'config', get label() { return t('detail.config'); } },
  { key: 'elastic', get label() { return t('detail.elastic'); } },
  { key: 'events', get label() { return t('detail.events'); } },
  { key: 'billing', get label() { return t('detail.billing'); } },
];

interface ReplicaView {
  name: string;
  phase: string;
  node: string;
  gpuCount: number;
  vramGb: number;
  rps: number;
  runningRequests: number;
  restarts: number;
  ageHours: number;
}

export function InferenceDetail({ detail, tab }: { detail: ResourceDetail; tab: TabKey }) {
  const spec = detail.spec_json as InferenceSpec;
  const [range, setRange] = useState<RangeKey>('1h');
  const [level, setLevel] = useState('all');
  const [logQ, setLogQ] = useState('');
  const { data: metrics = [] } = useMetrics(detail.resource_uuid as string, range);
  const { data: events = [] } = useEvents(detail.resource_uuid as string);
  const { data: logs = [] } = useLogs(detail.resource_uuid as string, level, logQ);
  const { data: replicaData } = useQuery<{ replicas: ReplicaView[] }>({
    queryKey: ['workloads', detail.resource_uuid],
    queryFn: () => api.get<{ replicas: ReplicaView[] }>(`/api/resources/${detail.resource_uuid as string}/workloads`),
  });
  const replicas = replicaData?.replicas ?? [];
  const ep = endpointsOf(detail);
  const metricOf = (key: string) => metrics.find((m) => m.key === key)?.current ?? null;

  if (tab === 'instances') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <StatTile
            label={t('inf.replicasCurrentDesired')}
            value={`${replicas.filter((r) => r.phase === 'Running').length} / ${spec.replicas}`}
            hint={
              replicas.filter((r) => r.phase === 'Running').length !== spec.replicas
                ? t('inf.hpaScaling')
                : t('inf.replicasMatch')
            }
          />
          <StatTile
            label={t('inf.totalRps')}
            value={formatNumber(replicas.reduce((a, b) => a + b.rps, 0), 1)}
          />
          <StatTile
            label={t('inf.concurrent')}
            value={formatNumber(replicas.reduce((a, b) => a + b.runningRequests, 0), 0)}
          />
          <StatTile
            label="HPA"
            value={spec.hpa ? `${spec.hpa.min}–${spec.hpa.max}` : t('common.disabled')}
            hint={spec.hpa ? t('inf.metricTarget', { v0: spec.hpa.metric, v1: spec.hpa.target }) : undefined}
          />
        </div>
        <Table
          rows={replicas}
          rowKey={(r) => r.name}
          zebra
          empty={<EmptyState icon="📦" title={t('inf.noReplicas')} />}
          columns={[
            { key: 'name', header: t('inf.replica'), mono: true, render: (r) => r.name },
            {
              key: 'phase',
              header: 'Phase',
              render: (r) => (
                <Badge tone={r.phase === 'Running' ? 'success' : r.phase === 'Failed' ? 'danger' : 'warning'}>
                  {r.phase}
                </Badge>
              ),
            },
            { key: 'node', header: t('inf.node'), render: (r) => r.node },
            { key: 'gpu', header: t('common.gpuNum'), numeric: true, render: (r) => r.gpuCount },
            { key: 'vram', header: t('common.gpuMemory'), numeric: true, render: (r) => `${r.vramGb} GB` },
            { key: 'rps', header: 'RPS', numeric: true, render: (r) => formatNumber(r.rps, 1) },
            {
              key: 'running',
              header: t('inf.runningReqs'),
              numeric: true,
              render: (r) => r.runningRequests,
            },
            { key: 'restarts', header: t('inf.restarts'), numeric: true, render: (r) => r.restarts },
          ]}
        />
      </div>
    );
  }

  if (tab === 'monitor') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <RangeTabs value={range} onChange={setRange} />
        <div>
          <h2 className={s.sectionTitle} style={{ marginBottom: 12 }}>
            {t('inf.latencyQuantiles')}
          </h2>
          <QuantileCards
            items={[
              { label: 'TTFT P50', value: metricOf('ttft_p50'), unit: 'ms', threshold: 1500 },
              { label: 'TTFT P90', value: metricOf('ttft_p90'), unit: 'ms', threshold: 3000 },
              { label: 'TTFT P99', value: metricOf('ttft_p99'), unit: 'ms', threshold: 5000 },
              { label: 'TPOT P50', value: metricOf('tpot_p50'), unit: 'ms', threshold: 60 },
              { label: 'TPOT P99', value: metricOf('tpot_p99'), unit: 'ms', threshold: 100 },
              { label: 'E2E P99', value: metricOf('e2e_latency_p99'), unit: 'ms', threshold: 8000 },
            ]}
          />
        </div>
        <MetricsGrid metrics={metrics} />
        {metrics.length === 0 && (
          <EmptyState icon="📉" title={t('common.noMetrics')} hint={t('detail.serviceOff')} />
        )}
      </div>
    );
  }

  if (tab === 'serving') {
    const traffic = spec.canary
      ? [
          { version: 'v1 (stable)', weight: 100 - spec.canary.traffic_percent },
          { version: 'v2 (canary)', weight: spec.canary.traffic_percent },
        ]
      : [{ version: 'v1', weight: 100 }];
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <InfoCard
          title="Endpoints"
          items={[
            { label: t('inf.serviceUrl'), value: `${ep.apiBase}/chat/completions`, mono: true },
            { label: t('inf.modelName'), value: spec.model_ref },
            {
              label: t('inf.authMode'),
              value: spec.auth_enabled ? t('inf.apiKeyOnce') : t('inf.noAuth'),
            },
            { label: t('common.port'), value: spec.port },
          ]}
        />
        <Card>
          <div className={s.cardHeader}>
            <div className={s.cardTitle}>{t('inf.canaryTraffic')}</div>
          </div>
          <div className={s.cardBody}>
            {traffic.map((t) => (
              <div key={t.version} style={{ marginBottom: 10 }}>
                <Progress
                  value={t.weight}
                  max={100}
                  label={t.version}
                  right={`${t.weight}%`}
                />
              </div>
            ))}
            {!spec.canary && (
              <div className={s.muted} style={{ fontSize: 12 }}>
                {t('inf.noCanary')}
              </div>
            )}
          </div>
        </Card>
        <InfoCard
          title={t('inf.gatewayPolicy')}
          items={[
            { label: t('common.engine'), value: spec.engine },
            { label: t('inf.maxBatch'), value: spec.max_batch_size ?? '—' },
            { label: t('inf.prefixCache'), value: spec.enable_prefix_caching ? t('common.on') : t('common.off') },
            { label: 'Chunked Prefill', value: spec.enable_chunked_prefill ? t('common.on') : t('common.off') },
            { label: t('inf.warm'), value: spec.cold_standby ? t('common.on') : t('common.off') },
          ]}
        />
      </div>
    );
  }

  if (tab === 'logs') {
    return (
      <div className={s.col} style={{ gap: 12 }}>
        <LogFilters level={level} onLevel={setLevel} q={logQ} onQ={setLogQ} />
        <LogsList logs={logs} />
      </div>
    );
  }

  if (tab === 'config') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <InfoCard
          title={t('inf.modelEngine')}
          items={[
            { label: t('common.model'), value: spec.model_ref },
            { label: t('inf.modelSlug'), value: spec.model_slug, mono: true },
            { label: t('common.quantization'), value: spec.quantization },
            { label: 'max_model_len', value: formatNumber(spec.max_model_len) },
            { label: t('common.engine'), value: spec.engine },
            { label: 'max_batch_size', value: spec.max_batch_size ?? '—' },
            { label: t('inf.prefixCache'), value: spec.enable_prefix_caching ? t('common.on') : t('common.off') },
            { label: t('common.port'), value: spec.port },
          ]}
        />
        <InfoCard
          title={t('common.envVars')}
          items={Object.entries(spec.env ?? {}).map(([k, v]) => ({ label: k, value: v, mono: true }))}
        />
        <Segmented
          options={[{ value: 'curl', label: t('inf.curlExample') }]}
          value="curl"
          onChange={() => undefined}
        />
        <pre
          style={{
            background: 'var(--rs-surface-2)',
            padding: 12,
            borderRadius: 8,
            fontSize: 12,
            overflowX: 'auto',
          }}
        >
{`curl ${ep.apiBase}/chat/completions \\
  -H "Authorization: Bearer $RUNSUN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"${spec.model_ref}","messages":[{"role":"user","content":"hi"}]}'`}
        </pre>
      </div>
    );
  }

  if (tab === 'events') {
    return <EventsTimeline events={events} />;
  }

  if (tab === 'elastic') {
    return <ScalingTab resourceUuid={detail.resource_uuid as string} />;
  }

  return <BillingTab detail={detail} />;
}
