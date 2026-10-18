// 计费数据层（PRD §7.8 / MOCK-DATA §7.1、§7.7）
// 每个展示金额都能由 billing_usage 的 quantity × unit_price 加总复算，禁止另设"展示用金额"（§4.4.1 约束 2）。
import type {
  BillingTransaction,
  BillingUsage,
  CostSlice,
  InternalId,
  NodePoolCode,
  RegionCode,
  Resource,
  ResourceKind,
  UsageRow,
} from '../../types/domain';
import {
  HOURS_PER_MONTH,
  REGION_MULTIPLIER,
  STORAGE_RATE_GB_MONTH,
  effectiveRatePerClusterHour,
  effectiveRatePerGpuHour,
  effectiveRatePerMachineHour,
  round2,
} from './pricing';
import { NODE_POOLS } from './nodes';
import { projectName } from './projects';
import type { GpuBareMetalSpec, InferenceSpec, VgpuSpec } from '../../types/domain';

/** 用量明细保留窗口（小时）—— 支撑 7.8 ③ 用量明细表与成本页趋势图 */
const USAGE_WINDOW_HOURS = 72;
const HOUR_MS = 3_600_000;

export const GB_HOUR_RATE = round2(STORAGE_RATE_GB_MONTH / HOURS_PER_MONTH);

const gpusPerNode = (pool: NodePoolCode): number =>
  NODE_POOLS.find((p) => p.code === pool)?.gpus_per_node ?? 8;

/** 账期（YYYY-MM），全文统一 */
export function billingPeriodOf(iso: string): string {
  return iso.slice(0, 7);
}

export const currentBillingPeriod = (): string =>
  billingPeriodOf(new Date().toISOString());

/** 该资源的计费数量口径（PRD §7.8：单位随类型变化） */
export function billableUnitsOf(r: Resource): {
  unit: BillingUsage['unit'];
  gpuEquivalent: number;
  rate: number;
} {
  const pool = r.node_pool;
  const region = r.region;
  if (r.kind === 'gpu_baremetal') {
    const spec = r.spec_json as GpuBareMetalSpec;
    return {
      unit: 'per_machine_hour',
      gpuEquivalent: spec.machine_count,
      rate: effectiveRatePerMachineHour(pool, region),
    };
  }
  if (r.kind === 'vgpu') {
    const spec = r.spec_json as VgpuSpec;
    return {
      unit: 'per_gpu_hour',
      gpuEquivalent: spec.node_count * gpusPerNode(pool),
      rate: effectiveRatePerGpuHour(pool, region),
    };
  }
  if (r.kind === 'inference') {
    const spec = r.spec_json as InferenceSpec;
    return {
      unit: 'per_gpu_hour',
      gpuEquivalent: spec.replicas * spec.gpu_count,
      rate: effectiveRatePerGpuHour(pool, region),
    };
  }
  return {
    unit: 'per_gpu_hour',
    gpuEquivalent: r.gpu_count,
    rate: effectiveRatePerGpuHour(pool, region),
  };
}

/** vGPU 控制面单小时价（standard / HA×3），仅 vgpu 有 */
export function controlPlaneRateOf(r: Resource): number {
  if (r.kind !== 'vgpu') return 0;
  const spec = r.spec_json as VgpuSpec;
  return effectiveRatePerClusterHour(r.region, spec.control_plane_tier === 'ha');
}

/** 该资源是否计块存储（裸金属本地 NVMe 为整机自带，不单列存储行） */
const billsStorage = (r: Resource): boolean =>
  r.kind !== 'gpu_baremetal' && r.kind !== 'inference' && r.storage_gb > 0;

/** 计量触发点（PRD §7.4）：provisioning 不计，terminating/deleted 立即停计 */
function meteringOf(r: Resource, slotStart: number): {
  countsGpu: boolean;
  countsStorage: boolean;
} {
  if (r.deleted_at) return { countsGpu: false, countsStorage: false };
  if (r.status === 'terminating') return { countsGpu: false, countsStorage: false };
  if (r.status === 'provisioning') return { countsGpu: false, countsStorage: false };
  if (r.stopped_at && slotStart >= +new Date(r.stopped_at)) {
    return { countsGpu: false, countsStorage: billsStorage(r) };
  }
  if (r.status === 'error') return { countsGpu: false, countsStorage: billsStorage(r) };
  if (r.status === 'stopped') return { countsGpu: false, countsStorage: billsStorage(r) };
  return { countsGpu: true, countsStorage: billsStorage(r) };
}

let rowSeq = 0;

