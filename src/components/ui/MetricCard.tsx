// 指标卡（DESIGN §8.3：值 + 单位 + 阈值 + 语义图标 + sparkline）
import type { ReactNode } from 'react';
import { AlertTriangle, CircleAlert, CircleCheck, Info, Ban } from 'lucide-react';
import clsx from 'clsx';
import s from './ui.module.css';
import type { MetricSemantic } from '../../mocks/fixtures/thresholds';

const SEM_CLASS: Record<MetricSemantic, string> = {
  normal: s.metricOk,
  notice: s.metricNotice,
  warning: s.metricWarning,
  critical: s.metricCritical,
  nodata: s.metricNodata,
};

const SEM_ICON: Record<MetricSemantic, ReactNode> = {
  normal: <CircleCheck size={13} />,
  notice: <Info size={13} />,
  warning: <AlertTriangle size={13} />,
  critical: <CircleAlert size={13} />,
  nodata: <Ban size={13} />,
};

export interface SparkPoint {
  t: number;
  v: number;
}

export function Sparkline({
  points,
  color,
  height = 28,
}: {
  points: SparkPoint[];
  color: string;
  height?: number;
}) {
  if (points.length < 2) return <div style={{ height }} />;
  const values = points.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 100;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = height - ((p.v - min) / span) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke={color} strokeWidth={1.4} />
    </svg>
  );
}

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  semantic?: MetricSemantic;
  color?: string;
  /** 阈值说明（展示"值与阈值"关系，DESIGN §8.3） */
  thresholdText?: string;
  points?: SparkPoint[];
}

export function MetricCard({
  label,
  value,
  unit,
  semantic = 'normal',
  color,
  thresholdText,
  points,
}: MetricCardProps) {
  const stroke = color ?? 'var(--rs-text-secondary)';
  return (
    <div className={s.metricCard}>
      <div className={s.metricLabel}>
        <span style={{ color: 'var(--rs-text-secondary)', display: 'flex' }}>
          {SEM_ICON[semantic]}
        </span>
        {label}
      </div>
      <div className={clsx(s.metricValue, SEM_CLASS[semantic])}>
        {value}
        {unit && <span className={s.metricUnit}> {unit}</span>}
      </div>
      {points && points.length > 1 && (
        <Sparkline points={points} color={stroke} />
      )}
      {thresholdText && <div className={s.metricFoot}>{thresholdText}</div>}
    </div>
  );
}
