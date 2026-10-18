// 指标面板（把 /api/metrics/* 的 MetricSeries 渲染为 DESIGN §8.3 指标卡 + 缩略图）
import { ui as s, MetricCard, Segmented, EmptyState } from '../../components/ui';
import { formatNumber, formatPercent } from '../../lib/money';
import type { RangeKey } from '../../mocks/lib/timeseries';
import type { MetricSeries } from '../../mocks/metrics';
import { semanticOf, type MetricSemantic } from '../../mocks/fixtures/thresholds';

export const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
];

export function RangeTabs({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (r: RangeKey) => void;
}) {
  return <Segmented options={RANGE_OPTIONS} value={value} onChange={onChange} ariaLabel="时间范围" />;
}

const fmt = (v: number | null): string => (v === null ? '—' : formatNumber(v, 1));

function thresholdText(m: MetricSeries): string {
  const t = m.threshold;
  if (!t) return '';
  const warn = t.warning != null ? `警告 ${t.warning}${t.unit}` : null;
  const crit = t.critical != null ? `严重 ${t.critical}${t.unit}` : null;
  const parts = [warn, crit].filter(Boolean);
  return parts.length ? `阈值：${parts.join(' / ')}` : `正常区间 ${t.normal[0]}–${t.normal[1]}${t.unit}`;
}

const SEM_COLOR: Record<MetricSemantic, string> = {
  normal: 'var(--rs-text-secondary)',
  notice: 'var(--rs-info)',
  warning: 'var(--rs-warning)',
  critical: 'var(--rs-danger)',
  nodata: 'var(--rs-text-muted)',
};

export function MetricsGrid({ metrics }: { metrics: MetricSeries[] }) {
  if (!metrics || metrics.length === 0) {
    return <EmptyState icon="📉" title="暂无指标" hint="资源处于供给中或已停止时不采集指标" />;
  }
  return (
    <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
      {metrics.map((m) => {
        const sem = m.current === null ? 'nodata' : semanticOf(m.key, m.current);
        return (
          <MetricCard
            key={m.key}
            label={m.label}
            value={fmt(m.current)}
            unit={m.unit}
            semantic={sem}
            color={SEM_COLOR[sem]}
            thresholdText={thresholdText(m)}
            points={m.points
              .filter((p): p is { t: string; v: number } => p.v !== null)
              .map((p) => ({ t: new Date(p.t).getTime(), v: p.v }))}
          />
        );
      })}
    </div>
  );
}

/** 分位数展示（P50/P90/P99 卡片组，推理延迟专用） */
export function QuantileCards({
  items,
}: {
  items: Array<{ label: string; value: number | null; unit: string; threshold?: number }>;
}) {
  return (
    <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
      {items.map((it) => {
        const over = it.threshold != null && it.value != null && it.value > it.threshold;
        return (
          <div className={s.card} key={it.label} style={{ padding: 12 }}>
            <div className={s.metricLabel}>{it.label}</div>
            <div
              className={s.metricValue}
              style={{ color: over ? 'var(--rs-warning)' : undefined }}
            >
              {it.value === null ? '—' : formatNumber(it.value, 0)}
              <span className={s.metricUnit}> {it.unit}</span>
            </div>
            {it.threshold != null && (
              <div className={s.metricFoot}>阈值 ≤ {it.threshold}{it.unit}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { formatPercent };
