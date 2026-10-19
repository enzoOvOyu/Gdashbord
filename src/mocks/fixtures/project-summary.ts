// 项目卡片 / 详情聚合（v0.7 · PRD §3.5.1 · ARCH §12.11 GET /api/projects/:id/summary）
// 全部数值由 resources / billing_usage / quotas 真实派生，禁止硬编码（MOCK-DATA §1 G1）。
import type {
  DisplayId,
  InternalId,
  Project,
  ProjectSummary,
  QuotaMetric,
  RegionCode,
  ResourceKind,
} from '../../types/domain';
import { RESOURCES } from './resources';
import { USAGE_ROWS } from './billing';
import { QUOTAS } from './users-orgs';
import { PROJECTS, projectById } from './projects';
import { USERS } from './users-orgs';
import { billingPeriodOf } from './billing';
import { rngFor, intBetween } from '../lib/rng';

const KIND_LIST: ResourceKind[] = ['gpu_vm', 'gpu_baremetal', 'vgpu', 'inference'];

/** 资源占用的 GPU 数（裸金属按整机 gpu_count，其余同） */
const gpuOf = (r: (typeof RESOURCES)[number]): number => r.gpu_count;

/**
 * 项目聚合：运行中 GPU / 总 GPU / 四类计数 / 本月成本与环比 / 配额水位 / 成员数 / 最近资源。
 * 配额水位取该项目资源所在区域、按 GPU 指标的最大占用率（无资源时为 0）。
 */
export function projectSummaryOf(p: Project): ProjectSummary {
  const live = RESOURCES.filter((r) => r.project_id === p.id && !r.deleted_at);
  const running = live.filter((r) => r.status === 'running');
  const gpuRunning = running.reduce((a, r) => a + gpuOf(r), 0);
  const gpuTotal = live.reduce((a, r) => a + gpuOf(r), 0);

  const kindCounts = KIND_LIST.reduce((acc, k) => {
    acc[k] = live.filter((r) => r.kind === k).length;
    return acc;
  }, {} as Record<ResourceKind, number>);

  // 本月 / 上月成本（由 USAGE_ROWS 真实累计，§7.7 三表同源）
  const period = billingPeriodOf(new Date().toISOString());
  const prevPeriod = billingPeriodOf(new Date(Date.now() - 30 * 86400_000).toISOString());

  const round2 = (n: number): number => Math.round(n * 100) / 100;
  const costMtd = round2(
    USAGE_ROWS.filter((u) => u.project_id === p.id && billingPeriodOf(u.usage_hour) === period).reduce(
      (a, u) => a + u.amount,
      0,
    ),
  );
  const costPrev = round2(
    USAGE_ROWS.filter((u) => u.project_id === p.id && billingPeriodOf(u.usage_hour) === prevPeriod).reduce(
      (a, u) => a + u.amount,
      0,
    ),
  );

  // 配额水位：取项目资源所在区域的 GPU 指标占用率最大值
  const regions = Array.from(new Set(live.map((r) => r.region))) as RegionCode[];
  const quotaUsagePct = regions.length
    ? Math.round(
        Math.max(
          ...regions.map((region) => {
            const row = QUOTAS.find((q) => q.region === region && q.metric === ('gpu' as QuotaMetric));
            if (!row || row.limit_value === 0) return 0;
            const used = live
              .filter((r) => r.region === region)
              .reduce((a, r) => a + gpuOf(r), 0);
            return (used / row.limit_value) * 100;
          }),
        ) * 10,
      ) / 10
    : 0;

  // 成员数：按项目确定派生（真实 IAM 由后端下发；Mock 阶段保持稳定）
  const memberCount = intBetween(rngFor(`project-members:${p.slug}`), 3, 9);

  const recent = live
    .slice()
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 5)
    .map((r) => ({
      resource_uuid: r.resource_uuid as string,
      display_id: r.display_id as DisplayId,
      name: r.name,
      kind: r.kind,
      status: r.status,
      region: r.region,
    }));

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    is_default: p.is_default,
    default_region: p.default_region,
    created_at: p.created_at,
    gpu_running: gpuRunning,
    gpu_total: gpuTotal,
    kind_counts: kindCounts,
    running_count: running.length,
    cost_mtd: costMtd,
    cost_prev_mtd: costPrev,
    quota_usage_pct: quotaUsagePct,
    member_count: memberCount,
    recent_resources: recent,
  };
}

/** 全部项目摘要（项目卡片网格） */
export function projectSummaries(): ProjectSummary[] {
  return PROJECTS.map(projectSummaryOf);
}

export function projectSummaryById(id: InternalId): ProjectSummary | null {
  const p = projectById(id);
  return p ? projectSummaryOf(p) : null;
}

/** 组织内 IAM 用户总数（项目详情·成员 Tab 的兜底口径） */
export const ORG_MEMBER_TOTAL = USERS.length;

export interface ProjectMember {
  id: InternalId;
  display_name: string;
  email: string;
  role: string;
  status: string;
}

/**
 * 项目成员：真实 IAM 归属日后由后端下发；Mock 阶段取组织内 IAM 用户的稳定子集
 * （按项目 slug 派生，保证同一项目每次加载结果一致，G5）。
 */
export function projectMembersOf(p: Project): ProjectMember[] {
  const rand = rngFor(`project-members-list:${p.slug}`);
  const size = Math.min(USERS.length, intBetween(rngFor(`project-members:${p.slug}`), 3, Math.max(3, USERS.length)));
  const pool = USERS.slice();
  // Fisher–Yates（确定性随机源）
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, size).map((u) => ({
    id: u.id,
    display_name: u.display_name,
    email: u.email,
    role: u.role,
    status: u.status,
  }));
}
