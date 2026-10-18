// Badge / StatusDot（DESIGN-SYSTEM §5.6：圆点 + 文本组合，不只颜色；可访问性 §8）
import type { ReactNode } from 'react';
import clsx from 'clsx';
import s from './ui.module.css';

export type BadgeTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'muted'
  | 'terminating'
  | 'neutral';

const TONE_VAR: Record<BadgeTone, string> = {
  success: 'var(--rs-success)',
  warning: 'var(--rs-warning)',
  danger: 'var(--rs-danger)',
  info: 'var(--rs-info)',
  purple: 'var(--rs-purple)',
  muted: 'var(--rs-text-muted)',
  terminating: 'var(--rs-status-terminating)',
  neutral: 'var(--rs-text-secondary)',
};

export interface BadgeProps {
  tone?: BadgeTone;
  color?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 已释放：删除线文本（§8.2） */
  strike?: boolean;
}

export function Badge({ tone = 'neutral', color, icon, children, className, strike }: BadgeProps) {
  const c = color ?? TONE_VAR[tone];
  return (
    <span
      className={clsx(s.badge, tone === 'neutral' && !color && s.badgeNeutral, className)}
      style={{
        color: tone === 'neutral' && !color ? undefined : c,
        borderColor: tone === 'neutral' && !color ? undefined : `${c}55`,
        background: tone === 'neutral' && !color ? undefined : `${c}14`,
        textDecoration: strike ? 'line-through' : undefined,
      }}
    >
      <span className={s.dot} style={{ background: c }} />
      {icon}
      {children}
    </span>
  );
}
