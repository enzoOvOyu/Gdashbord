// 推理服务详情（PRD §4.3.4：RunPod Serverless 端点 + vLLM/SGLang 指标语义）
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
  | 'events'
  | 'billing';

export const INFERENCE_TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'instances', label: '实例管理' },
  { key: 'monitor', label: '监控' },
  { key: 'serving', label: '服务治理' },
  { key: 'logs', label: '日志' },
  { key: 'config', label: '配置' },
  { key: 'events', label: '事件' },
  { key: 'billing', label: '计费' },
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
            label="副本数（当前/期望）"
            value={`${replicas.filter((r) => r.phase === 'Running').length} / ${spec.replicas}`}
            hint={
              replicas.filter((r) => r.phase === 'Running').length !== spec.replicas
                ? 'HPA 扩缩中，长时间不等需告警'
                : '副本数与期望一致'
            }
          />
          <StatTile
            label="总 RPS"
            value={formatNumber(replicas.reduce((a, b) => a + b.rps, 0), 1)}
          />
          <StatTile
            label="并发请求"
            value={formatNumber(replicas.reduce((a, b) => a + b.runningRequests, 0), 0)}
          />
          <StatTile
            label="HPA"
            value={spec.hpa ? `${spec.hpa.min}–${spec.hpa.max}` : '未启用'}
            hint={spec.hpa ? `指标 ${spec.hpa.metric} ≤ ${spec.hpa.target}` : undefined}
          />
        </div>
        <Table
          rows={replicas}
          rowKey={(r) => r.name}
          zebra
          empty={<EmptyState icon="📦" title="暂无副本" />}
          columns={[
            { key: 'name', header: '副本', mono: true, render: (r) => r.name },
            {
              key: 'phase',
              header: 'Phase',
              render: (r) => (
                <Badge tone={r.phase === 'Running' ? 'success' : r.phase === 'Failed' ? 'danger' : 'warning'}>
                  {r.phase}
                </Badge>
              ),
            },
            { key: 'node', header: '所在节点', render: (r) => r.node },
            { key: 'gpu', header: 'GPU 数', numeric: true, render: (r) => r.gpuCount },
            { key: 'vram', header: '显存', numeric: true, render: (r) => `${r.vramGb} GB` },
            { key: 'rps', header: 'RPS', numeric: true, render: (r) => formatNumber(r.rps, 1) },
            {
              key: 'running',
              header: '运行中请求',
              numeric: true,
              render: (r) => r.runningRequests,
            },
            { key: 'restarts', header: '重启次数', numeric: true, render: (r) => r.restarts },
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
            延迟分位（vLLM 语义）
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
          <EmptyState icon="📉" title="暂无指标" hint="服务已停用或正在供给" />
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
            { label: '服务 URL', value: `${ep.apiBase}/chat/completions`, mono: true },
            { label: '模型名', value: spec.model_ref },
            {
              label: '鉴权方式',
              value: spec.auth_enabled ? 'API Key（创建时展示一次）' : '无鉴权',
            },
            { label: '端口', value: spec.port },
          ]}
        />
        <Card>
          <div className={s.cardHeader}>
            <div className={s.cardTitle}>灰度与流量</div>
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
                未开启灰度；可在创建时配置 canary 副本与流量比例。
              </div>
            )}
          </div>
        </Card>
        <InfoCard
          title="网关策略"
          items={[
            { label: '引擎', value: spec.engine },
            { label: '最大 batch', value: spec.max_batch_size ?? '—' },
            { label: '前缀缓存', value: spec.enable_prefix_caching ? '启用' : '关闭' },
            { label: 'Chunked Prefill', value: spec.enable_chunked_prefill ? '启用' : '关闭' },
            { label: '冷备', value: spec.cold_standby ? '启用' : '关闭' },
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
          title="模型与引擎"
          items={[
            { label: '模型', value: spec.model_ref },
            { label: '模型 slug', value: spec.model_slug, mono: true },
            { label: '量化', value: spec.quantization },
            { label: 'max_model_len', value: formatNumber(spec.max_model_len) },
            { label: '引擎', value: spec.engine },
            { label: 'max_batch_size', value: spec.max_batch_size ?? '—' },
            { label: '前缀缓存', value: spec.enable_prefix_caching ? '启用' : '关闭' },
            { label: '端口', value: spec.port },
          ]}
        />
        <InfoCard
          title="环境变量"
          items={Object.entries(spec.env ?? {}).map(([k, v]) => ({ label: k, value: v, mono: true }))}
        />
        <Segmented
          options={[{ value: 'curl', label: 'cURL 调用示例' }]}
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

  return <BillingTab detail={detail} />;
}
