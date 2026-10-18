// 监控 Monitoring（PRD §4.7 运营 / MOCK-DATA §6.6 集群层指标）
// 训练效能口径：MFU / HFU / goodput / step_time / straggler_ratio / 通信开销 / 数据加载停顿 / 节点可用性；
// goodput 必须可由 MFU 与可用性派生（§7.6），本页只做展示不做二次计算。
import { useQuery } from '@tanstack/react-query';
import { Card, StatTile, Badge } from '../../components/ui';
import { ui as s } from '../../components/ui';
import { MetricChart } from '../../components/charts/MetricChart';
import { EP, api } from '../../lib/api-client';
import { useRegionStore } from '../../stores/auth';
import { REGION_META } from '../../lib/ids';
import { formatNumber } from '../../lib/money';
import type { MetricSeries } from '../../mocks/metrics';

/** 无时序点的指标（派生量展示位） */
const SUMMARY_KEYS = [
  'mfu',
  'goodput',
  'straggler_ratio',
  'communication_overhead',
  'data_loading_stall',
  'node_availability',
  'mean_time_to_remediation',
] as const;

export default function MonitoringPage() {
  const region = useRegionStore((st) => st.region);

  const { data: eff = {}, isLoading } = useQuery<Record<string, MetricSeries>>({
    queryKey: ['cluster-efficiency', region],
    queryFn: () => api.get<Record<string, MetricSeries>>(`${EP.clusterEfficiency}?region=${region}`),
  });

  const charts = (Object.values(eff) as MetricSeries[]).filter(
    (m) => m.points && m.points.length > 0,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s5)' }}>
      <Card
        title="集群训练效能"
        actions={isLoading ? <Badge tone="info">加载中…</Badge> : <Badge tone="muted">{REGION_META[region as keyof typeof REGION_META]?.label ?? region}</Badge>}
      >
        <p className={s.muted} style={{ marginTop: 0 }}>
          全部数值由后端 / Mock 派生层给出；Goodput 由 MFU × 节点可用性 × 重启开销 × straggler 修正派生（§7.6）。
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 'var(--rs-s4)',
          }}
        >
          {SUMMARY_KEYS.filter((k) => eff[k]).map((k) => {
            const m = eff[k] as MetricSeries;
            return (
              <StatTile
                key={k}
                label={m.label}
                value={`${formatNumber(m.current ?? 0, 1)} ${m.unit}`}
              />
            );
          })}
        </div>
      </Card>

      {charts.length > 0 && (
        <Card title="时序趋势（6h）">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 'var(--rs-s5)',
            }}
          >
            {charts.map((m) => (
              <MetricChart key={m.key} series={m} />
            ))}
          </div>
        </Card>
      )}

      <Card title="口径说明">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s2)' }}>
          {[
            ['MFU', '模型 FLOPs 利用率，实测 FLOPs / 硬件峰值 FLOPs'],
            ['HFU', '含重计算的 MFU，通常高于 MFU 5–15pp'],
            ['Goodput', '有效训练吞吐占比 = MFU × 可用性 × (1−重启开销) × (1−straggler 修正)'],
            ['Straggler 比', 'Step time P99 / P50，>1.2 视为存在落后者'],
            ['数据加载停顿', 'DataLoader 等待占比，反映 I/O 瓶颈'],
          ].map(([k, v]) => (
            <div key={k} className={s.row} style={{ alignItems: 'flex-start' }}>
              <Badge tone="muted">{k}</Badge>
              <span className={s.secondary}>{v}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
