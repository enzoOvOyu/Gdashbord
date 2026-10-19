// 四类向导的费用明细（PRD §4.2.5：逐项列出 + 计费方式切换即时重算）
// 取价一律来自 billing_rates（mocks/fixtures/pricing） × 区域系数 × 折扣，禁止硬编码。
import { t } from '../../../i18n';
import type { NodePoolCode, RegionCode } from '../../../types/domain';
import {
  HOURS_PER_MONTH,
  STORAGE_RATE_GB_MONTH,
  PUBLIC_IP_RATE_HOUR,
  effectiveRatePerGpuHour,
  effectiveRatePerMachineHour,
  effectiveRatePerClusterHour,
} from '../../../mocks/fixtures/pricing';

export interface PriceLine {
  label: string;
  detail: string;
  hourly: number;
  monthly: number;
  /** 是否随弹性规模变化（控制面 / 固定存储为 false，不参与保底峰值折算） */
  scales?: boolean;
}

/** 弹性规模档位（§4.2.6.3：开启弹性时展示保底 min / 峰值 max 双档月度预估） */
export interface ScalingBands {
  /** 当前规模（实例数 / 台数 / 节点数 / 副本数） */
  current: number;
  min: number;
  max: number;
}

export interface PriceEstimate {
  lines: PriceLine[];
  hourly: number;
  monthly: number;
  /** 保底（min 档）月度预估；未开启弹性时为 null */
  floorMonthly: number | null;
  /** 峰值（max 档）月度预估；未开启弹性时为 null */
  peakMonthly: number | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const DISCOUNT_OPTIONS = [
  { value: 'on_demand', get label() { return t('price.payg'); } },
  { value: 'spot', get label() { return t('price.spot'); } },
  { value: 'reserved_1y', get label() { return t('price.ri1y'); } },
  { value: 'reserved_3y', get label() { return t('price.ri3y'); } },
] as const;

export type DiscountKey = (typeof DISCOUNT_OPTIONS)[number]['value'];

export const DISCOUNT_FACTOR: Record<DiscountKey, number> = {
  on_demand: 1,
  spot: 0.48,
  reserved_1y: 0.7,
  reserved_3y: 0.45,
};

const storageHourly = (gb: number): number =>
  round2((gb * STORAGE_RATE_GB_MONTH) / HOURS_PER_MONTH);

function finalize(
  lines: PriceLine[],
  factor: number,
  bands?: ScalingBands | null,
): PriceEstimate {
  const scaled = lines.map((l) => ({
    ...l,
    hourly: round2(l.hourly * factor),
    monthly: round2(l.monthly * factor),
  }));
  const hourly = round2(scaled.reduce((a, b) => a + b.hourly, 0));
  const monthly = round2(scaled.reduce((a, b) => a + b.monthly, 0));
  // 保底 / 峰值双档：仅"随规模变化"的明细行按档位折算，固定项（控制面/存储）不缩放
  if (!bands || bands.current <= 0) {
    return { lines: scaled, hourly, monthly, floorMonthly: null, peakMonthly: null };
  }
  const scalable = scaled.filter((l) => l.scales).reduce((a, b) => a + b.monthly, 0);
  const fixed = round2(monthly - scalable);
  const unit = scalable / bands.current;
  return {
    lines: scaled,
    hourly,
    monthly,
    floorMonthly: round2(fixed + unit * bands.min),
    peakMonthly: round2(fixed + unit * bands.max),
  };
}

/** ① GPU 云服务器：GPU·小时 + 系统盘 + 数据盘 + 公网 IP */
export function estimateVm(i: {
  pool: NodePoolCode;
  region: RegionCode;
  gpuCount: number;
  systemDiskGb: number;
  dataDiskGb: number;
  publicIp: boolean;
  bandwidthMbps: number;
  quantity: number;
  discount: DiscountKey;
  /** v0.7 弹性伸缩档位（实例数维度） */
  scaling?: ScalingBands | null;
}): PriceEstimate {
  const rate = effectiveRatePerGpuHour(i.pool, i.region);
  const compute = round2(rate * i.gpuCount * i.quantity);
  const totalDisk = i.systemDiskGb + i.dataDiskGb;
  const lines: PriceLine[] = [
    {
      label: t('price.compute'),
      detail: t('price.computeLine', { v0: i.gpuCount, v1: rate.toFixed(2), v2: i.quantity }),
      hourly: compute,
      monthly: round2(compute * HOURS_PER_MONTH),
      scales: true,
    },
  ];
  if (totalDisk > 0) {
    const s = storageHourly(totalDisk) * i.quantity;
    lines.push({
      label: t('quotas.blockStorage'),
      detail: t('price.storageLine', { v0: totalDisk, v1: STORAGE_RATE_GB_MONTH, v2: i.quantity }),
      hourly: s,
      monthly: round2(totalDisk * STORAGE_RATE_GB_MONTH * i.quantity),
      scales: true,
    });
  }
  if (i.publicIp) {
    const ip = round2(PUBLIC_IP_RATE_HOUR * i.quantity);
    lines.push({
      label: t('price.publicIp'),
      detail: `${i.bandwidthMbps} Mbps × ${i.quantity}`,
      hourly: ip,
      monthly: round2(ip * HOURS_PER_MONTH),
      scales: true,
    });
  }
  return finalize(lines, DISCOUNT_FACTOR[i.discount], i.scaling);
}

/** ② GPU 裸金属：台·小时（数量语义 = 台数，禁止按卡折算） */
export function estimateBareMetal(i: {
  pool: NodePoolCode;
  region: RegionCode;
  machineCount: number;
  gpusPerNode: number;
  discount: DiscountKey;
  /** v0.7 弹性伸缩档位（台数维度，§4.2.6.2 冷启动 5–30min） */
  scaling?: ScalingBands | null;
}): PriceEstimate {
  const machineRate = effectiveRatePerMachineHour(i.pool, i.region);
  const hourly = round2(machineRate * i.machineCount);
  const lines: PriceLine[] = [
    {
      label: t('price.machine'),
      detail: t('price.machineLine', { v0: i.machineCount, v1: machineRate.toFixed(2), v2: i.gpusPerNode }),
      hourly,
      monthly: round2(hourly * HOURS_PER_MONTH),
      scales: true,
    },
  ];
  return finalize(lines, DISCOUNT_FACTOR[i.discount], i.scaling);
}

/** ③ vGPU：控制面 + 各节点池 GPU·小时 + 存储 */
export function estimateVgpu(i: {
  region: RegionCode;
  ha: boolean;
  pools: Array<{ node_pool: NodePoolCode; node_count: number; gpusPerNode: number }>;
  pvcGb: number;
  discount: DiscountKey;
  /** v0.7 弹性伸缩档位（节点数维度，各池 min/max 之和） */
  scaling?: ScalingBands | null;
}): PriceEstimate {
  const cp = effectiveRatePerClusterHour(i.region, i.ha);
  const lines: PriceLine[] = [
    {
      label: t('price.controlPlane'),
      detail: i.ha ? t('price.ha3') : t('price.std1'),
      hourly: cp,
      monthly: round2(cp * HOURS_PER_MONTH),
      // 控制面常驻，不随节点数变化
      scales: false,
    },
  ];
  for (const p of i.pools) {
    const rate = effectiveRatePerGpuHour(p.node_pool, i.region);
    const cards = p.node_count * p.gpusPerNode;
    const h = round2(rate * cards);
    lines.push({
      label: t('price.gpuNode', { v0: p.node_pool }),
      detail: t('price.gpuNodeLine', { v0: p.node_count, v1: p.gpusPerNode, v2: rate.toFixed(2) }),
      hourly: h,
      monthly: round2(h * HOURS_PER_MONTH),
      scales: true,
    });
  }
  if (i.pvcGb > 0) {
    const s = storageHourly(i.pvcGb);
    lines.push({
      label: t('price.extraStorage'),
      detail: t('price.storageLine2', { v0: i.pvcGb, v1: STORAGE_RATE_GB_MONTH }),
      hourly: s,
      monthly: round2(i.pvcGb * STORAGE_RATE_GB_MONTH),
      scales: false,
    });
  }
  return finalize(lines, DISCOUNT_FACTOR[i.discount], i.scaling);
}

/** ④ 推理服务：副本数 × 单副本 GPU × GPU·小时（v1 不按调用量计费） */
export function estimateInference(i: {
  pool: NodePoolCode;
  region: RegionCode;
  replicas: number;
  gpuPerReplica: number;
  discount: DiscountKey;
  /** v0.7 弹性伸缩档位（副本数维度；min 可为 0 当 scale_to_zero） */
  scaling?: ScalingBands | null;
}): PriceEstimate {
  const rate = effectiveRatePerGpuHour(i.pool, i.region);
  const cards = i.replicas * i.gpuPerReplica;
  const h = round2(rate * cards);
  const lines: PriceLine[] = [
    {
      label: t('price.compute'),
      detail: t('price.infLine', { v0: i.replicas, v1: i.gpuPerReplica, v2: rate.toFixed(2) }),
      hourly: h,
      monthly: round2(h * HOURS_PER_MONTH),
      scales: true,
    },
  ];
  return finalize(lines, DISCOUNT_FACTOR[i.discount], i.scaling);
}

