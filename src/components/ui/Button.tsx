// Button（DESIGN-SYSTEM §5.1：Primary 渐变底 + text-inverse；尺寸 sm/md/lg；禁用降透明度）
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import s from './ui.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

const variantCls: Record<ButtonVariant, string> = {
  primary: s.btnPrimary,
  secondary: s.btnSecondary,
  ghost: s.btnGhost,
  danger: s.btnDanger,
};
const sizeCls: Record<ButtonSize, string> = {
  sm: s.btnSm,
  md: s.btnMd,
  lg: s.btnLg,
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(s.btn, variantCls[variant], sizeCls[size], className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
