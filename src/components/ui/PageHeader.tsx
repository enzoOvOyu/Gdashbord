// 页头（PRD §4.4.1：每页页头常驻区域选择器 + 操作区）
import type { ReactNode } from 'react';
import s from './ui.module.css';

export function PageHeader({
  title,
  desc,
  icon,
  actions,
}: {
  title: ReactNode;
  desc?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={s.pageHead}>
      <div className={s.pageHeadText}>
        <h1 className={s.pageHeadTitle}>
          {icon}
          {title}
        </h1>
        {desc && <p className={s.pageHeadDesc}>{desc}</p>}
      </div>
      {actions && <div className={s.pageHeadActions}>{actions}</div>}
    </div>
  );
}

/** 区块标题 */
export function SectionTitle({
  children,
  extra,
}: {
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        margin: '0 0 12px',
      }}
    >
      <h2 className={s.sectionTitle}>{children}</h2>
      {extra}
    </div>
  );
}

/** 工具条（筛选器容器） */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className={s.toolbar}>{children}</div>;
}
