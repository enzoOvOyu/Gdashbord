// 表单字段（向导内联校验展示，DESIGN §5.12：内联报错，不弹 Modal）
import type { ReactNode } from 'react';
import s from './ui.module.css';

export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={s.field}>
      <label className={s.fieldLabel}>
        {label}
        {required && <span style={{ color: 'var(--rs-danger)' }}>*</span>}
      </label>
      {children}
      {hint && <span className={s.fieldHint}>{hint}</span>}
      {error && <span className={s.fieldError}>{error}</span>}
    </div>
  );
}

/** 开关行 */
export function SwitchRow({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className={s.switchRow}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
      {hint && <div className={s.fieldHint}>{hint}</div>}
    </div>
  );
}

/** 单选卡片（选型卡片化：RunPod/Lambda 风格） */
export function PickCard({
  selected,
  disabled,
  disabledReason,
  onClick,
  title,
  meta,
  price,
  extra,
}: {
  selected: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
  title: ReactNode;
  meta?: ReactNode;
  price?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${s.pickCard} ${selected ? s.pickCardActive : ''} ${
        disabled ? s.pickCardDisabled : ''
      }`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={selected}
      title={disabled ? disabledReason : undefined}
    >
      <span className={s.pickCardTitle}>{title}</span>
      {meta && <span className={s.pickCardMeta}>{meta}</span>}
      {price && <span className={s.pickCardPrice}>{price}</span>}
      {disabled && disabledReason && (
        <span className={s.pickCardMeta} style={{ color: 'var(--rs-warning)' }}>
          {disabledReason}
        </span>
      )}
      {extra}
    </button>
  );
}

/** 卡片网格容器 */
export function CardGrid({ children }: { children: ReactNode }) {
  return <div className={s.cardGrid}>{children}</div>;
}
