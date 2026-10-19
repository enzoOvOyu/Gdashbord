// 导航模型（PRD §2.1 / §2；DESIGN-SYSTEM §5.10 / §5.10.1）
// Sidebar 与全局命令面板（⌘K）共用同一份导航定义，避免两处漂移。
// v0.7：「开发（辅助）」→「工作台」，新增「弹性伸缩」；「项目」移入运营&运维首项。
import { t } from '../../i18n';
import {
  LayoutDashboard, Rocket, Boxes, Cpu, Wrench, Code2, Database,
  Activity, LifeBuoy, Wallet, Server, Blocks, Zap, Images, FolderKanban,
} from 'lucide-react';
import {
  canSeeNav, canSeeOpsItem, canSeeWorkbenchItem,
  type NavGroup, type OpsItem, type WorkbenchItem,
} from '../../lib/rbac';
import { KIND_META, KIND_LIST, KIND_ICON } from '../../lib/ids';
import type { useAuthStore } from '../../stores/auth';
import type { ResourceKind } from '../../types/domain';

/** 当前用户角色（与 auth store 同源，避免在导航层复制角色枚举） */
export type CurrentRole = ReturnType<typeof useAuthStore.getState>['role'];

export interface Item {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  ops?: OpsItem;
  wb?: WorkbenchItem;
}

export interface GroupDef {
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
export function buildGroups(): GroupDef[] {
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
export function itemMatches(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** 角色过滤后的子项（过滤后为空的分组不渲染；DESIGN §5.10.1） */
export function visibleItems(role: CurrentRole, g: GroupDef): Item[] {
  return g.items.filter((it) => {
    if (g.id === 'ops' && it.ops) return canSeeOpsItem(role, it.ops);
    if (g.id === 'workbench' && it.wb) return canSeeWorkbenchItem(role, it.wb);
    return true;
  });
}

/** 当前角色可见的完整导航树（总览直达项 + 各分组，空分组已剔除） */
export function visibleNav(role: CurrentRole): {
  direct: Item[];
  groups: { group: GroupDef; items: Item[] }[];
} {
  return {
    direct: DIRECT_ITEMS,
    groups: buildGroups()
      .filter((g) => canSeeNav(role, g.id))
      .map((g) => ({ group: g, items: visibleItems(role, g) }))
      .filter((x) => x.items.length > 0),
  };
}
