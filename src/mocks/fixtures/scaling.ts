// 弹性伸缩策略与伸缩事件种子（v0.7 · ARCH §12.12 · PRD §4.2.6 / §4.5.2 · MOCK-DATA §6.9 / §9.4）
// G5 确定性：全部数值由 rngFor(seed) 派生，禁止 Math.random。
import type {
  InternalId,
  Resource,
  ResourceKind,
  ScalingDirection,
  ScalingEvent,
  ScalingPolicy,
  ScalingPolicyRow,
  ScalingTrigger,
  StrategyModel,
} from '../../types/domain';
import { RESOURCES } from './resources';
import { ORG } from './users-orgs';
import { between, intBetween, rngFor } from '../lib/rng';

const HOUR = 3600_000;
const bootAt = Date.now();

/** 策略模型由资源形态唯一决定（PRD §4.2.6.1：两类不共用表单） */
export const strategyModelOf = (kind: ResourceKind): StrategyModel =>
  kind === 'inference' ? 'replica' : 'node_pool';

/** 触发指标的合理取值区间（MOCK-DATA §6.9 阈值口径） */
const METRIC_RANGE: Record<ScalingTrigger, { target: number; out: [number, number]; in: [number, number] }> = {
  queue_depth: { target: 20, out: [23, 48], in: [1, 8] },
  pending_pods: { target: 12, out: [14, 40], in: [0, 5] },
  qpm: { target: 300, out: [312, 520], in: [41, 79] },
  gpu_allocation_rate: { target: 80, out: [82, 96], in: [15, 34] },
  concurrency: { target: 64, out: [66, 140], in: [8, 60] },
  requests_waiting: { target: 12, out: [14, 40], in: [0, 5] },
  ttft_p99: { target: 800, out: [820, 2400], in: [180, 700] },
  kv_cache_usage: { target: 85, out: [86, 97], in: [30, 80] },
};

/** 稳定 UUID（由种子派生） */
function stableUuid(rand: () => number): string {
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i++) {
    s += i === 12 ? '4' : i === 16 ? hex[(Math.floor(rand() * 16) & 0x3) | 0x8] : hex[Math.floor(rand() * 16)];
    if (i === 7 || i === 11 || i === 15 || i === 19) s += '-';
  }
  return s;
}

/**
 * 资源「当前被弹维度」的实际值 —— 必须与 resources.spec_json 一致
 * （MOCK-DATA §6.9：策略卡展示的"当前 N 台/副本"不得与实际规格矛盾）。
 * 裸金属 = 台数；vGPU = 节点数；推理 = 副本数；GPU 云服务器 = 实例数（单实例资源恒为 1）。
 */
export function actualSizeOf(r: Resource): number {
  const spec = r.spec_json as unknown as Record<string, unknown>;
  switch (r.kind) {
    case 'gpu_baremetal':
      return Math.max(1, Number(spec.machine_count ?? 1));
    case 'vgpu':
      return Math.max(1, Number(spec.node_count ?? 1));
    case 'inference':
      return Math.max(1, Number(spec.replicas ?? 1));
    default:
      return 1;
  }
}

/** 伸缩耗时口径（MOCK-DATA §6.9：必须按形态区分；warm pool 命中 ≤10s） */
function durationOf(rand: () => number, r: Resource, warmHit: boolean): number {
  if (r.kind === 'inference') return warmHit ? intBetween(rand, 1, 5) : intBetween(rand, 30, 720);
  if (r.kind === 'gpu_baremetal') return intBetween(rand, 300, 1800);
  if (r.kind === 'vgpu') return intBetween(rand, 30, 120);
  return intBetween(rand, 60, 300);
}

interface PolicySeed {
  /** 绑定资源名（RESOURCES 中唯一） */
  resource: string;
  metric: ScalingTrigger;
  min: number;
  max: number;
  status: ScalingPolicy['status'];
  scale_to_zero?: boolean;
  /** 目标值覆盖（默认取 METRIC_RANGE.target） */
  target?: number;
  /** 冷启动防抖窗口（裸金属 10–30min） */
  cooldown_s?: number;
  ageDays: number;
}

/**
 * 11 条生效策略：覆盖四区域 × 两类模型（node_pool 8 / replica 3），
 * 含 1 条 paused 与 1 条 cooldown，裸金属 min_size ≥ 1（warm floor 铁律）。
 */
