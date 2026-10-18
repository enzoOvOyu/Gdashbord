// 价格、区域系数与计费参数（唯一口径：MOCK-DATA §4）
// 所有金额派生必须走 lib/derive.ts，禁止在 UI 硬编码（§7.1 / G2）
import type { NodePoolCode, RegionCode } from '../../types/domain';

/** 按需单价（USD / GPU·小时），§4.1 本平台单价 */
export const BASE_RATE_PER_GPU_HOUR: Record<NodePoolCode, number> = {
  H100_SXM: 3.49,
  H200_NVL: 4.79,
  B200_NVL72: 7.49,
  B300: 8.49,
  GB300_NVL72: 10.99,
};

/**
 * 裸金属整机单价（USD / 台·小时）—— MOCK-DATA §7.1 base_machine_rate。
 * 必须独立成表：整机价格由机型定义，禁止在 UI 里用 `rate × 8` 现算（PRD §4.2.2）。
 */
export const BASE_RATE_PER_MACHINE_HOUR: Record<NodePoolCode, number> = {
  H100_SXM: 27.92,
  H200_NVL: 38.32,
  B200_NVL72: 59.92,
  B300: 67.92,
  GB300_NVL72: 87.92,
};

/** 市场观察区间（§4.1），用于比价视图展示区间条 */
export const MARKET_RATE_RANGE: Record<NodePoolCode, [number, number]> = {
  H100_SXM: [2.69, 6.16],
  H200_NVL: [3.59, 6.31],
  B200_NVL72: [6.69, 8.6],
  B300: [7.89, 9.5],
  GB300_NVL72: [10.5, 10.5],
};

/** 区域系数（§4.2）——必须同时作用于 billing_rates，不得只在 UI 乘一次 */
export const REGION_MULTIPLIER: Record<RegionCode, number> = {
  us: 1.0,
  sg: 1.08,
  jp: 1.12,
  th: 0.95,
};

/** 存储与其他单价（§4.3） */
export const STORAGE_RATE_GB_MONTH = 0.08; // 块存储（跟随实例），停止后仍计
export const OBJECT_STORAGE_RATE_GB_MONTH = 0.023;
export const EGRESS_RATE_GB = 0.05;
export const CROSS_REGION_EGRESS_RATE_GB = 0.03;
export const PUBLIC_IP_RATE_HOUR = 0.005;
export const VGPU_CONTROL_PLANE_RATE_CLUSTER_HOUR = 0.1; // HA ×3 = 0.30

/** 折扣系数（§4.4）——cost_per_hour 不得恒等于 rate × qty */
export const DISCOUNT_FACTOR = {
  on_demand: 1.0,
  /** Spot / 抢占式 −45% ~ −60% ⇒ 系数 0.40–0.55 */
  spot: 0.48,
  reserved_1y: 0.7,
  reserved_3y: 0.45,
} as const;
export type DiscountTier = keyof typeof DISCOUNT_FACTOR;

/** 一月小时数（365×24/12），全文统一（§7.1） */
export const HOURS_PER_MONTH = 730;

/**
 * 有效单价 = 基准单价 × 区域系数（§4.2），展示保留 2 位小数。
 * 注：区域系数必须作用于 billing_rates，此处为 Mock 期唯一取价入口。
 */
export function effectiveRatePerGpuHour(
  pool: NodePoolCode,
  region: RegionCode,
): number {
  return round2(BASE_RATE_PER_GPU_HOUR[pool] * REGION_MULTIPLIER[region]);
}

/** 裸金属有效整机单价 = 整机基准价 × 区域系数（§4.2） */
export function effectiveRatePerMachineHour(
  pool: NodePoolCode,
  region: RegionCode,
): number {
  return round2(BASE_RATE_PER_MACHINE_HOUR[pool] * REGION_MULTIPLIER[region]);
}

/** vGPU 托管控制面有效单价 = 0.10 × 区域系数（HA 时 ×3） */
export function effectiveRatePerClusterHour(
  region: RegionCode,
  ha: boolean,
): number {
  return round2(
    VGPU_CONTROL_PLANE_RATE_CLUSTER_HOUR * (ha ? 3 : 1) * REGION_MULTIPLIER[region],
  );
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
