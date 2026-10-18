// 派生公式引擎（MOCK-DATA §7）——凡是能算出的量禁止硬编码（G2）
// 每个公式对应一个纯函数，输入输出有类型；基础常量由 fixtures 提供，派生集中于此。
// VITE_ENABLE_MOCK=false 时本模块不得被调用（§11：派生责任移交后端）。
import type { NodePoolCode, RegionCode, ResourceKind } from '../../types/domain';
import { GPU_SPECS, nodeIdlePowerW, nodePeakBf16Tflops } from '../fixtures/gpu-specs';
import {
  DISCOUNT_FACTOR,
  HOURS_PER_MONTH,
  STORAGE_RATE_GB_MONTH,
  effectiveRatePerGpuHour,
  type DiscountTier,
} from '../fixtures/pricing';

const round2 = (n: number): number => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

// ─────────── §7.1 资源费用派生 ───────────
export interface CostInput {
  pool: NodePoolCode;
  region: RegionCode;
  gpu_count: number;
  storage_gb: number;
  status: 'provisioning' | 'running' | 'stopped' | 'error' | 'terminating';
  discount?: DiscountTier;
}
export interface CostBreakdown {
  /** 算力费 $/h（仅 running 计，PRD §7.4） */
  gpu_hourly_cost: number;
  /** 存储费 $/月 */
  storage_monthly_cost: number;
  /** 运行成本 $/h = 算力 + 存储/730（running 与 stopped 均计存储） */
  running_cost_per_hour: number;
  /** 余额可支撑小时数 */
  remaining_hours: number | null;
}

/** gpu_hourly_cost = base_rate × region_multiplier × gpu_count × discount_factor */
export function gpuHourlyCost(i: CostInput): number {
  const discount = DISCOUNT_FACTOR[i.discount ?? 'on_demand'];
  return round2(
    effectiveRatePerGpuHour(i.pool, i.region) * i.gpu_count * discount,
  );
}

/** storage_monthly_cost = storage_gb × 0.08（§4.3） */
export function storageMonthlyCost(storageGb: number): number {
  return round2(storageGb * STORAGE_RATE_GB_MONTH);
}

/**
 * running_cost_per_hour = (running ? gpu_hourly : 0) + storage_monthly / 730
 * 计量触发点与生命周期严格挂钩（PRD §7.4）：
 *  provisioning 不计 / running 计算力+存储 / stopped 仅存储 / error 仅存储 / terminating 立即停计
 */
export function deriveCost(i: CostInput, creditBalance: number): CostBreakdown {
  const gpuHourly = gpuHourlyCost(i);
  const storageMonthly = storageMonthlyCost(i.storage_gb);
  const storageHourly = round2(storageMonthly / HOURS_PER_MONTH);
  const countsGpu = i.status === 'running';
  const countsStorage =
    i.status === 'running' || i.status === 'stopped' || i.status === 'error';
  const runningCostPerHour = round2(
    (countsGpu ? gpuHourly : 0) + (countsStorage ? storageHourly : 0),
  );
  const remainingHours =
    runningCostPerHour > 0 ? round2(creditBalance / runningCostPerHour) : null;
  return {
    gpu_hourly_cost: gpuHourly,
    storage_monthly_cost: storageMonthly,
    running_cost_per_hour: runningCostPerHour,
    remaining_hours: remainingHours,
  };
}

/** 不足整小时按实际秒数折算：quantity = gpu_count × seconds / 3600（PRD §7.4） */
export function proratedQuantity(
  gpuCount: number,
  seconds: number,
): number {
  return Math.round((gpuCount * seconds) / 3600 * 10000) / 10000;
}

// ─────────── §7.2 训练吞吐（6ND / 8ND） ───────────
/**
 * flops_per_token = 6 × params（无重计算） / 8 × params（全激活重计算，大模型默认）
 * tokens_per_second = mfu × peak_node_flops × node_count / flops_per_token
 * 校准锚点：LLaMA-65B on 2048 A100 = 771k tok/s ⇒ MFU ≈ 47%（公认合理）
 */