const SEEDS: PolicySeed[] = [
  { resource: 'llm-pretrain-01', metric: 'queue_depth', min: 1, max: 4, status: 'active', ageDays: 26 },
  { resource: 'bm-h100-jp07', metric: 'gpu_allocation_rate', min: 1, max: 3, status: 'active', cooldown_s: 1200, ageDays: 30 },
  { resource: 'cks-inference-jp', metric: 'queue_depth', min: 2, max: 6, status: 'active', ageDays: 22 },
  { resource: 'qwen-72b-prod', metric: 'ttft_p99', min: 1, max: 8, status: 'active', target: 800, ageDays: 18 },
  { resource: 'th-finetune-01', metric: 'qpm', min: 1, max: 3, status: 'active', ageDays: 15 },
  { resource: 'th-llama-8b-chat', metric: 'concurrency', min: 1, max: 6, status: 'active', target: 64, ageDays: 12 },
  { resource: 'bm-h100-sg05', metric: 'gpu_allocation_rate', min: 1, max: 4, status: 'active', cooldown_s: 1800, ageDays: 20 },
  { resource: 'cks-training-us', metric: 'pending_pods', min: 2, max: 8, status: 'active', ageDays: 28 },
  { resource: 'llama-8b-chat-us', metric: 'kv_cache_usage', min: 1, max: 4, status: 'active', target: 85, ageDays: 10 },
  { resource: 'cks-us-b300', metric: 'queue_depth', min: 2, max: 5, status: 'paused', ageDays: 24 },
  { resource: 'bm-b200-rack01', metric: 'gpu_allocation_rate', min: 1, max: 2, status: 'cooldown', cooldown_s: 1500, ageDays: 21 },
];

function resourceByName(name: string): Resource {
  const r = RESOURCES.find((x) => x.name === name && !x.deleted_at);
  if (!r) throw new Error(`scaling fixture: 绑定资源不存在 ${name}`);
  return r;
}

/** 方向序列：≥2 次扩容 + ≥1 次缩容 + 尾部一组人工暂停/恢复（§9.4 密度） */
function buildDirections(rand: () => number, n: number, paused: boolean): ScalingDirection[] {
  const dirs: ScalingDirection[] = ['scale_out', 'scale_out', 'scale_in'];
  for (let i = dirs.length; i < n; i++) {
    dirs.push(rand() < 0.55 ? 'scale_out' : 'scale_in');
  }
  const list = dirs.slice(0, n);
  if (!paused && n >= 4) {
    // 末尾追加"人工暂停 → 恢复"一组（数值仍满足方向自洽）
    list[n - 2] = 'scale_in';
    list[n - 1] = 'scale_out';
  } else if (paused && n >= 2) {
    list[n - 1] = 'scale_in';
  }
  return list;
}

