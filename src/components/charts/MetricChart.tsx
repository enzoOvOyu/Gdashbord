// 图表外框与指标图（DESIGN-SYSTEM §5.15 ChartFrame / §7 数据可视化规范）
// 量程固定（利用率 0–100%）；阈值线虚线 + 标签（阈值由 thresholds 下发，组件不硬编码）；
// 无数据渲染断点而非 0 线（connectNulls=false）。
import { t, dt } from '../../i18n';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { MetricSeries } from '../../mocks/metrics';
import { semanticOf } from '../../mocks/fixtures/thresholds';
import { formatTime, formatUtcTooltip } from '../../lib/date';
import { formatNumber } from '../../lib/money';

const SEMANTIC_COLOR: Record<string, string> = {
  normal: 'var(--rs-success)',
  notice: 'var(--rs-info)',
  warning: 'var(--rs-warning)',
  critical: 'var(--rs-danger)',
  nodata: 'var(--rs-text-muted)',
};

export interface MetricChartProps {
  series: MetricSeries;
  height?: number;
  showThreshold?: boolean;
}

export function MetricChart({ series, height = 180, showThreshold = true }: MetricChartProps) {
  const semantic = semanticOf(series.key, series.current);
  const color = SEMANTIC_COLOR[semantic];
  const axis = series.threshold?.axis ?? [undefined, undefined];
  const data = series.points.map((p) => ({ t: p.t, v: p.v }));

  const thresholdValue =
    series.threshold?.warning ?? series.threshold?.critical ?? undefined;

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 'var(--rs-fs-sm)', color: 'var(--rs-text-secondary)' }}>
          {dt(series.label)}
        </span>
        <span
          style={{
            fontSize: 'var(--rs-fs-md)',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color,
          }}
        >
          {series.current === null ? (
            <span style={{ color: 'var(--rs-text-muted)', fontSize: 'var(--rs-fs-sm)' }}>
              {t('chart.emptySeries')}</span>
          ) : (
            <>
              {formatNumber(series.current, series.unit === '%' ? 1 : 0)} {series.unit}
              {series.threshold && (
                <span
                  style={{
                    fontSize: 'var(--rs-fs-xs)',
                    color: 'var(--rs-text-muted)',
                    marginLeft: 6,
                    fontWeight: 400,
                  }}
                >
                  {t('chart.thresholdValue', { v0: series.threshold.warning ?? series.threshold.critical, v1: series.threshold.unit })}
                </span>
              )}
            </>
          )}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id={`g-${series.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--rs-brand)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--rs-brand)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--rs-border)" vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={(t: string) => formatTime(t).slice(0, 5)}
            tick={{ fontSize: 11, fill: 'var(--rs-text-muted)' }}
            stroke="var(--rs-border)"
            minTickGap={40}
          />
          <YAxis
            domain={axis[0] !== undefined ? [axis[0], axis[1]] : ['auto', 'auto']}
            tick={{ fontSize: 11, fill: 'var(--rs-text-muted)' }}
            stroke="var(--rs-border)"
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--rs-bg)',
              border: '1px solid var(--rs-border)',
              borderRadius: 'var(--rs-r-md)',
              fontSize: 12,
            }}
            labelFormatter={(t) => formatUtcTooltip(String(t))}
            formatter={(v) => {
              const val = typeof v === 'number' ? v : null;
              return val === null
                ? [t('chart.noData'), series.label]
                : [`${formatNumber(val, 1)} ${dt(series.unit)}`, dt(series.label)];
            }}
          />
          {showThreshold && thresholdValue !== undefined && (
            <ReferenceLine
              y={thresholdValue}
              stroke={color}
              strokeDasharray="4 4"
              label={{
                value: t('chart.thresholdShort', { v0: thresholdValue }),
                position: 'insideTopRight',
                fontSize: 10,
                fill: 'var(--rs-text-muted)',
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="v"
            stroke="var(--rs-brand)"
            fill={`url(#g-${series.key})`}
            strokeWidth={2}
            connectNulls={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 迷你走势（sparkline，DESIGN §8.3：指标卡五要素之一） */
export function Sparkline({ points, color = 'var(--rs-brand)' }: { points: Array<{ t: string; v: number | null }>; color?: string }) {
  const vals = points.filter((p) => p.v !== null).map((p) => p.v as number);
  if (vals.length < 2) return <span style={{ color: 'var(--rs-text-muted)' }}>–</span>;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 72;
  const h = 20;
  const d = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
