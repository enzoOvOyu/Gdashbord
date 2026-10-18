// 部署向导价格预估（PRD §4.2 末步"确认与价格预估"）
// 取价一律经 derive.ts §7.1 派生，禁止第二套口径（G2）。
import type { NodePoolCode, RegionCode, ResourceKind } from '../../types/domain';
import { GPU_SPECS, NODE_PLATFORM } from '../../mocks/fixtures/gpu-specs';
import {
  PUBLIC_IP_RATE_HOUR,
  VGPU_CONTROL_PLANE_RATE_CLUSTER_HOUR,
  HOURS_PER_MONTH,
  STORAGE_RATE_GB_MONTH,
  effectiveRatePerGpuHour,
} from '../../mocks/fixtures/pricing';
import { gpuHourlyCost, storageMonthlyCost } from '../../mocks/lib/derive';
import { nodePoolSchema, type resourceKindSchema } from './schemas';
import type { z } from 'zod';

export type PricingKind = z.infer<typeof resourceKindSchema>;

export interface PriceInput {
  kind: PricingKind;
  pool: NodePoolCode;
  region: RegionCode;
  gpu_count: number;
  storage_gb: number;
  /** gpu_vm 公网 IP */
  public_ip?: boolean;
  /** vgpu 节点数 */
  node_count?: number;
  /** inference 副本数 */
  replicas?: number;
}

export interface PriceLine {
  label: string;
  detail: string;
  hourly: number;
  monthly: number;
}

export interface PriceEstimate {
  /** 单价 $/GPU·小时（区域已生效） */
  unitRate: number;
  lines: PriceLine[];
  hourly: number;
  monthly: number;
  /** GPU 小时总量，用于 UOM 展示 */
  gpuHours: number;
}

const controlPlaneHa = VGPU_CONTROL_PLANE_RATE_CLUSTER_HOUR * 3;

/**
 * 各 kind 计费口径（PRD §7.1 / §4.3.4）：
 *  gpu_vm        = GPU×卡 + 块存储 + 公网IP
 *  gpu_baremetal = GPU×卡（直通全卡；本地 NVMe 随机型不另计）
 *  vgpu          = 节点数×GPU×卡 + 控制面（HA×3）+ 块存储
 *  inference     = 副本×GPU×卡（按 GPU·小时，不按调用量/令牌计费）
 */
export function estimatePrice(i: PriceInput): PriceEstimate {
  const unitRate = effectiveRatePerGpuHour(i.pool, i.region);
  const lines: PriceLine[] = [];

  const gpuHours =
    i.kind === 'vgpu'
      ? (i.node_count ?? 1) * i.gpu_count
      : i.kind === 'inference'
        ? (i.replicas ?? 1) * i.gpu_count
        : i.gpu_count;

  // 算力（running 才计； wizard 预估按 running 口径给出）
  const compute = gpuHourlyCost({
    pool: i.pool,
    region: i.region,
    gpu_count: gpuHours,
    storage_gb: i.storage_gb,
    status: 'running',
  });
  lines.push({
    label: '算力（GPU·小时）',
    detail: `${gpuHours} GPU × ${formatUsdSimple(unitRate)}/GPU·h`,
    hourly: compute,
    monthly: rmul(compute, HOURS_PER_MONTH),
  });

  // 块存储（跟随实例，停止后仍计 —— PRD §7.4）
  if (i.kind === 'gpu_vm' || i.kind === 'vgpu') {
    const monthly = storageMonthlyCost(i.storage_gb);
    const hourly = rdiv(monthly, HOURS_PER_MONTH);
    lines.push({
      label: '块存储',
      detail: `${i.storage_gb} GB × ${STORAGE_RATE_GB_MONTH}/GB·月`,
      hourly,
      monthly,
    });
  }

  // vGPU 托管控制面（HA ×3）
  if (i.kind === 'vgpu') {
    lines.push({
      label: '托管控制面（HA ×3）',
      detail: `Kubernetes 托管面 ${VGPU_CONTROL_PLANE_RATE_CLUSTER_HOUR} × 3`,
      hourly: controlPlaneHa,
      monthly: rmul(controlPlaneHa, HOURS_PER_MONTH),
    });
  }

  // gpu_vm 公网 IP
  if (i.kind === 'gpu_vm' && i.public_ip) {
    lines.push({
      label: '公网 IP',
      detail: `${PUBLIC_IP_RATE_HOUR}/小时`,
      hourly: PUBLIC_IP_RATE_HOUR,
      monthly: rmul(PUBLIC_IP_RATE_HOUR, HOURS_PER_MONTH),
    });
  }

  return {
    unitRate,
    lines,
    hourly: round2(lines.reduce((a, b) => a + b.hourly, 0)),
    monthly: round2(lines.reduce((a, b) => a + b.monthly, 0)),
    gpuHours,
  };
}

/** vGPU 切片策略候选：由 GPU_SPECS.migInstances 派生，并附 Time-Slicing（单一来源） */
export function slicingPolicies(pool: NodePoolCode): Array<{ value: string; label: string }> {
  return [
    { value: 'none', label: '整卡直通（无切片）' },
    { value: 'mig', label: `MIG 切片（${GPU_SPECS[pool].migInstances}）` },
    { value: 'time-slicing', label: 'Time-Slicing（时分复用）' },
  ];
}

/** 机型选项（裸金属 §4.2）：由 GPU_SPECS + NODE_PLATFORM 派生 */
export function machineTypes(): Array<{ value: string; label: string; detail: string }> {
  return nodePoolSchema.options.map((code) => ({
    value: code,
    label: `${GPU_SPECS[code].productName} 服务器`,
    detail: `${NODE_PLATFORM[code].cpu} · ${NODE_PLATFORM[code].localNvme} · ${NODE_PLATFORM[code].network}`,
  }));
}

/** 单 CPU/内存上限按机型换算（Form 默认值派生） */
export function platformOf(pool: NodePoolCode) {
  return NODE_PLATFORM[pool];
}

/** 该 kind 是否支持公网 IP / 存储 / 端口等项（用于条件渲染步骤） */
export const SUPPORTS: Record<
  ResourceKind,
  { image: boolean; model: boolean; ports: boolean; storage: boolean; publicIp: boolean; replicas: boolean }
> = {
  gpu_vm: { image: true, model: false, ports: true, storage: true, publicIp: true, replicas: false },
  gpu_baremetal: { image: true, model: false, ports: false, storage: false, publicIp: false, replicas: false },
  vgpu: { image: false, model: false, ports: false, storage: true, publicIp: false, replicas: false },
  inference: { image: false, model: true, ports: true, storage: false, publicIp: false, replicas: true },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
const rmul = (a: number, b: number): number => round2(a * b);
const rdiv = (a: number, b: number): number => round2(a / b);
function formatUsdSimple(n: number): string {
  return `$${n.toFixed(2)}`;
}
