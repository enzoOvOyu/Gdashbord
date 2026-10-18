// 键值网格（详情页摘要区：每个字段都有库表来源，PRD §4.3.0）
import type { ReactNode } from 'react';
import s from './ui.module.css';

export interface KVItem {
  label: string;
  value: ReactNode;
  mono?: boolean;
  title?: string;
}

export function KeyValue({ items }: { items: KVItem[] }) {
  return (
    <div className={s.kv}>
      {items.map((it) => (
        <div className={s.kvItem} key={it.label} title={it.title}>
          <span className={s.kvKey}>{it.label}</span>
          <span className={it.mono ? `${s.kvVal} ${s.kvMono}` : s.kvVal}>
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 卡片 + 标题 + 键值网格 的组合（详情页区块） */
export function InfoCard({
  title,
  items,
  actions,
}: {
  title?: string;
  items: KVItem[];
  actions?: ReactNode;
}) {
  return (
    <div className={`${s.card}`}>
      {(title || actions) && (
        <div className={s.cardHeader}>
          <div className={s.cardTitle}>{title}</div>
          <div className={s.cardActions}>{actions}</div>
        </div>
      )}
      <div className={s.cardBody}>
        <KeyValue items={items} />
      </div>
    </div>
  );
}
