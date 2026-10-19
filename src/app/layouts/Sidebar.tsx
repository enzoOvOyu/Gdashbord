// Sidebar 导航（PRD §2 / §2.1；DESIGN-SYSTEM §5.10 / §5.10.1）
// v0.7 重构：
//  ① 总览 = 直达项（整行 NavLink，无子菜单、无展开箭头）；
//  ② 其余分组「点击组标题行展开/收起」（button + aria-expanded + chevron 旋转 180°）；
//  ③ 收起态持久化到 localStorage（nav store，key `rs.nav.collapsed`）；
//  ④ 激活路由所属分组**渲染期强制展开**（不写回 store，离开后恢复用户意图）；
//  ⑤ 「开发（辅助）」→「工作台」，新增「弹性伸缩」；「项目」移入运营&运维首项。
// 选中项左侧 3px 品牌条 + 浅品牌底；二级项缩进；按角色过滤（PRD §8）。
import { t } from '../../i18n';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Rocket, Boxes, Cpu, Wrench, Code2, Database,
  Activity, LifeBuoy, Wallet, Server, Blocks, Zap, Images, ChevronDown, FolderKanban,
} from 'lucide-react';
import clsx from 'clsx';
import s from './layout.module.css';
import {
  canSeeNav, canSeeOpsItem, canSeeWorkbenchItem,
  type NavGroup, type OpsItem, type WorkbenchItem,
} from '../../lib/rbac';
import { useAuthStore } from '../../stores/auth';
import { useNavStore } from '../../stores/nav';
import { KIND_META, KIND_LIST, KIND_ICON } from '../../lib/ids';
import type { ResourceKind } from '../../types/domain';

interface Item {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  ops?: OpsItem;
  wb?: WorkbenchItem;
}

interface GroupDef {
  id: NavGroup;
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  items: Item[];
}

/** 总览：直达项（PRD §2.1 —— 唯一子功能不设子菜单） */
const DIRECT_ITEMS: Item[] = [
  { to: '/overview', get label() { return t('nav.overview'); }, icon: LayoutDashboard },
];

/**
 * 分组定义：**渲染期计算**（函数而非模块级常量）——
 * 模块级数组会在加载时把 `KIND_META[k].label` 的 getter 求值一次并固化，语言切换后不更新。
 */
function buildGroups(): GroupDef[] {
  return [
    {
      id: 'deployment',
      get title() { return t('nav.deployment'); },
      icon: Rocket,
      items: [
        { to: '/deployment/server', get label() { return t('nav.newServer'); }, icon: Server },
        { to: '/deployment/baremetal', get label() { return t('nav.newBaremetal'); }, icon: Cpu },
        { to: '/deployment/vgpu', get label() { return t('nav.newVgpu'); }, icon: Blocks },
        { to: '/deployment/inference', get label() { return t('nav.newInferenceNoSpace'); }, icon: Zap },
      ],
    },
    {
      id: 'resources',
      get title() { return t('common.resource'); },
      icon: Boxes,
      items: KIND_LIST.map((k: ResourceKind) => ({
        to: `/resources/${KIND_META[k].routeKey}`,
        // 渲染期读取 getter，随语言即时更新
        get label() { return KIND_META[k].label; },
        icon: KIND_ICON[k],
      })),
    },
    {
      id: 'ops',
      get title() { return t('nav.ops'); },
      icon: Wrench,
      items: [
        { to: '/ops/projects', get label() { return t('nav.projects'); }, icon: FolderKanban, ops: 'projects' },
        { to: '/ops/pools', get label() { return t('common.nodePool'); }, icon: Boxes, ops: 'pools' },
        { to: '/ops/nodes', get label() { return t('nav.nodes'); }, icon: Cpu, ops: 'nodes' },
        { to: '/ops/events', get label() { return t('nav.events'); }, icon: Activity, ops: 'events' },
        { to: '/ops/logs', get label() { return t('nav.logs'); }, icon: Activity, ops: 'logs' },
        { to: '/ops/cost', get label() { return t('nav.cost'); }, icon: Wallet, ops: 'cost' },
        { to: '/ops/quotas', get label() { return t('nav.quotas'); }, icon: Wallet, ops: 'quotas' },
        { to: '/ops/tickets', get label() { return t('nav.tickets'); }, icon: LifeBuoy, ops: 'tickets' },
      ],
    },
    {
      id: 'workbench',
      get title() { return t('nav.workbench'); },
      icon: Code2,
      items: [
        { to: '/workbench/notebooks', get label() { return t('nav.notebooks'); }, icon: Code2, wb: 'notebooks' },
        { to: '/workbench/images', get label() { return t('nav.images'); }, icon: Images, wb: 'images' },
        { to: '/workbench/apps', get label() { return t('dev.templates'); }, icon: Rocket, wb: 'apps' },
        { to: '/workbench/scaling', get label() { return t('nav.scaling'); }, icon: Activity, wb: 'scaling' },
      ],
    },
    {
      id: 'data',
      get title() { return t('nav.data'); },
      icon: Database,
      items: [
        { to: '/data/datasets', get label() { return t('dp.datasetTitle'); }, icon: Database },
        { to: '/data/storage', get label() { return t('dp.storageTitle'); }, icon: Database },
        { to: '/data/pipelines', get label() { return t('dp.pipelineNav'); }, icon: Wrench },
      ],
    },
    {
      id: 'assets',
      get title() { return t('nav.assets'); },
      icon: Wallet,
      items: [
        { to: '/assets/compute', get label() { return t('asset.computeTitle'); }, icon: Wallet },
        { to: '/assets/vouchers', get label() { return t('nav.vouchers'); }, icon: Wallet },
        { to: '/assets/reserved', get label() { return t('nav.reservations'); }, icon: Wallet },
        { to: '/assets/storage', get label() { return t('asset.packTitle'); }, icon: Wallet },
      ],
    },
  ];
}

/** 子项是否命中当前路由（前缀匹配，支持 /ops/tickets/:id 等深链） */
function itemMatches(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** 角色过滤后的子项（过滤后为空的分组不渲染；DESIGN §5.10.1） */
function visibleItems(role: ReturnType<typeof useAuthStore.getState>['role'], g: GroupDef): Item[] {
  return g.items.filter((it) => {
    if (g.id === 'ops' && it.ops) return canSeeOpsItem(role, it.ops);
    if (g.id === 'workbench' && it.wb) return canSeeWorkbenchItem(role, it.wb);
    return true;
  });
}

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const role = useAuthStore((st) => st.role);
  const collapsedGroups = useNavStore((st) => st.collapsedGroups);
  const toggleGroup = useNavStore((st) => st.toggleGroup);
  const { pathname } = useLocation();

  const groups = buildGroups().filter((g) => canSeeNav(role, g.id));

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
        {DIRECT_ITEMS.map((it) => (
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
        {groups.map((g) => {
          const items = visibleItems(role, g);
          if (items.length === 0) return null;
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
