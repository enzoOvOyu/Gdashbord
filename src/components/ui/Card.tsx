// Card / Panel（DESIGN-SYSTEM §5.2：--rs-r-lg 细描边；标题区 16/600，操作区右对齐）
import type { ReactNode } from 'react';
import clsx from 'clsx';
import s from './ui.module.css';

export interface CardProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  tight?: boolean;
  bodyClassName?: string;
}

export function Card({ title, actions, children, className, tight, bodyClassName }: CardProps) {
  return (
    <section className={clsx(s.card, className)}>
      {(title || actions) && (
        <header className={s.cardHeader}>
          <div className={s.cardTitle}>{title}</div>
          {actions && <div className={s.cardActions}>{actions}</div>}
        </header>
      )}
      <div className={clsx(tight ? s.cardBodyTight : s.cardBody, bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
