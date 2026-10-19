// Table（DESIGN-SYSTEM §5.4：行高 44、表头 13/600/secondary、斑马纹可选、空态插画 + 引导）
// 复杂筛选/排序/虚拟滚动由 TanStack Table 承担（ARCH §2），此处为轻量展示封装。
import { t } from '../../i18n';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import s from './ui.module.css';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** 数值列右对齐 + 等宽数字 */
  numeric?: boolean;
  mono?: boolean;
  width?: number | string;
}

export interface TableProps<T> {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  zebra?: boolean;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  className?: string;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  zebra,
  onRowClick,
  empty,
  className,
}: TableProps<T>) {
  if (rows.length === 0) return <>{empty ?? <EmptyState />}</>;
  return (
    <div className={clsx(s.tableWrap, className)}>
      <table className={clsx(s.table, zebra && s.zebra)}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ width: c.width }}
                className={clsx(c.numeric && s.num)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              style={{ cursor: onRowClick ? 'pointer' : undefined }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={clsx(c.numeric && s.num, c.mono && s.mono)}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({
  icon = '📭',
  title = t('common.noData'),
  hint,
  action,
}: {
  icon?: string;
  title?: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className={s.empty}>
      <div className={s.emptyIcon}>{icon}</div>
      <div style={{ fontWeight: 600, color: 'var(--rs-text)' }}>{title}</div>
      {hint && <div className={s.muted}>{hint}</div>}
      {action}
    </div>
  );
}