/** 事件计数：6–15 条（§9.4 密度） */
function buildEvents(p: ScalingPolicy, r: Resource, rand: () => number): ScalingEvent[] {
  const n = intBetween(rand, 6, 15);
  const dirs = buildDirections(rand, n, p.status === 'paused');
  const range = METRIC_RANGE[p.trigger_metric];
  const target = p.target_value ?? range.target;

  // ① 反向游走构造 size 序列，保证末值 = 资源实际规格（当前值自洽）
  const seq: number[] = new Array(n + 1).fill(p.min_size);
  seq[n] = p.status === 'paused' ? p.min_size : actualSizeOf(r);
  // 失败回退事件位置：必须落在扩容事件上（体现 fallback_enabled；§9.4 异常事件禁止全部成功）
  const clamp = (v: number): number => Math.min(p.max_size, Math.max(p.min_size, v));
  for (let i = n - 1; i >= 0; i--) {
    const cur = seq[i + 1];
    const delta = intBetween(rand, 1, 2);
    const outPrev = clamp(cur - delta);
    const inPrev = clamp(cur + delta);
    // 方向可行性：from 必须落在 [min,max] 且 ≠ to（§9.4 方向与数值自洽）
    let d: ScalingDirection = dirs[i];
    if (d === 'scale_out' && outPrev >= cur) d = 'scale_in';
    if (d === 'scale_in' && inPrev <= cur) d = 'scale_out';
    let prev = d === 'scale_out' ? outPrev : inPrev;
    // 兜底：max > min 恒成立，必然存在相邻可行值
    if (prev === cur) {
      if (cur + 1 <= p.max_size) {
        d = 'scale_in';
        prev = cur + 1;
      } else {
        d = 'scale_out';
        prev = cur - 1;
      }
    }
    dirs[i] = d;
    seq[i] = prev;
  }
  // 裸金属 warm floor：任何时刻不得为 0
  if (r.kind === 'gpu_baremetal') for (let i = 0; i <= n; i++) seq[i] = Math.max(1, seq[i]);

  const outIdx = dirs.map((d, i) => (d === 'scale_out' ? i : -1)).filter((i) => i >= 0);
  const failIdx = outIdx.length > 0 ? outIdx[intBetween(rand, 0, outIdx.length - 1)] : -1;

  // ② 时间轴：策略创建后首次评估 → 均匀分布至当前（全部早于 now）
  const startAt = new Date(p.created_at).getTime();
  const span = Math.max(HOUR, bootAt - startAt - HOUR);
  const stamps: number[] = [];
  for (let i = 1; i <= n; i++) {
    const base = startAt + (span * i) / (n + 1);
    stamps.push(Math.min(bootAt - 60_000, Math.round(base + between(rand, -span / (4 * n), span / (4 * n)))));
  }
  stamps.sort((a, b) => a - b);

  const events: ScalingEvent[] = [];
  for (let i = 0; i < n; i++) {
    const d = dirs[i];
    const from = seq[i];
    const to = seq[i + 1];
    const isFail = i === failIdx && p.fallback_enabled && d === 'scale_out';
    const isManual =
      (p.status !== 'paused' && i === n - 2) || (p.status !== 'paused' && i === n - 1) ||
      (p.status === 'paused' && i === n - 1);
    const warmHit = r.kind === 'inference' ? rand() < 0.62 : null;
    const value =
      d === 'scale_out'
        ? Math.round(between(rand, range.out[0], range.out[1]) * 100) / 100
        : Math.round(between(rand, range.in[0], range.in[1]) * 100) / 100;
    const reason = isFail
      ? '目标节点池库存不足，已回退至同型邻近池 H200_NVL（fallback_enabled）'
      : isManual
        ? p.status === 'paused' || i === n - 2
          ? '人工暂停策略：缩容至 min 并冻结伸缩'
          : '人工恢复策略：扩容回业务水位'
        : null;
    events.push({
      id: (p.id * 100 + i + 1) as InternalId,
      event_uuid: stableUuid(rngFor(`scaling-event:${p.id}:${i}`)),
      policy_id: p.id,
      resource_id: r.id,
      direction: d,
      from_size: from,
      to_size: to,
      trigger_snapshot: {
        metric: p.trigger_metric,
        value,
        target,
        windowS: p.trigger_metric === 'gpu_allocation_rate' ? 600 : p.trigger_metric === 'qpm' ? 300 : 120,
      },
      warm_pool_hit: warmHit,
      duration_s: durationOf(rand, r, warmHit === true),
      reason,
      created_at: new Date(stamps[i]).toISOString(),
    });
  }
  return events;
}

function buildPolicy(seed: PolicySeed, index: number): { policy: ScalingPolicy; events: ScalingEvent[] } {
  const r = resourceByName(seed.resource);
  const rand = rngFor(`scaling-policy:${seed.resource}`);
  const model = strategyModelOf(r.kind);
  const createdAt = new Date(bootAt - seed.ageDays * 86400_000).toISOString();
  const lastEventDays = Math.max(0.2, seed.ageDays * between(rand, 0.02, 0.2));
  const updatedAt = new Date(bootAt - lastEventDays * 86400_000).toISOString();
  const policy: ScalingPolicy = {
    id: (index + 1) as InternalId,
    policy_uuid: stableUuid(rand),
    org_id: ORG.id,
    resource_id: r.id,
    strategy_model: model,
    trigger_metric: seed.metric,
    target_value: seed.target ?? METRIC_RANGE[seed.metric].target,
    min_size: seed.min,
    max_size: seed.max,
    // 仅 replica 模型允许缩到 0；默认关闭（PRD §4.2.6.2 冷启动风险）
    scale_to_zero: model === 'replica' ? seed.scale_to_zero === true : false,
    drain_timeout_s: model === 'replica' ? intBetween(rand, 120, 600) : 300,
    fallback_enabled: true,
    cooldown_s: seed.cooldown_s ?? (model === 'replica' ? 300 : 600),
    status: seed.status,
    created_at: createdAt,
    updated_at: updatedAt,
  };
  return { policy, events: buildEvents(policy, r, rand) };
}