export function tokensPerSecond(i: {
  mfu: number;
  pool: NodePoolCode;
  nodeCount: number;
  paramsBillion: number;
  recompute?: boolean;
}): number {
  const flopsPerToken = (i.recompute ?? true ? 8 : 6) * i.paramsBillion * 1e9;
  const peakFlops = nodePeakBf16Tflops(i.pool) * 1e12;
  return Math.round((i.mfu * peakFlops * i.nodeCount) / flopsPerToken);
}

// ─────────── §7.3 推理 decode 上界（带宽受限） ───────────
export const BYTES_PER_PARAM = { bf16: 2, fp8: 1, fp4: 0.5, awq: 0.56 } as const;
export type Precision = keyof typeof BYTES_PER_PARAM;

/**
 * theoretical_max_tps ≈ hbm_bandwidth_gbs / weights_bytes × efficiency
 * efficiency = 0.5–0.8（batch 越大越高，上限受 KV cache 制约）
 * 70B FP8 decode 带宽受限：单张 H100 上界 ≈ 47 tok/s ⇒ 70B 必须多卡 TP（G8 红旗校验）
 */
export function decodeTpsUpperBound(i: {
  pool: NodePoolCode;
  paramsBillion: number;
  precision: Precision;
  gpusInTp: number;
  efficiency?: number;
}): number {
  const weightsBytes = i.paramsBillion * 1e9 * BYTES_PER_PARAM[i.precision];
  const bandwidthBytesPerSec = GPU_SPECS[i.pool].memoryBandwidthTbs * 1e12;
  const eff = i.efficiency ?? 0.65;
  // TP 切分后每卡持有一部分权重 ⇒ 单卡可读取带宽不变，权重读取量按 TP 分摊
  const perGpuWeights = weightsBytes / i.gpusInTp;
  return Math.round((bandwidthBytesPerSec / perGpuWeights) * eff);
}

/** 单卡可行性校验（G8：显存占用不得超过容量） */
export function fitsOnSingleGpu(i: {
  pool: NodePoolCode;
  paramsBillion: number;
  precision: Precision;
  gpusInTp: number;
  frameworkOverheadGb?: number;
}): boolean {
  const weightsGb =
    (i.paramsBillion * 1e9 * BYTES_PER_PARAM[i.precision]) / 1e9 / i.gpusInTp;
  const overhead = i.frameworkOverheadGb ?? 1.0; // CUDA context 0.5–1.5 GB（§7.6）
  return weightsGb + overhead <= GPU_SPECS[i.pool].vramGb * 0.95;
}

// ─────────── §7.4 KV cache 与加载时长 ───────────
/**
 * kv_bytes_per_token = 2 × layers × kv_heads × head_dim × bytes_per_kv
 * Llama-3.1-8B（32L / 8 kv-heads / head_dim 128 / BF16）⇒ 128 KiB/token
 */
export function kvBytesPerToken(i: {
  layers: number;
  kvHeads: number;
  headDim: number;
  bytesPerKv?: number;
}): number {
  return 2 * i.layers * i.kvHeads * i.headDim * (i.bytesPerKv ?? 2);
}
export function kvRequiredGb(i: {
  concurrency: number;
  avgContextTokens: number;
  layers: number;
  kvHeads: number;
  headDim: number;
}): number {
  const bytes = kvBytesPerToken(i);
  return round2((i.concurrency * i.avgContextTokens * bytes) / 1e9);
}
/** weights_load_sec = weights_gb × 1024 / disk_read_mb_s + 5（+5s 校验/初始化） */
export function weightsLoadSec(weightsGb: number, diskReadMbS: number): number {
  return Math.round((weightsGb * 1024) / diskReadMbS + 5);
}
/**
 * gpu_cache_usage_perc = kv_used_gb / kv_allocated_gb
 * kv_allocated = capacity - weights - activation_reserved(≥ 2 GB)
 * 一致性：kv_used ≤ kv_allocated ≤ total - weights（违反即 G8）
 */
