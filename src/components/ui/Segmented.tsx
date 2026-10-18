// Segmented 分段控件（时间范围 / 枚举单选）
import clsx from 'clsx';
import s from './ui.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className={s.segmented} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          aria-pressed={o.value === value}
          className={clsx(o.value === value && s.segmentedActive)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 进度条（配额水位 / 分配率） */
export function Progress({
  value,
  max,
  color,
  label,
  right,
}: {
  value: number;
  max: number;
  color?: string;
  label?: string;
  right?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const c =
    color ?? (pct >= 90 ? 'var(--rs-danger)' : pct >= 75 ? 'var(--rs-warning)' : 'var(--rs-success)');
  return (
    <div>
      {(label || right) && (
        <div className={s.progressLabel}>
          <span>{label}</span>
          <span>{right}</span>
        </div>
      )}
      <div className={s.progress}>
        <div className={s.progressBar} style={{ width: `${pct}%`, background: c }} />
      </div>
    </div>
  );
}
