// 四类向导的费用明细（PRD §4.2.5：逐项列出 + 计费方式切换即时重算）
// 取价一律来自 billing_rates（mocks/fixtures/pricing） × 区域系数 × 折扣，禁止硬编码。
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
}

export interface PriceEstimate {
  lines: PriceLine[];
  hourly: number;
  monthly: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const DISCOUNT_OPTIONS = [
  { value: 'on_demand', label: '按需' },
  { value: 'spot', label: '抢占式(−52%)' },
  { value: 'reserved_1y', label: '预留 1 年(−30%)' },
  { value: 'reserved_3y', label: '预留 3 年(−55%)' },
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

function finalize(lines: PriceLine[], factor: number): PriceEstimate {
  const scaled = lines.map((l) => ({
    ...l,
    hourly: round2(l.hourly * factor),
    monthly: round2(l.monthly * factor),
  }));
  return {
    lines: scaled,
    hourly: round2(scaled.reduce((a, b) => a + b.hourly, 0)),
    monthly: round2(scaled.reduce((a, b) => a + b.monthly, 0)),
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
}): PriceEstimate {
  const rate = effectiveRatePerGpuHour(i.pool, i.region);
  const compute = round2(rate * i.gpuCount * i.quantity);
  const totalDisk = i.systemDiskGb + i.dataDiskGb;
  const lines: PriceLine[] = [
    {
      label: '计算（GPU·小时）',
      detail: `${i.gpuCount} GPU × ${rate.toFixed(2)}/GPU·时 × ${i.quantity} 实例`,
      hourly: compute,
      monthly: round2(compute * HOURS_PER_MONTH),
    },
  ];
  if (totalDisk > 0) {
    const s = storageHourly(totalDisk) * i.quantity;
    lines.push({
      label: '块存储',
      detail: `${totalDisk} GB × ${STORAGE_RATE_GB_MONTH}/GB·月 × ${i.quantity}`,
      hourly: s,
      monthly: round2(totalDisk * STORAGE_RATE_GB_MONTH * i.quantity),
    });
  }
  if (i.publicIp) {
    const ip = round2(PUBLIC_IP_RATE_HOUR * i.quantity);
    lines.push({
      label: '公网 IP',
      detail: `${i.bandwidthMbps} Mbps × ${i.quantity}`,
      hourly: ip,
      monthly: round2(ip * HOURS_PER_MONTH),
    });
  }
  return finalize(lines, DISCOUNT_FACTOR[i.discount]);
}

/** ② GPU 裸金属：台·小时（数量语义 = 台数，禁止按卡折算） */
export function estimateBareMetal(i: {
  pool: NodePoolCode;
  region: RegionCode;
  machineCount: number;
  gpusPerNode: number;
  discount: DiscountKey;
}): PriceEstimate {
  const machineRate = effectiveRatePerMachineHour(i.pool, i.region);
  const hourly = round2(machineRate * i.machineCount);
  const lines: PriceLine[] = [
    {
      label: '机器（整机）',
      detail: `${i.machineCount} 台 × ${machineRate.toFixed(2)}/台·时（每台 ${i.gpusPerNode} 卡）`,
      hourly,
      monthly: round2(hourly * HOURS_PER_MONTH),
    },
  ];
  return finalize(lines, DISCOUNT_FACTOR[i.discount]);
}

/** ③ vGPU：控制面 + 各节点池 GPU·小时 + 存储 */
export function estimateVgpu(i: {
  region: RegionCode;
  ha: boolean;
  pools: Array<{ node_pool: NodePoolCode; node_count: number; gpusPerNode: number }>;
  pvcGb: number;
  discount: DiscountKey;
}): PriceEstimate {
  const cp = effectiveRatePerClusterHour(i.region, i.ha);
  const lines: PriceLine[] = [
    {
      label: '托管控制面',
      detail: i.ha ? 'HA ×3 副本' : 'Standard 单副本',
      hourly: cp,
      monthly: round2(cp * HOURS_PER_MONTH),
    },
  ];
  for (const p of i.pools) {
    const rate = effectiveRatePerGpuHour(p.node_pool, i.region);
    const cards = p.node_count * p.gpusPerNode;
    const h = round2(rate * cards);
    lines.push({
      label: `GPU 节点 · ${p.node_pool}`,
      detail: `${p.node_count} 节点 × ${p.gpusPerNode} 卡 × ${rate.toFixed(2)}/卡·时`,
      hourly: h,
      monthly: round2(h * HOURS_PER_MONTH),
    });
  }
  if (i.pvcGb > 0) {
    const s = storageHourly(i.pvcGb);
    lines.push({
      label: '附加存储',
      detail: `${i.pvcGb} GB × ${STORAGE_RATE_GB_MONTH}/GB·月`,
      hourly: s,
      monthly: round2(i.pvcGb * STORAGE_RATE_GB_MONTH),
    });
  }
  return finalize(lines, DISCOUNT_FACTOR[i.discount]);
}

/** ④ 推理服务：副本数 × 单副本 GPU × GPU·小时（v1 不按调用量计费） */
export function estimateInference(i: {
  pool: NodePoolCode;
  region: RegionCode;
  replicas: number;
  gpuPerReplica: number;
  discount: DiscountKey;
}): PriceEstimate {
  const rate = effectiveRatePerGpuHour(i.pool, i.region);
  const cards = i.replicas * i.gpuPerReplica;
  const h = round2(rate * cards);
  const lines: PriceLine[] = [
    {
      label: '计算（GPU·小时）',
      detail: `${i.replicas} 副本 × ${i.gpuPerReplica} GPU × ${rate.toFixed(2)}/GPU·时`,
      hourly: h,
      monthly: round2(h * HOURS_PER_MONTH),
    },
  ];
  return finalize(lines, DISCOUNT_FACTOR[i.discount]);
}