const BUILT = SEEDS.map(buildPolicy);

export const SCALING_POLICIES: ScalingPolicy[] = BUILT.map((b) => b.policy);
export const SCALING_EVENTS: ScalingEvent[] = BUILT.flatMap((b) => b.events).sort((a, b) =>
  a.created_at < b.created_at ? 1 : -1,
);

let createdSeq = 0;

/** 策略行：策略 + 绑定资源投影 + 当前实际值 + 最近一次伸缩时间 */
export function policyRows(
  region?: string | null,
  model?: StrategyModel | 'all' | null,
): ScalingPolicyRow[] {
  const lastAt = new Map<number, string>();
  for (const e of SCALING_EVENTS) {
    const cur = lastAt.get(e.policy_id);
    if (!cur || e.created_at > cur) lastAt.set(e.policy_id, e.created_at);
  }
  return SCALING_POLICIES.map((p) => {
    const r = RESOURCES.find((x) => x.id === p.resource_id);
    if (!r) return null;
    if (region && region !== 'all' && r.region !== region) return null;
    if (model && model !== 'all' && p.strategy_model !== model) return null;
    return {
      ...p,
      resource_uuid: r.resource_uuid as string,
      display_id: r.display_id,
      resource_name: r.name,
      resource_kind: r.kind,
      region: r.region,
      current_size: actualSizeOf(r),
      last_event_at: lastAt.get(p.id) ?? null,
    };
  }).filter((x): x is ScalingPolicyRow => x !== null);
}

export function policyById(id: number): ScalingPolicy | undefined {
  return SCALING_POLICIES.find((p) => p.id === id);
}

export function eventsOfPolicy(policyId: number): ScalingEvent[] {
  return SCALING_EVENTS.filter((e) => e.policy_id === policyId);
}

/** 资源是否已有生效策略（工作台「新建策略」仅列未绑定资源） */
export function hasActivePolicy(resourceId: number): boolean {
  return SCALING_POLICIES.some((p) => p.resource_id === resourceId && p.status !== 'paused');
}

/** 资源绑定的生效策略（资源详情「弹性」Tab 只读视图） */
export function policyOfResource(resourceId: number): ScalingPolicy | undefined {
  return SCALING_POLICIES.find((p) => p.resource_id === resourceId);
}

export interface PolicyUpsertInput {
  resource_id: number;
  strategy_model: StrategyModel;
  trigger_metric: ScalingTrigger;
  target_value?: number | null;
  min_size: number;
  max_size: number;
  scale_to_zero?: boolean;
  drain_timeout_s?: number;
  fallback_enabled?: boolean;
  cooldown_s?: number;
}

export type PolicyUpsertResult =
  | { ok: true; policy: ScalingPolicy }
  | { ok: false; code: string; message: string };

/**
 * 新建策略（工作台写入口 / 向导下单物化共用，PRD §4.2.6.3 同一数据模型）。
 * 校验铁律：裸金属 min_size ≥ 1；scale_to_zero 仅 replica；max ≥ min。
 */
