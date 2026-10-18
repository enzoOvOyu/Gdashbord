// Input / Select（DESIGN-SYSTEM §5.7：统一 34h，聚焦品牌描边 + 浅光环）
import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import clsx from 'clsx';
import s from './ui.module.css';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(s.input, className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(s.select, className)} {...rest}>
      {children}
    </select>
  );
}
