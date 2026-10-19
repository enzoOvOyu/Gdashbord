// 前端 RBAC：仅控制可见性/禁用态，真实鉴权以后端为准（ARCH §4.2 · §12.1 user_role · PRD §8）
// 角色枚举三处一致：PRD §8 / ARCH §4.2 / users.role，禁止「Dev」等第二套命名。
import type { UserRole } from '../types/domain';

export type { UserRole };
export type DangerousAction = 'delete' | 'resize' | 'cordon' | 'drain' | 'voidInvoice';

/** 危险操作权限矩阵（ARCH §4.2） */
const MATRIX: Record<UserRole, Record<DangerousAction, boolean>> = {
  owner: { delete: true, resize: true, cordon: true, drain: true, voidInvoice: true },
  admin: { delete: true, resize: true, cordon: true, drain: true, voidInvoice: false },
  member: { delete: true, resize: true, cordon: true, drain: true, voidInvoice: false },
  billing: { delete: false, resize: false, cordon: false, drain: false, voidInvoice: true },
  viewer: { delete: false, resize: false, cordon: false, drain: false, voidInvoice: false },
};

export function canPerform(role: UserRole, action: DangerousAction): boolean {
  return MATRIX[role][action];
}

/** 资源实例是否只读：billing / viewer 不可删除或启停（PRD §8） */
export function isResourceReadOnly(role: UserRole): boolean {
  return role === 'viewer' || role === 'billing';
}

/** 是否可创建资源（部署中心）：viewer 只读，其余可创建 */
export function canCreateResource(role: UserRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'member' || role === 'billing';
}

/**
 * 导航分组 key（与 PRD §2 / DESIGN §5.10 一致）。
 * v0.6：原「集群 cluster」+ 原「运营 operations」合并为 **运营&运维 ops**；
 * 原「模型库 models」删除（并入工作台·镜像商城）。
 * v0.7：原「开发 development」更名 **工作台 workbench**（PRD §2.1 变更 10）；
 * 总览为直达项，不参与本分组枚举（PRD §2.1）。
 */
export type NavGroup =
  | 'overview'
  | 'deployment'
  | 'resources'
  | 'ops'
  | 'workbench'
  | 'data'
  | 'assets';

/**
 * 菜单可见性（PRD §8）：
 *  owner/admin 全部；member 部署+资源+工作台+数据+运维子项；
 *  billing 资产/成本/配额，资源只读；viewer 全部只读。
 */
const NAV_VISIBLE: Record<UserRole, NavGroup[]> = {
  owner: ['overview', 'deployment', 'resources', 'ops', 'workbench', 'data', 'assets'],
  admin: ['overview', 'deployment', 'resources', 'ops', 'workbench', 'data', 'assets'],
  member: ['overview', 'deployment', 'resources', 'ops', 'workbench', 'data'],
  billing: ['overview', 'resources', 'ops', 'assets'],
  viewer: ['overview', 'deployment', 'resources', 'ops', 'workbench', 'data', 'assets'],
};

export function canSeeNav(role: UserRole, group: NavGroup): boolean {
  return NAV_VISIBLE[role].includes(group);
}

/** 工作台子项可见性（v0.7：Notebook/镜像/模板全员可见，弹性伸缩 viewer 只读可见） */
export type WorkbenchItem = 'notebooks' | 'images' | 'apps' | 'scaling';

export function canSeeWorkbenchItem(role: UserRole, item: WorkbenchItem): boolean {
  if (role === 'billing') return item === 'images';
  if (role === 'member') return item !== 'scaling';
  return true;
}

/** 运营&运维子项可见性（v0.7 首项为「项目」；billing 仅成本与配额） */
export type OpsItem =
  | 'projects'
  | 'pools'
  | 'nodes'
  | 'events'
  | 'logs'
  | 'cost'
  | 'quotas'
  | 'tickets';

export function canSeeOpsItem(role: UserRole, item: OpsItem): boolean {
  if (role === 'owner' || role === 'admin') return true;
  if (role === 'member')
    return item === 'projects' || item === 'logs' || item === 'tickets' || item === 'events';
  if (role === 'billing') return item === 'cost' || item === 'quotas';
  return true; // viewer 只读全览
}

/** 角色显示名（单一口径） */
export const ROLE_LABEL: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  billing: 'Billing',
  viewer: 'Viewer',
};
export const ROLE_LIST: UserRole[] = ['owner', 'admin', 'member', 'billing', 'viewer'];
