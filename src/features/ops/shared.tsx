// 运营&运维共用件（§4.4.1：每页真实区域上下文 + 严谨派生展示）
import { t, dt } from '../../i18n';
import type { BadgeTone } from '../../components/ui';
import { formatPercent } from '../../lib/money';

export const NODE_STATE_META: Record<string, { label: string; tone: BadgeTone }> = {
  ready: { label: 'Ready', tone: 'success' },
  cordoned: { get label() { return t('ops.cordoned'); }, tone: 'warning' },
  draining: { get label() { return t('ops.draining'); }, tone: 'info' },
  remediation: { get label() { return t('ops.remediation'); }, tone: 'purple' },
  notready: { get label() { return t('ops.notReady'); }, tone: 'danger' },
};

export const NODE_STATE_COLOR: Record<string, string> = {
  ready: 'var(--rs-success)',
  cordoned: 'var(--rs-warning)',
  draining: 'var(--rs-info)',
  remediation: 'var(--rs-purple)',
  notready: 'var(--rs-danger)',
};

/** 运维事件类型（Xid + 运维动作，§4.4.1 事件流） */
export const EVENT_TYPE_META: Record<string, { label: string; tone: BadgeTone }> = {
  XID_13: { get label() { return t('xid.13'); }, tone: 'warning' },
  XID_31: { get label() { return t('xid.31'); }, tone: 'warning' },
  XID_48: { get label() { return t('xid.48'); }, tone: 'danger' },
  XID_63: { get label() { return t('xid.63'); }, tone: 'warning' },
  XID_64: { get label() { return t('xid.64'); }, tone: 'danger' },
  XID_74: { get label() { return t('xid.74'); }, tone: 'danger' },
  XID_79: { get label() { return t('xid.79'); }, tone: 'danger' },
  XID_94: { get label() { return t('xid.94'); }, tone: 'warning' },
  XID_109: { get label() { return t('xid.109'); }, tone: 'warning' },
  fail: { get label() { return t('ops.healthCheckFailed'); }, tone: 'danger' },
  cordon: { label: 'Cordon', tone: 'warning' },
  drain: { label: 'Drain', tone: 'warning' },
  evicted: { get label() { return t('ops.instanceEvict'); }, tone: 'warning' },
  remediate: { label: 'Remediation', tone: 'purple' },
  fixed: { get label() { return t('ops.hwRepair'); }, tone: 'success' },
  rejoin: { get label() { return t('ops.rejoin'); }, tone: 'success' },
};

export const EVENT_TYPE_GROUPS = [
  { value: 'all', get label() { return t('events.allEvents'); } },
  { value: 'xid', get label() { return t('events.xidOnly'); } },
  { value: 'maint', get label() { return t('events.opsActions'); } },
];

export const XID_TYPES = [
  'XID_13',
  'XID_31',
  'XID_48',
  'XID_63',
  'XID_64',
  'XID_74',
  'XID_79',
  'XID_94',
  'XID_109',
];
export const MAINT_TYPES = ['fail', 'cordon', 'drain', 'evicted', 'remediate', 'fixed', 'rejoin'];

export const TICKET_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  open: { get label() { return t('ticket.pending'); }, tone: 'danger' },
  pending: { get label() { return t('ticket.processing'); }, tone: 'warning' },
  resolved: { get label() { return t('ticket.resolved'); }, tone: 'success' },
  closed: { get label() { return t('ticket.closed'); }, tone: 'muted' },
};

export const TICKET_PRIORITY_META: Record<string, { label: string; tone: BadgeTone }> = {
  low: { get label() { return t('sev.low'); }, tone: 'muted' },
  normal: { get label() { return t('sev.medium'); }, tone: 'info' },
  high: { get label() { return t('sev.high'); }, tone: 'warning' },
  urgent: { get label() { return t('sev.critical'); }, tone: 'danger' },
};

export const WINDOW_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  scheduled: { get label() { return t('mw.planned'); }, tone: 'info' },
  in_progress: { get label() { return t('mw.inProgress'); }, tone: 'warning' },
  completed: { get label() { return t('mw.completed'); }, tone: 'success' },
};

