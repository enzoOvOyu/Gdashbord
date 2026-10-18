// StatusBar 顶部状态栏（PRD §3.2 / DESIGN-SYSTEM §5.17；高度 40px，surface-2 底）
// 状态簇：服务健康 / 区域算力供给 / 余额 / 本月花费 / 运行中资源 / 实时指示。
// 颜色 + 图标 + 文本并存（可访问性）；「算力紧张」判据 available/total < 0.15（MOCK-DATA §6.7）。
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import s from './layout.module.css';
import { EP, api } from '../../lib/api-client';
import { useRegionStore } from '../../stores/auth';
import { REGION_META } from '../../lib/ids';
import { formatUsd } from '../../lib/money';
import { VITE_FEATURE_STATUS_BAR } from '../../mocks/lib/env';

interface StatusBarData {
  region: string;
  service_health: 'ok' | 'degraded' | 'down';
  healthy_ratio: number;
  incident_count: number;
  supplies: Array<{
    code: string;
    display_name: string;
    totalGpu: number;
    availableGpu: number;
    tight: boolean;
  }>;
  credit_balance: number;
  low_balance_threshold: number;
  cost_mtd: number;
  budget: number;
  running_by_kind: Record<string, number>;
  running_total: number;
  ping_ms: number;
}

const HEALTH = {
  ok: { text: '服务正常', icon: '✓', color: 'var(--rs-success)' },
  degraded: { text: '服务降级', icon: '⚠', color: 'var(--rs-warning)' },
  down: { text: '服务故障', icon: '✕', color: 'var(--rs-danger)' },
} as const;

export function StatusBar() {
  const region = useRegionStore((st) => st.region);
  const { data } = useQuery<StatusBarData>({
    queryKey: ['status-bar', region],
    queryFn: () => api.get<StatusBarData>(`${EP.statusBar}?region=${region}`),
    refetchInterval: 15_000,
  });

  if (!VITE_FEATURE_STATUS_BAR) return null;
  if (!data) return <div className={s.statusbar} />;

  const h = HEALTH[data.service_health];
  const lowBalance = data.credit_balance < data.low_balance_threshold;
  const overBudget = data.cost_mtd / data.budget > 0.9;
  const tightPools = data.supplies.filter((x) => x.tight);

  return (
    <div className={s.statusbar} role="status" aria-label="运营状态">
      {/* 服务健康 */}
      <span className={s.statusItem} style={{ color: h.color }}>
        <span aria-hidden>{h.icon}</span>
        {h.text}
        {data.incident_count > 0 && ` · ${data.incident_count} 起事件`}
      </span>

      {/* 区域与算力供给 */}
      <span className={s.statusItem}>
        <span aria-hidden>📍</span>
        {REGION_META[region as keyof typeof REGION_META]?.label ?? region} ·{' '}
        {tightPools.length === 0 ? (
          <span style={{ color: 'var(--rs-success)' }}>算力充足</span>
        ) : (
          <span style={{ color: 'var(--rs-warning)' }}>
            {tightPools.map((p) => `${p.display_name} 紧张`).join(' / ')}
          </span>
        )}
      </span>

      {/* 账户余额 */}
      <Link
        to="/operations/cost"
        className={clsx(s.statusItem, s.statusItemClickable)}
        style={{ color: lowBalance ? 'var(--rs-warning)' : undefined }}
      >
        <span aria-hidden>💳</span>
        余额 {formatUsd(data.credit_balance)}
        {lowBalance && ' · 低于阈值，请充值'}
      </Link>

      {/* 本月花费 */}
      <Link
        to="/operations/cost"
        className={clsx(s.statusItem, s.statusItemClickable)}
        style={{ color: overBudget ? 'var(--rs-warning)' : undefined }}
      >
        <span aria-hidden>📊</span>
        本月 {formatUsd(data.cost_mtd)}
      </Link>

      {/* 运行中资源 */}
      <Link to="/resources/servers" className={clsx(s.statusItem, s.statusItemClickable)}>
        <span aria-hidden>🖥</span>
        运行中 {data.running_total}
      </Link>

      {/* 实时指示 */}
      <span className={s.statusItem}>
        <span className={s.pulse} aria-hidden />
        实时 · {data.ping_ms} ms
      </span>
    </div>
  );
}