export function kvAllocation(i: {
  pool: NodePoolCode;
  weightsGb: number;
  activationReservedGb?: number;
}): { kvAllocatedGb: number; capacityGb: number } {
  const capacityGb = GPU_SPECS[i.pool].vramGb;
  const reserved = Math.max(i.activationReservedGb ?? 2, 2);
  return {
    capacityGb,
    kvAllocatedGb: round2(Math.max(capacityGb - i.weightsGb - reserved, 0)),
  };
}

// ─────────── §7.5 straggler 判定 ───────────
export interface StragglerVerdict {
  ratio: number;
  flag: 'ok' | 'straggler' | 'severe';
  penalty: number;
}
/** ratio = p99/p50；≥1.2 straggler；≥1.5 severe；penalty = clamp(r-1,0,0.3) */
export function stragglerOf(stepTimeP50: number, stepTimeP99: number): StragglerVerdict {
  const ratio = Math.round((stepTimeP99 / stepTimeP50) * 100) / 100;
  const flag = ratio >= 1.5 ? 'severe' : ratio >= 1.2 ? 'straggler' : 'ok';
  return { ratio, flag, penalty: clamp(ratio - 1, 0, 0.3) };
}

/**
 * goodput = mfu_ratio × node_availability × (1 - restart_overhead) × (1 - straggler_penalty)
 * straggler_penalty = clamp(straggler_ratio - 1, 0, 0.3)（§6.6.2 MUST 可派生）
 * 返回 0–1 比值；健康集群 85–97%
 */
export function goodputOf(i: {
  mfu: number;
  nodeAvailability: number;
  restartOverhead: number;
  stragglerRatio: number;
}): number {
  const penalty = clamp(i.stragglerRatio - 1, 0, 0.3);
  return Math.round(
    i.mfu * i.nodeAvailability * (1 - i.restartOverhead) * (1 - penalty) * 100,
  ) / 100;
}

// ─────────── §7.6 显存占用分解 ───────────
/**
 * gpu_memory_used = weights + kv_cache + activations + fragmentation + framework_overhead
 * framework_overhead（PyTorch/CUDA context）0.5–1.5 GB，必须计入否则数字对不上
 */
export function memoryDecomposition(i: {
  weightsGb: number;
  kvCacheGb: number;
  activationsGb: number;
  fragmentationGb: number;
  frameworkOverheadGb?: number;
}): { total: number; parts: Record<string, number> } {
  const overhead = i.frameworkOverheadGb ?? 1.0;
  const parts = {
    weights: round2(i.weightsGb),
    kv_cache: round2(i.kvCacheGb),
    activations: round2(i.activationsGb),
    fragmentation: round2(i.fragmentationGb),
    framework_overhead: round2(overhead),
  };
  const total = round2(Object.values(parts).reduce((a, b) => a + b, 0));
  return { total, parts };
}

// ─────────── §7.7 推理容量规划（部署向导显存闸门，PRD §4.2.4） ───────────
export interface MemoryPlan {
  /** 单副本权重总量（GB，TP 切分前） */
  weightsGb: number;
  /** 单副本 KV cache 规划总量（GB，TP 切分前） */
  kvGb: number;
  /** 单卡激活预留（GB，≥2） */
  activationsGbPerGpu: number;
  /** 单卡框架开销（GB，CUDA context + 引擎运行时） */
  overheadGbPerGpu: number;
  /** 单卡所需显存 = (weights + kv) / tp + activation + overhead */
  requiredPerGpuGb: number;
  /** 单副本所需显存总量 */
  requiredTotalGb: number;
  /** 单卡可分配容量 = vram × 0.95 */
  capacityPerGpuGb: number;
  /** 单副本可用容量 = 卡数 × vram × 0.95 */
  capacityTotalGb: number;
  /** 满足容量所需的最小 TP 卡数 */
  minTp: number;
  fits: boolean;
  /** 单卡显存占用率（0–1+） */
  usageRatio: number;
  parts: Record<string, number>;
}

