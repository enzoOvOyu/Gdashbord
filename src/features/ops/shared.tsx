// 运营&运维共用件（§4.4.1：每页真实区域上下文 + 严谨派生展示）
import type { BadgeTone } from '../../components/ui';
import { formatPercent } from '../../lib/money';

export const NODE_STATE_META: Record<string, { label: string; tone: BadgeTone }> = {
  ready: { label: 'Ready', tone: 'success' },
  cordoned: { label: 'Cordoned（禁止新调度）', tone: 'warning' },
  draining: { label: 'Draining（驱逐中）', tone: 'info' },
  remediation: { label: 'Remediation（自愈中）', tone: 'purple' },
  notready: { label: 'NotReady（不可调度）', tone: 'danger' },
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
  XID_13: { label: 'Xid 13 图形引擎异常', tone: 'warning' },
  XID_31: { label: 'Xid 31 MMU 缺页', tone: 'warning' },
  XID_48: { label: 'Xid 48 双比特 ECC', tone: 'danger' },
  XID_63: { label: 'Xid 63 行重映射', tone: 'warning' },
  XID_64: { label: 'Xid 64 行重映射失败', tone: 'danger' },
  XID_74: { label: 'Xid 74 NVLink 错误', tone: 'danger' },
  XID_79: { label: 'Xid 79 GPU 掉卡', tone: 'danger' },
  XID_94: { label: 'Xid 94 可包含 ECC', tone: 'warning' },
  XID_109: { label: 'Xid 109 上下文切换超时', tone: 'warning' },
  fail: { label: '健康检查失败', tone: 'danger' },
  cordon: { label: 'Cordon', tone: 'warning' },
  drain: { label: 'Drain', tone: 'warning' },
  evicted: { label: '实例驱逐', tone: 'warning' },
  remediate: { label: 'Remediation', tone: 'purple' },
  fixed: { label: '硬件修复', tone: 'success' },
  rejoin: { label: '重新加入调度', tone: 'success' },
};

export const EVENT_TYPE_GROUPS = [
  { value: 'all', label: '全部事件' },
  { value: 'xid', label: 'Xid 硬件事件' },
  { value: 'maint', label: '运维动作' },
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
  open: { label: '待处理', tone: 'danger' },
  pending: { label: '处理中', tone: 'warning' },
  resolved: { label: '已解决', tone: 'success' },
  closed: { label: '已关闭', tone: 'muted' },
};

export const TICKET_PRIORITY_META: Record<string, { label: string; tone: BadgeTone }> = {
  low: { label: '低', tone: 'muted' },
  normal: { label: '中', tone: 'info' },
  high: { label: '高', tone: 'warning' },
  urgent: { label: '紧急', tone: 'danger' },
};

export const WINDOW_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  scheduled: { label: '已计划', tone: 'info' },
  in_progress: { label: '进行中', tone: 'warning' },
  completed: { label: '已完成', tone: 'success' },
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
      <svg width={size} height={size} viewBox="0 0 128 128" role="img" aria-label="节点状态分布">
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
          节点总数
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
          健康率 {total > 0 ? formatPercent((healthy / total) * 100, 1) : '—'}
        </div>
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
    return <div style={{ fontSize: 12, color: 'var(--rs-text-muted)' }}>趋势数据不足</div>;
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
      aria-label="成本趋势"
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
            {k}: <span style={{ color: 'var(--rs-text-muted)' }}>{String(b ?? '—')}</span>
            {' → '}
            <b>{String(a ?? '—')}</b>
          </span>
        );
      })}
    </div>
  );
}
