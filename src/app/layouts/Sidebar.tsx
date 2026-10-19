// Sidebar 导航（PRD §2 / §2.1；DESIGN-SYSTEM §5.10 / §5.10.1）
// v0.7 重构：
//  ① 总览 = 直达项（整行 NavLink，无子菜单、无展开箭头）；
//  ② 其余分组「点击组标题行展开/收起」（button + aria-expanded + chevron 旋转 180°）；
//  ③ 收起态持久化到 localStorage（nav store，key `rs.nav.collapsed`）；
//  ④ 激活路由所属分组**渲染期强制展开**（不写回 store，离开后恢复用户意图）；
//  ⑤ 「开发（辅助）」→「工作台」，新增「弹性伸缩」；「项目」移入运营&运维首项。
// 选中项左侧 3px 品牌条 + 浅品牌底；二级项缩进；按角色过滤（PRD §8）。
// v0.8：导航模型抽至 navModel.ts（与 ⌘K 命令面板共用），本文件只负责渲染与交互。
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import s from './layout.module.css';
import { useAuthStore } from '../../stores/auth';
import { useNavStore } from '../../stores/nav';
import { itemMatches, visibleNav } from './navModel';

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const role = useAuthStore((st) => st.role);
  const collapsedGroups = useNavStore((st) => st.collapsedGroups);
  const toggleGroup = useNavStore((st) => st.toggleGroup);
  const { pathname } = useLocation();

  const { direct, groups } = visibleNav(role);

  return (
    <aside className={clsx(s.sidebar, open && s.sidebarOpen)}>
      {/* 品牌：冻结常驻（滚动不隐藏，点击回总览） */}
      <div className={s.brandBar}>
        <NavLink to="/overview" className={s.brand} onClick={onClose}>
          <span className={s.brandMark} aria-hidden>
            ☀
          </span>
          <span className={s.brandName}>
            RunSun
            <span className={s.brandTag}>GPU Cloud</span>
          </span>
        </NavLink>
      </div>
      <nav className={s.nav} aria-label="main">
        {/* ① 直达项：整行即链接，无 chevron（PRD §2.1） */}
        {direct.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            onClick={onClose}
            className={({ isActive }) => clsx(s.navItem, isActive && s.navItemActive)}
          >
            <span className={s.navItemIcon}>
              <it.icon size={16} />
            </span>
            {it.label}
          </NavLink>
        ))}

        {/* ② 分组项：组标题为切换按钮，子菜单可收起 */}
        {groups.map(({ group: g, items }) => {
          const hasActive = items.some((it) => itemMatches(pathname, it.to));
          // 激活组强制展开（覆盖用户收起态），但不写回 store
          const expanded = hasActive || !collapsedGroups.includes(g.id);
          const GroupIcon = g.icon;
          return (
            <div key={g.id} className={s.navGroup}>
              <button
                type="button"
                className={s.navGroupBtn}
                aria-expanded={expanded}
                aria-controls={`nav-${g.id}`}
                onClick={() => toggleGroup(g.id)}
              >
                <span className={s.navItemIcon}>
                  <GroupIcon size={16} />
                </span>
                <span className={s.navGroupBtnText}>{g.title}</span>
                <ChevronDown
                  size={16}
                  className={clsx(s.navChevron, expanded && s.navChevronOpen)}
                  aria-hidden
                />
              </button>
              <div
                id={`nav-${g.id}`}
                className={clsx(s.navSubList, !expanded && s.navSubListCollapsed)}
                aria-hidden={!expanded}
              >
                {items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    onClick={onClose}
                    tabIndex={expanded ? undefined : -1}
                    className={({ isActive }) =>
                      clsx(s.navItem, s.navSub, isActive && s.navItemActive)
                    }
                  >
                    <span className={s.navItemIcon}>
                      <it.icon size={16} />
                    </span>
                    {it.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