/**
 * 单副本显存规划：
 *   weights = params × bytes_per_param（§7.3）
 *   kv      = concurrency × avg_context × kv_bytes_per_token（§7.4）
 *   单卡    = (weights + kv) / tp + activations(≥2) + framework_overhead(≥1.5)
 * 阻断条件：单卡 > vram × 0.95（G8 红旗闸门）
 */
export function inferenceMemoryPlan(i: {
  pool: NodePoolCode;
  paramsBillion: number;
  precision: Precision;
  gpusInTp: number;
  concurrency: number;
  avgContextTokens: number;
  layers: number;
  kvHeads: number;
  headDim: number;
  activationsGb?: number;
  frameworkOverheadGb?: number;
}): MemoryPlan {
  const tp = Math.max(1, Math.round(i.gpusInTp));
  const vram = GPU_SPECS[i.pool].vramGb;
  const weightsGb = round2(i.paramsBillion * BYTES_PER_PARAM[i.precision]);
  const kvGb =
    i.layers > 0
      ? kvRequiredGb({
          concurrency: i.concurrency,
          avgContextTokens: i.avgContextTokens,
          layers: i.layers,
          kvHeads: i.kvHeads,
          headDim: i.headDim,
        })
      : 0;
  const activations = Math.max(i.activationsGb ?? 2, 2);
  const overhead = Math.max(i.frameworkOverheadGb ?? 1.5, 1.5);
  const perGpuShared = round2((weightsGb + kvGb) / tp);
  const requiredPerGpuGb = round2(perGpuShared + activations + overhead);
  const requiredTotalGb = round2(weightsGb + kvGb + (activations + overhead) * tp);
  const capacityPerGpuGb = round2(vram * 0.95);
  const capacityTotalGb = round2(capacityPerGpuGb * tp);
  // 反解最小 TP： (w+kv)/tp + a + o ≤ vram×0.95 ⇒ tp ≥ (w+kv)/(vram×0.95-a-o)
  const denom = capacityPerGpuGb - activations - overhead;
  const minTp =
    denom <= 0 ? 99 : Math.max(1, Math.ceil((weightsGb + kvGb) / denom));
  const usageRatio = Math.round((requiredPerGpuGb / capacityPerGpuGb) * 100) / 100;
  return {
    weightsGb,
    kvGb,
    activationsGbPerGpu: activations,
    overheadGbPerGpu: overhead,
    requiredPerGpuGb,
    requiredTotalGb,
    capacityPerGpuGb,
    capacityTotalGb,
    minTp,
    fits: requiredPerGpuGb <= capacityPerGpuGb,
    usageRatio,
    parts: {
      weights: round2(perGpuShared * (weightsGb / (weightsGb + kvGb || 1))),
      kv_cache: round2(perGpuShared * (kvGb / (weightsGb + kvGb || 1))),
      activations,
      framework_overhead: overhead,
    },
  };
}

// ─────────── 供给侧派生（§6.7 状态栏） ───────────
/** 算力紧张判据：available/total < 0.15（PRD §3.2） */
export function isCapacityTight(available: number, total: number): boolean {
  return total > 0 && available / total < 0.15;
}
/** 节点 idle 功耗（W），running 时 ≥ idle（§3.3 / G4） */
export const idlePowerW = nodeIdlePowerW;

/** 各资源类型的典型利用率形态（§6.2，用于生成曲线时选模板） */
export function utilizationBand(
  kind: ResourceKind,
): { min: number; max: number } {
  switch (kind) {
    case 'gpu_vm':
      return { min: 5, max: 60 }; // 开发/交互型锯齿脉冲
    case 'gpu_baremetal':
      return { min: 75, max: 98 }; // 训练型高台
    case 'vgpu':
      return { min: 40, max: 90 };
    case 'inference':
      return { min: 30, max: 85 }; // 推理
  }
}
