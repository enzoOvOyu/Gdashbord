// Sidebar 分组导航（PRD §2 / DESIGN-SYSTEM §5.10；分组与导航一一对应）
// 选中项左侧 3px 品牌条 + 浅品牌底；二级项缩进；按角色过滤（PRD §8）。
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Rocket, Boxes, Cpu, Network, Code2, Database,
  Activity, LifeBuoy, Library, Wallet, Server, Blocks, Zap,
} from 'lucide-react';
import clsx from 'clsx';
import s from './layout.module.css';
import { canSeeNav, type NavGroup } from '../../lib/rbac';
import { useAuthStore } from '../../stores/auth';
import { KIND_META } from '../../lib/ids';
import { KIND_LIST } from '../../lib/ids';

interface Item {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

const GROUPS: Array<{ group: NavGroup; title: string; items: Item[] }> = [
  { group: 'overview', title: '总览', items: [{ to: '/overview', label: 'Overview', icon: LayoutDashboard }] },
  {
    group: 'deployment',
    title: '部署中心',
    items: [
      { to: '/deployment/server', label: '新建 GPU 云服务器', icon: Server },
      { to: '/deployment/baremetal', label: '新建 GPU 裸金属', icon: Cpu },
      { to: '/deployment/vgpu', label: '新建 vGPU 集群', icon: Blocks },
      { to: '/deployment/inference', label: '新建 推理服务', icon: Zap },
    ],
  },
  {
    group: 'resources',
    title: '资源',
    items: KIND_LIST.map((k) => ({
      to: `/resources/${KIND_META[k].routeKey}`,
      label: KIND_META[k].label,
      icon: Server,
    })),
  },
  {
    group: 'cluster',
    title: '集群（辅助）',
    items: [
      { to: '/cluster/pools', label: '节点池', icon: Boxes },
      { to: '/cluster/nodes', label: '节点', icon: Cpu },
      { to: '/cluster/topology', label: '调度与拓扑', icon: Network },
      { to: '/cluster/events', label: '事件与维护', icon: Activity },
    ],
  },
  {
    group: 'development',
    title: '开发（辅助）',
    items: [
      { to: '/development/notebooks', label: 'Notebook / IDE', icon: Code2 },
      { to: '/development/images', label: '镜像商城', icon: Library },
      { to: '/development/apps', label: 'AI 应用模板', icon: Rocket },
    ],
  },
  {
    group: 'data',
    title: '数据',
    items: [
      { to: '/data/datasets', label: '数据集', icon: Database },
      { to: '/data/storage', label: '对象存储', icon: Database },
      { to: '/data/pipelines', label: '数据预处理', icon: Network },
    ],
  },
  {
    group: 'operations',
    title: '运营',
    items: [
      { to: '/operations/monitoring', label: '监控', icon: Activity },
      { to: '/operations/logs', label: '日志', icon: Activity },
      { to: '/operations/cost', label: '成本分析', icon: Activity },
      { to: '/operations/quotas', label: '配额', icon: Activity },
      { to: '/operations/tickets', label: '工单', icon: LifeBuoy },
    ],
  },
  { group: 'models', title: '模型库', items: [{ to: '/model-library', label: '模型库', icon: Library }] },
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
      <NavLink to="/overview" className={s.brand} onClick={onClose}>
        <span className={s.brandMark}>☀</span>
        RunSun
      </NavLink>
      <nav className={s.nav}>
        {GROUPS.filter((g) => canSeeNav(role, g.group)).map((g) => (
          <div key={g.group} className={s.navGroup}>
            <div className={s.navGroupTitle}>{g.title}</div>
            {g.items.map((it) => (
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