export function createPolicy(input: PolicyUpsertInput): PolicyUpsertResult {
  const r = RESOURCES.find((x) => x.id === input.resource_id);
  if (!r) return { ok: false, code: 'RESOURCE_NOT_FOUND', message: '绑定资源不存在' };
  const model = strategyModelOf(r.kind);
  if (model !== input.strategy_model) {
    return { ok: false, code: 'MODEL_KIND_MISMATCH', message: '策略模型与资源形态不匹配' };
  }
  if (hasActivePolicy(r.id)) {
    return { ok: false, code: 'RESOURCE_ALREADY_BOUND', message: '该资源已绑定生效策略' };
  }
  if (r.kind === 'gpu_baremetal' && input.min_size < 1) {
    return { ok: false, code: 'WARM_FLOOR_REQUIRED', message: 'GPU 裸金属必须保留 warm floor（min ≥ 1）' };
  }
  if (input.scale_to_zero && model !== 'replica') {
    return { ok: false, code: 'SCALE_TO_ZERO_NOT_ALLOWED', message: '仅服务副本伸缩策略允许缩到 0' };
  }
  if (input.max_size < input.min_size) {
    return { ok: false, code: 'INVALID_RANGE', message: 'max_size 不得小于 min_size' };
  }
  createdSeq += 1;
  const ts = new Date().toISOString();
  const policy: ScalingPolicy = {
    id: (500 + createdSeq) as InternalId,
    policy_uuid: stableUuid(rngFor(`policy-new:${r.id}:${createdSeq}`)),
    org_id: ORG.id,
    resource_id: r.id,
    strategy_model: model,
    trigger_metric: input.trigger_metric,
    target_value: input.target_value ?? METRIC_RANGE[input.trigger_metric].target,
    min_size: input.min_size,
    max_size: input.max_size,
    scale_to_zero: model === 'replica' ? input.scale_to_zero === true : false,
    drain_timeout_s: input.drain_timeout_s ?? (model === 'replica' ? 300 : 300),
    fallback_enabled: input.fallback_enabled ?? true,
    cooldown_s: input.cooldown_s ?? (model === 'replica' ? 300 : 600),
    status: 'active',
    created_at: ts,
    updated_at: ts,
  };
  // 新建策略不写事件：§9.4 要求 scale_out 必有 to_size > from_size，
  // 「首次评估未触发」不产生事件行，时间线保持纯伸缩审计。
  SCALING_POLICIES.push(policy);
  return { ok: true, policy };
}

/** 编辑 / 暂停 / 恢复（工作台单一写入口，PRD §4.5.2） */
export function updatePolicy(
  id: number,
  patch: Partial<Pick<ScalingPolicy, 'min_size' | 'max_size' | 'target_value' | 'cooldown_s' | 'drain_timeout_s' | 'status'>>,
): PolicyUpsertResult {
  const p = policyById(id);
  if (!p) return { ok: false, code: 'POLICY_NOT_FOUND', message: '策略不存在' };
  const r = RESOURCES.find((x) => x.id === p.resource_id);
  const nextMin = patch.min_size ?? p.min_size;
  const nextMax = patch.max_size ?? p.max_size;
  if (r?.kind === 'gpu_baremetal' && nextMin < 1) {
    return { ok: false, code: 'WARM_FLOOR_REQUIRED', message: 'GPU 裸金属必须保留 warm floor（min ≥ 1）' };
  }
  if (nextMax < nextMin) return { ok: false, code: 'INVALID_RANGE', message: 'max_size 不得小于 min_size' };
  if (patch.min_size !== undefined) p.min_size = patch.min_size;
  if (patch.max_size !== undefined) p.max_size = patch.max_size;
  if (patch.target_value !== undefined) p.target_value = patch.target_value;
  if (patch.cooldown_s !== undefined) p.cooldown_s = patch.cooldown_s;
  if (patch.drain_timeout_s !== undefined) p.drain_timeout_s = patch.drain_timeout_s;
  if (patch.status !== undefined) p.status = patch.status;
  p.updated_at = new Date().toISOString();
  return { ok: true, policy: p };
}

export type PolicyDeleteResult = { ok: true } | { ok: false; code: string; message: string };

/** 解绑策略：绑定资源仍在运行则 409（PRD §4.5.2 引导先停） */
export function deletePolicy(id: number): PolicyDeleteResult {
  const idx = SCALING_POLICIES.findIndex((p) => p.id === id);
  if (idx < 0) return { ok: false, code: 'POLICY_NOT_FOUND', message: '策略不存在' };
  const p = SCALING_POLICIES[idx];
  const r = RESOURCES.find((x) => x.id === p.resource_id);
  if (r && !r.deleted_at && (r.status === 'running' || r.status === 'provisioning')) {
    return {
      ok: false,
      code: 'POLICY_BOUND_RESOURCE_RUNNING',
      message: '绑定资源仍在运行，请先停止资源后再解绑策略',
    };
  }
  SCALING_POLICIES.splice(idx, 1);
  for (let i = SCALING_EVENTS.length - 1; i >= 0; i--) {
    if (SCALING_EVENTS[i].policy_id === id) SCALING_EVENTS.splice(i, 1);
  }
  return { ok: true };
}