const ORDER: string[] = ['ready', 'cordoned', 'draining', 'remediation', 'notready'];

/** 节点五态分布环图（§4.4.1 节点页必含区块） */
export function StateRing({ dist, size = 132 }: { dist: Record<string, number>; size?: number }) {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const healthy = dist.ready ?? 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={size} height={size} viewBox="0 0 128 128" role="img" aria-label={t('nodes.statusDistTitle')}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--rs-surface-2)" strokeWidth="12" />
        {total > 0 &&
          ORDER.map((k) => {
            const v = dist[k] ?? 0;
            if (v <= 0) return null;
            const dash = (v / total) * c;
            const el = (
              <circle
                key={k}
                cx="64"
                cy="64"
                r={r}
                fill="none"
                stroke={NODE_STATE_COLOR[k]}
                strokeWidth="12"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-acc * c}
                transform="rotate(-90 64 64)"
              />
            );
            acc += v / total;
            return el;
          })}
        <text
          x="64"
          y="60"
          textAnchor="middle"
          style={{ fontSize: 22, fontWeight: 700, fill: 'var(--rs-text)' }}
        >
          {total}
        </text>
        <text
          x="64"
          y="78"
          textAnchor="middle"
          style={{ fontSize: 11, fill: 'var(--rs-text-muted)' }}
        >
          {t('nodes.totalCount')}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
        {ORDER.map((k) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: NODE_STATE_COLOR[k],
                flex: 'none',
              }}
            />
            <span style={{ minWidth: 104, color: 'var(--rs-text-muted)' }}>
              {NODE_STATE_META[k].label.split('（')[0]}
            </span>
            <b>{dist[k] ?? 0}</b>
            <span style={{ color: 'var(--rs-text-muted)' }}>
              {total > 0 ? formatPercent(((dist[k] ?? 0) / total) * 100, 0) : '—'}
            </span>
          </div>
        ))}
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--rs-text-muted)' }}>
          {t('nodes.healthRateLine', { v0: total > 0 ? formatPercent((healthy / total) * 100, 1) : '—' })}</div>
      </div>
    </div>
  );
}

/** 趋势折线（成本页：非完美线性，含启停/扩容形态 G7） */
export function TrendLine({
  points,
  width = 640,
  height = 120,
}: {
  points: Array<{ ts: string; amount: number }>;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return <div style={{ fontSize: 12, color: 'var(--rs-text-muted)' }}>{t('chart.notEnoughData')}</div>;
  }
  const values = points.map((p) => p.amount);
  const max = Math.max(...values, 0.01);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);
  const y = (v: number): number => height - ((v - min) / span) * (height - 16) - 8;
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${y(p.amount).toFixed(1)}`)
    .join(' ');
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={t('cost.trend')}
    >
      <path d={d} fill="none" stroke="var(--rs-brand)" strokeWidth="2" />
      <path
        d={`${d} L${width},${height} L0,${height} Z`}
        fill="var(--rs-brand-soft)"
        opacity="0.5"
      />
    </svg>
  );
}

/** 事件 before → after 度量展示（MOCK-DATA §9 证据链） */
export function MetricDiff({
  before,
  after,
}: {
  before?: Record<string, number | string>;
  after?: Record<string, number | string>;
}) {
  if (!before && !after) return null;
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {keys.map((k) => {
        const b = before?.[k];
        const a = after?.[k];
        return (
          <span
            key={k}
            style={{
              fontSize: 11,
              fontFamily: 'var(--rs-font-mono)',
              border: '1px solid var(--rs-border)',
              borderRadius: 6,
              padding: '2px 6px',
            }}
          >
            {k}: <span style={{ color: 'var(--rs-text-muted)' }}>{dt(String(b ?? '—'))}</span>
            {' → '}
            <b>{dt(String(a ?? '—'))}</b>
          </span>
        );
      })}
    </div>
  );
}
