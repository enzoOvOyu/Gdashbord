// Tabs（DESIGN-SYSTEM §5.5：下划线式，激活态品牌色；用于详情页分区）
import clsx from 'clsx';
import s from './ui.module.css';

export interface TabItem<T extends string> {
  key: T;
  label: string;
  icon?: string;
}

export interface TabsProps<T extends string> {
  items: Array<TabItem<T>>;
  value: T;
  onChange: (key: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
  return (
    <div className={clsx(s.tabs, className)} role="tablist">
      {items.map((it) => (
        <button
          key={it.key}
          role="tab"
          aria-selected={it.key === value}
          className={clsx(s.tab, it.key === value && s.tabActive)}
          onClick={() => onChange(it.key)}
        >
          {it.icon} {it.label}
        </button>
      ))}
    </div>
  );
}