/** 为单个资源生成指定窗口内的用量行（UNIQUE(resource_id, usage_hour, unit)） */
function buildUsageRows(r: Resource, nowMs: number): UsageRow[] {
  const created = +new Date(r.created_at);
  const rows: UsageRow[] = [];
  const currentHour = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
  const { unit, gpuEquivalent, rate } = billableUnitsOf(r);
  const cpRate = controlPlaneRateOf(r);

  for (let h = USAGE_WINDOW_HOURS - 1; h >= 0; h -= 1) {
    const slotStart = currentHour - h * HOUR_MS;
    const slotEnd = slotStart + HOUR_MS;
    if (slotEnd <= created) continue;
    const from = Math.max(slotStart, created);
    const to = Math.min(slotEnd, nowMs);
    if (to <= from) continue;
    const coverage = (to - from) / HOUR_MS;
    const { countsGpu, countsStorage } = meteringOf(r, slotStart);
    const usageHour = new Date(slotStart).toISOString();
    const period = billingPeriodOf(usageHour);
    const base = {
      id: (rowSeq += 1) as InternalId,
      org_id: r.org_id,
      project_id: r.project_id,
      resource_id: r.id,
      resource_kind: r.kind,
      node_pool: r.node_pool,
      region: r.region,
      billing_period: period,
      usage_hour: usageHour,
      resource_uuid: r.resource_uuid as string,
      resource_name: r.name,
      project_name: projectName(r.project_id),
    };

    if (countsGpu && gpuEquivalent > 0) {
      const quantity = round4(gpuEquivalent * coverage);
      rows.push({
        ...base,
        id: (rowSeq += 1) as InternalId,
        unit,
        quantity,
        unit_price: rate,
        amount: round4(quantity * rate),
      });
    }
    if (r.kind === 'vgpu' && cpRate > 0) {
      const quantity = round4(1 * coverage);
      rows.push({
        ...base,
        id: (rowSeq += 1) as InternalId,
        unit: 'per_cluster_hour',
        quantity,
        unit_price: cpRate,
        amount: round4(quantity * cpRate),
      });
    }
    if (countsStorage) {
      const quantity = round4(r.storage_gb * coverage);
      rows.push({
        ...base,
        id: (rowSeq += 1) as InternalId,
        unit: 'per_gb_hour',
        quantity,
        unit_price: GB_HOUR_RATE,
        amount: round4(quantity * GB_HOUR_RATE),
      });
    }
  }
  return rows;
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

// ─────────── 仓储（可变：创建/删除资源后需重算） ───────────
export let USAGE_ROWS: UsageRow[] = [];

const nowMs = () => Date.now();

export function rebuildUsage(resources: Resource[]): void {
  const now = nowMs();
  USAGE_ROWS = resources.flatMap((r) => buildUsageRows(r, now));
}

export function appendUsageFor(r: Resource): void {
  USAGE_ROWS = [...USAGE_ROWS, ...buildUsageRows(r, nowMs())];
}

// ─────────── 查询 ───────────
export const usageOfResource = (resourceId: InternalId): UsageRow[] =>
  USAGE_ROWS.filter((u) => u.resource_id === resourceId);

export interface UsageFilter {
  fromIso?: string;
  toIso?: string;
  unit?: string;
}

export function usageOfResourceFiltered(
  resourceId: InternalId,
  f: UsageFilter = {},
): UsageRow[] {
  return usageOfResource(resourceId).filter((u) => {
    if (f.unit && u.unit !== f.unit) return false;
    if (f.fromIso && u.usage_hour < f.fromIso) return false;
    if (f.toIso && u.usage_hour > f.toIso) return false;
    return true;
  });
}

const startOfToday = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const startOfMonth = (): string => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export interface ResourceCostSummary {
  today: number;
  mtd: number;
  total: number;
  gpu_hours: number;
  storage_gb_hours: number;
  machine_hours: number;
  cluster_hours: number;
}

export function costSummaryOf(resourceId: InternalId): ResourceCostSummary {
  const rows = usageOfResource(resourceId);
  const sum = (pred: (u: UsageRow) => boolean): number =>
    round2(rows.filter(pred).reduce((a, b) => a + b.amount, 0));
  const qty = (unit: BillingUsage['unit']): number =>
    round2(rows.filter((u) => u.unit === unit).reduce((a, b) => a + b.quantity, 0));
  const mtdRows = rows.filter((u) => u.usage_hour >= startOfMonth());
  const todayRows = rows.filter((u) => u.usage_hour >= startOfToday());
  return {
    today: round2(todayRows.reduce((a, b) => a + b.amount, 0)),
    mtd: round2(mtdRows.reduce((a, b) => a + b.amount, 0)),
    total: sum(() => true),
    gpu_hours: qty('per_gpu_hour'),
    storage_gb_hours: qty('per_gb_hour'),
    machine_hours: qty('per_machine_hour'),
    cluster_hours: qty('per_cluster_hour'),
  };
}

// ─────────── 成本页四维下钻（PRD §4.4.1） ───────────
export type CostDimension = 'project' | 'resource' | 'region' | 'kind';

interface SliceAcc {
  amount: number;
  gpu_hours: number;
  storage_gb_hours: number;
  resources: Map<string, { uuid: string; name: string; amount: number }>;
  kind: ResourceKind | null;
}

function sliceRows(
  rows: UsageRow[],
  keyOf: (u: UsageRow) => string,
  labelOf: (key: string, sample: UsageRow) => string,
): CostSlice[] {
  const acc = new Map<string, SliceAcc>();
  for (const u of rows) {
    const key = keyOf(u);
    let a = acc.get(key);
    if (!a) {
      a = {
        amount: 0,
        gpu_hours: 0,
        storage_gb_hours: 0,
        resources: new Map(),
        kind: u.resource_kind,
      };
      acc.set(key, a);
    }
    a.amount += u.amount;
    if (u.unit === 'per_gpu_hour' || u.unit === 'per_machine_hour') a.gpu_hours += u.quantity;
    if (u.unit === 'per_gb_hour') a.storage_gb_hours += u.quantity;
    const prev = a.resources.get(u.resource_uuid);
    a.resources.set(u.resource_uuid, {
      uuid: u.resource_uuid,
      name: u.resource_name,
      amount: (prev?.amount ?? 0) + u.amount,
    });
  }
  const total = [...acc.values()].reduce((s, a) => s + a.amount, 0) || 1;
  return [...acc.entries()]
    .map(([key, a]) => ({
      key,
      label: labelOf(key, rows.find((r) => keyOf(r) === key) as UsageRow),
      kind: a.kind,
      amount: round2(a.amount),
      gpu_hours: round2(a.gpu_hours),
      storage_gb_hours: round2(a.storage_gb_hours),
      share: round2(a.amount / total),
      resources: [...a.resources.values()]
        .map((r) => ({ ...r, amount: round2(r.amount) }))
        .sort((x, y) => y.amount - x.amount),
    }))
    .sort((x, y) => y.amount - x.amount);
}

export const REGION_LABEL: Record<RegionCode, string> = {
  jp: '日本 JP',
  th: '泰国 TH',
  sg: '新加坡 SG',
  us: '美国 US',
};

export const KIND_LABEL: Record<ResourceKind, string> = {
  gpu_vm: 'GPU 云服务器',
  gpu_baremetal: 'GPU 裸金属',
  vgpu: 'vGPU',
  inference: '推理服务',
};

export function costSlices(
  dimension: CostDimension,
  filter: { region?: RegionCode; projectId?: InternalId | null } = {},
): CostSlice[] {
  let rows = USAGE_ROWS;
  if (filter.region) rows = rows.filter((u) => u.region === filter.region);
  if (filter.projectId) rows = rows.filter((u) => u.project_id === filter.projectId);
  if (dimension === 'project') {
    return sliceRows(rows, (u) => u.project_name, (k) => k);
  }
  if (dimension === 'resource') {
    return sliceRows(rows, (u) => u.resource_uuid, (_k, s) => s.resource_name);
  }
  if (dimension === 'region') {
    return sliceRows(
      rows,
      (u) => u.region,
      (k) => REGION_LABEL[k as RegionCode] ?? k,
    );
  }
  return sliceRows(
    rows,
    (u) => u.resource_kind,
    (k) => KIND_LABEL[k as ResourceKind] ?? k,
  );
}

/** 账期累计（本组织本月花费）—— 状态栏「本月花费」与成本页总额的真实来源 */
export function costMtd(): number {
  const from = startOfMonth();
  return round2(
    USAGE_ROWS.filter((u) => u.usage_hour >= from).reduce((a, b) => a + b.amount, 0),
  );
}

export function costToday(): number {
  const from = startOfToday();
  return round2(
    USAGE_ROWS.filter((u) => u.usage_hour >= from).reduce((a, b) => a + b.amount, 0),
  );
}

/** 按小时的成本趋势（成本页趋势图，形态来自真实用量聚合，非随机生成） */
export function costTrend(hours = 48): Array<{ ts: string; amount: number }> {
  const buckets = new Map<string, number>();
  for (const u of USAGE_ROWS) {
    const key = u.usage_hour;
    buckets.set(key, (buckets.get(key) ?? 0) + u.amount);
  }
  return [...buckets.entries()]
    .map(([ts, amount]) => ({ ts, amount: round2(amount) }))
    .sort((a, b) => (a.ts < b.ts ? -1 : 1))
    .slice(-hours);
}

// ─────────── 扣费流水（§7.8 ④：可追溯至 usage/invoice） ───────────
let txnSeq = 0;

/** 由用量行聚合出扣费流水：按天汇总一笔 charge + 期初充值一笔 credit */
export function buildTransactions(balance: number): BillingTransaction[] {
  const byDay = new Map<string, number>();
  for (const u of USAGE_ROWS) {
    const day = u.usage_hour.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + u.amount);
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const totalCharged = days.reduce((s, [, v]) => s + v, 0);
  const txns: BillingTransaction[] = [];
  // 期初充值：使 balance_after 链条自洽
  let running = balance + totalCharged;
  txns.push({
    id: (txnSeq += 1) as InternalId,
    org_id: 1 as InternalId,
    type: 'credit',
    amount: round2(balance + totalCharged),
    balance_after: round2(running),
    reference_type: 'recharge',
    reference_id: 'recharge-init',
    summary: '账户充值（信用额度注入）',
    created_at: `${days[0]?.[0] ?? new Date().toISOString().slice(0, 10)}T00:30:00Z`,
  });
  for (const [day, amount] of days) {
    running -= amount;
    txns.push({
      id: (txnSeq += 1) as InternalId,
      org_id: 1 as InternalId,
      type: 'charge',
      amount: round2(amount),
      balance_after: round2(running),
      reference_type: 'usage',
      reference_id: `usage-${day}`,
      summary: `${day} 用量扣费（逐小时聚合）`,
      created_at: `${day}T23:59:00Z`,
    });
  }
  return txns.reverse();
}

export let TRANSACTIONS: BillingTransaction[] = [];

export function rebuildTransactions(balance: number): void {
  TRANSACTIONS = buildTransactions(balance);
}

/** 组织级扣费流水（§7.8 ④：reference_type/reference_id 可追溯） */
export const transactionsOfResource = (): BillingTransaction[] =>
  TRANSACTIONS.filter((t) => t.reference_type === 'usage' || t.reference_type === 'recharge');

/** 区域系数取整展示（成本页「区域价差」说明用） */
export const regionMultiplierOf = (region: RegionCode): number =>
  REGION_MULTIPLIER[region];

// ─────────── 实时费用快照（PRD §7.8 ① ②） ───────────
export interface CostSnapshot {
  /** 计费单位（随类型变化：GPU·小时 / 台·小时 / 集群控制面） */
  unit: BillingUsage['unit'];
  /** 计费数量（GPU 数 / 台数 / 节点总卡数） */
  quantity: number;
  unit_price: number;
  /** vGPU 控制面 $/h（非 vGPU 为 0） */
  control_plane_per_hour: number;
  storage_per_month: number;
  storage_per_hour: number;
  /** 算力 $/h（stopped/provisioning 为 0） */
  compute_per_hour: number;
  per_hour: number;
  per_month: number;
  /** 余额可支撑小时数 */
  remaining_hours: number | null;
  /** 计量状态说明（§7.8：停止/供给中必须可见） */
  metering_note: string;
}

export function costSnapshotOf(
  r: Resource,
  creditBalance: number,
): CostSnapshot {
  const { unit, gpuEquivalent, rate } = billableUnitsOf(r);
  const cpRate = controlPlaneRateOf(r);
  const metering = meteringOf(r, Date.now());
  const computePerHour =
    metering.countsGpu ? round2(gpuEquivalent * rate + cpRate) : 0;
  const storagePerMonth = round2(
    (r.kind === 'gpu_baremetal' || r.kind === 'inference' ? 0 : r.storage_gb) *
      STORAGE_RATE_GB_MONTH,
  );
  const storagePerHour = metering.countsStorage
    ? round2(storagePerMonth / HOURS_PER_MONTH)
    : 0;
  const perHour = round2(computePerHour + storagePerHour);
  let note = '计量中：算力 + 存储';
  if (r.deleted_at) note = '已删除：计量已停止';
  else if (r.status === 'terminating') note = '释放中：计量立即停止';
  else if (r.status === 'provisioning') note = '供给中 · 尚未计费';
  else if (r.status === 'stopped') note = '算力停计中 · 仅计存储';
  else if (r.status === 'error') note = '异常态 · 算力停计，仅计存储';
  return {
    unit,
    quantity: gpuEquivalent,
    unit_price: rate,
    control_plane_per_hour: cpRate,
    storage_per_month: storagePerMonth,
    storage_per_hour: storagePerHour,
    compute_per_hour: computePerHour,
    per_hour: perHour,
    per_month: round2(perHour * HOURS_PER_MONTH),
    remaining_hours: perHour > 0 ? round2(creditBalance / perHour) : null,
    metering_note: note,
  };
}
