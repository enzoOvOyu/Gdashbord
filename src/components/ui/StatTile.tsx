// Stat Tile（DESIGN-SYSTEM §5.3：大数字 3xl/700 + 标签 + 趋势微标；等级标识用 --rs-gold）
import type { ReactNode } from 'react';
import clsx from 'clsx';
import s from './ui.module.css';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  /** 趋势百分比（正=↑绿，负=↓红） */
  trend?: number;
  hint?: ReactNode;
  color?: string;
  icon?: ReactNode;
  className?: string;
}

export function StatTile({ label, value, trend, hint, color, icon, className }: StatTileProps) {
  const trendCls = trend === undefined || trend === 0 ? s.trendFlat : trend > 0 ? s.trendUp : s.trendDown;
  return (
    <div className={clsx(s.stat, className)}>
      <div className={s.statLabel}>{icon}{label}</div>
      <div className={s.statValue} style={{ color }}>{value}</div>
      <div className={s.row}>
        {trend !== undefined && (
          <span className={clsx(s.statTrend, trendCls)}>
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '–'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {hint && <span className={clsx(s.statTrend, s.trendFlat)}>{hint}</span>}
      </div>
    </div>
  );
}
