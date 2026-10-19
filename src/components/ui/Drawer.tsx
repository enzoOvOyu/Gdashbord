// Drawer（DESIGN-SYSTEM §5.19：A/B 档展开载体；Esc/遮罩关闭，URL 同步 ?drawer=）
import { t } from '../../i18n';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import s from './ui.module.css';
import { Button } from './Button';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  badge,
  headerExtra,
  footer,
  children,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className={s.overlay} onClick={onClose} role="presentation">
      <aside
        className={s.drawer}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={s.drawerHeader}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className={s.drawerTitle}>
              {title}
              {badge}
            </div>
            {subtitle && <div className={s.drawerSub}>{subtitle}</div>}
          </div>
          {headerExtra}
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('common.off')}
            onClick={onClose}
            icon={<X size={16} />}
          />
        </div>
        <div className={s.drawerBody}>{children}</div>
        {footer && <div className={s.drawerFooter}>{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

/** 抽屉内 Tab 区（§3.4：至少「概览」+「事件/日志」两 Tab） */
export function DrawerTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ key: T; label: string }>;
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className={clsx(s.tabs)} role="tablist">
      {items.map((it) => (
        <button
          key={it.key}
          role="tab"
          aria-selected={it.key === value}
          className={clsx(s.tab, it.key === value && s.tabActive)}
          onClick={() => onChange(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
