// 租户 / 用户 / 项目 / 套餐 / 配额（ARCH §12.1 identity · §7.2 套餐 · §7.3 配额）
import type {
  InternalId,
  Org,
  Plan,
  Project,
  Quota,
  QuotaMetric,
  RegionCode,
  User,
} from '../../types/domain';

export const PLANS: Plan[] = [
  {
    code: 'free',
    name: 'Free',
    free_credit_usd: 10,
    max_members: 3,
    support_level: 'community',
  },
  {
    code: 'standard',
    name: 'Standard',
    free_credit_usd: 0,
    max_members: 20,
    support_level: 'ticket',
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    free_credit_usd: 0,
    max_members: 999,
    support_level: 'tam',
  },
];

/** 当前演示租户（PRD §7.5：low_balance_threshold 默认 $50） */
export const ORG: Org = {
  id: 1 as InternalId,
  name: 'Enzo AI Lab',
  slug: 'enzo-ai-lab',
  plan_code: 'standard',
  credit_balance: 1234.56,
  currency: 'USD',
  low_balance_threshold_usd: 50,
  created_at: '2026-06-11T08:00:00Z',
};

export const USERS: User[] = [
  {
    id: 1 as InternalId,
    uuid: 'u-00000001-0000-4000-8000-000000000001',
    org_id: 1 as InternalId,
    email: 'owner@enzo.ai',
    display_name: 'Enzo Owner',
    role: 'owner',
    status: 'active',
  },
  {
    id: 2 as InternalId,
    uuid: 'u-00000002-0000-4000-8000-000000000002',
    org_id: 1 as InternalId,
    email: 'mlops@enzo.ai',
    display_name: 'MLOps Admin',
    role: 'admin',
    status: 'active',
  },
];

/** 默认演示用户（owner，可见全部） */
export const CURRENT_USER: User = USERS[0];

export const PROJECTS: Project[] = [
  { id: 1 as InternalId, org_id: 1 as InternalId, name: 'llm-training', slug: 'llm-training' },
  { id: 2 as InternalId, org_id: 1 as InternalId, name: 'inference-prod', slug: 'inference-prod' },
  { id: 3 as InternalId, org_id: 1 as InternalId, name: 'research', slug: 'research' },
];

/** 配额（§7.3：used_value 为派生值，由占用口径重算，禁止业务代码直写） */
export const QUOTAS: Quota[] = [
  { id: 1 as InternalId, org_id: 1 as InternalId, resource_kind: null, region: null, metric: 'gpu', limit_value: 64, used_value: 0 },
  { id: 2 as InternalId, org_id: 1 as InternalId, resource_kind: null, region: null, metric: 'vcpu', limit_value: 512, used_value: 0 },
  { id: 3 as InternalId, org_id: 1 as InternalId, resource_kind: null, region: null, metric: 'storage_gb', limit_value: 20480, used_value: 0 },
  { id: 4 as InternalId, org_id: 1 as InternalId, resource_kind: null, region: null, metric: 'public_ip', limit_value: 16, used_value: 0 },
];

/**
 * 配额占用口径（PRD §7.3，明确避免歧义）：
 *  gpu/vcpu   占用于 provisioning | running；stopped 释放算力配额
 *  storage_gb 占用于 provisioning | running | stopped（数据盘保留）
 *  terminating / deleted_at 非空 ⇒ 全部释放
 */
export function occupiesQuota(
  metric: QuotaMetric,
  status: 'provisioning' | 'running' | 'stopped' | 'error' | 'terminating',
): boolean {
  if (status === 'terminating') return false;
  if (metric === 'storage_gb') {
    return status === 'provisioning' || status === 'running' || status === 'stopped' || status === 'error';
  }
  return status === 'provisioning' || status === 'running';
}

export const RESERVED_REGIONS: RegionCode[] = ['jp', 'th', 'sg', 'us'];
