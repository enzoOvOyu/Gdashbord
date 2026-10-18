// Sidebar 分组导航（PRD §2 / DESIGN-SYSTEM §5.10；分组与导航一一对应）
// v0.6：集群 + 运营 → 运营&运维；删除调度与拓扑、运营·监控、模型库一级菜单。
// 选中项左侧 3px 品牌条 + 浅品牌底；二级项缩进；按角色过滤（PRD §8）。
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Rocket, Boxes, Cpu, Wrench, Code2, Database,
  Activity, LifeBuoy, Wallet, Server, Blocks, Zap, Images,
} from 'lucide-react';
import clsx from 'clsx';
import s from './layout.module.css';
import { canSeeNav, canSeeOpsItem, type NavGroup, type OpsItem } from '../../lib/rbac';
import { useAuthStore } from '../../stores/auth';
import { KIND_META, KIND_LIST, KIND_ICON } from '../../lib/ids';
import type { ResourceKind } from '../../types/domain';

interface Item {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  ops?: OpsItem;
}

const OPS_ITEMS: Item[] = [
  { to: '/ops/pools', label: '节点池', icon: Boxes, ops: 'pools' },
  { to: '/ops/nodes', label: '节点', icon: Cpu, ops: 'nodes' },
  { to: '/ops/events', label: '事件与维护', icon: Activity, ops: 'events' },
  { to: '/ops/logs', label: '日志', icon: Activity, ops: 'logs' },
  { to: '/ops/cost', label: '成本分析', icon: Wallet, ops: 'cost' },
  { to: '/ops/quotas', label: '配额', icon: Wallet, ops: 'quotas' },
  { to: '/ops/tickets', label: '工单', icon: LifeBuoy, ops: 'tickets' },
];

const GROUPS: Array<{ group: NavGroup; title: string; items: Item[] }> = [
  {
    group: 'overview',
    title: '总览',
    items: [{ to: '/overview', label: 'Overview', icon: LayoutDashboard }],
  },
  {
    group: 'deployment',
    title: '部署中心',
    items: [
      { to: '/deployment/server', label: '新建 GPU 云服务器', icon: Server },
      { to: '/deployment/baremetal', label: '新建 GPU 裸金属', icon: Cpu },
      { to: '/deployment/vgpu', label: '新建 vGPU', icon: Blocks },
      { to: '/deployment/inference', label: '新建 推理服务', icon: Zap },
    ],
  },
  {
    group: 'resources',
    title: '资源',
    items: KIND_LIST.map((k: ResourceKind) => ({
      to: `/resources/${KIND_META[k].routeKey}`,
      label: KIND_META[k].label,
      icon: KIND_ICON[k],
    })),
  },
  {
    group: 'ops',
    title: '运营&运维',
    items: OPS_ITEMS,
  },
  {
    group: 'development',
    title: '开发（辅助）',
    items: [
      { to: '/development/notebooks', label: 'Notebook / IDE', icon: Code2 },
      { to: '/development/images', label: '镜像商城 · 模型', icon: Images },
      { to: '/development/apps', label: 'AI 应用模板', icon: Rocket },
    ],
  },
  {
    group: 'data',
    title: '数据',
    items: [
      { to: '/data/datasets', label: '数据集', icon: Database },
      { to: '/data/storage', label: '对象存储', icon: Database },
      { to: '/data/pipelines', label: '数据预处理', icon: Wrench },
    ],
  },
  {
    group: 'assets',
    title: '资产',
    items: [
      { to: '/assets/compute', label: '计算资产', icon: Wallet },
      { to: '/assets/vouchers', label: '代金券', icon: Wallet },
      { to: '/assets/reserved', label: '预留实例', icon: Wallet },
      { to: '/assets/storage', label: '存储包', icon: Wallet },
    ],
  },
];

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const role = useAuthStore((st) => st.role);
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
      <nav className={s.nav}>
        {GROUPS.filter((g) => canSeeNav(role, g.group)).map((g) => (
          <div key={g.group} className={s.navGroup}>
            <div className={s.navGroupTitle}>{g.title}</div>
            {g.items
              .filter((it) => (g.group === 'ops' && it.ops ? canSeeOpsItem(role, it.ops) : true))
              .map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  onClick={onClose}
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
        ))}
      </nav>
    </aside>
  );
}
