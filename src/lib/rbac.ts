// 前端 RBAC：仅控制可见性/禁用态，真实鉴权以后端为准（ARCH §4.2 / §12.1 user_role）
export type UserRole = 'owner' | 'admin' | 'member' | 'billing' | 'viewer';
export type DangerousAction = 'delete' | 'resize' | 'cordon' | 'drain' | 'voidInvoice';

// 危险操作权限矩阵（与 ARCH §4.2 一致）
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

// 资源是否只读（billing / viewer 对资源实例不可变更）
export function isResourceReadOnly(role: UserRole): boolean {
  return role === 'viewer' || role === 'billing';
}
