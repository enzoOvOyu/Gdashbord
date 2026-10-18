// 租户 / 用户 / 项目 / 套餐 / 配额（ARCH §12.1 identity · §7.2 套餐 · §7.3 配额）
import type {
  InternalId,
  Org,
  Plan,
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

// 项目已迁至 fixtures/projects.ts（PRD §3.5：真实可增删改的实体，不再写死）
export { PROJECTS, defaultProjectId, projectName } from './projects';

/**
 * 配额（PRD §7.3：作用域 (org_id, resource_kind?, region?)；
 * used_value 为派生值，由占用口径重算，禁止业务代码直写）。
 * 行按**区域作用域**组织（4 区域 × 4 指标 = 16 行），limit 按种子资源占用量留 10%–40% 水位，
 * 其中 th 的 GPU 配额故意设为紧张水位（94%）以演示「接近上限」告警路径。
 * org 级行（region=null）表示不限区域，本版本不使用。
 */
const QUOTA_LIMITS: Record<RegionCode, Record<QuotaMetric, number>> = {
  jp: { gpu: 48, vcpu: 640, storage_gb: 12288, public_ip: 6 },
  th: { gpu: 16, vcpu: 256, storage_gb: 4096, public_ip: 8 },
  sg: { gpu: 32, vcpu: 320, storage_gb: 16384, public_ip: 8 },
  us: { gpu: 96, vcpu: 1280, storage_gb: 40960, public_ip: 16 },
};

const QUOTA_REGIONS: RegionCode[] = ['jp', 'th', 'sg', 'us'];

export const QUOTAS: Quota[] = QUOTA_REGIONS.flatMap((region) =>
  (Object.keys(QUOTA_LIMITS[region]) as QuotaMetric[]).map((metric, i) => ({
    id: (QUOTA_REGIONS.indexOf(region) * 4 + i + 1) as InternalId,
    org_id: 1 as InternalId,
    resource_kind: null,
    region,
    metric,
    limit_value: QUOTA_LIMITS[region][metric],
    used_value: 0,
  })),
);

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

/** 预留区域清单（与 QUOTA_REGIONS 同序，保持单一事实来源） */
export const RESERVED_REGIONS: RegionCode[] = QUOTA_REGIONS;
