// GPU 硬件基线（唯一口径来源：MOCK-DATA §3.1 / §3.2）
// 口径声明（§3.1 注）：B200/B300 FP8 dense 取 NVIDIA DGX 口径（每卡 4.5 PFLOPS dense）；
// FP4 dense 取 DGX B200 72 PFLOPS / DGX B300 108 PFLOPS 每 8 卡 ⇒ 9 / 13.5 PFLOPS 每卡。
// 全文统一采用此口径，禁止混用第三方估算值。
// B200_NVL72 展示名按 §3.1 注写作「B200 NVL72（GB200 机柜）」以免误解。
import type { NodePoolCode } from '../../types/domain';

export interface GpuSpec {
  code: NodePoolCode;
  productName: string;
  architecture: string;
  /** GPU / 节点（GB300 为机柜级 72 GPU 单一 NVLink 域） */
  gpusPerNode: number;
  /** 显存 / GPU（GB） */
  vramGb: number;
  /** 显存带宽 / GPU（TB/s） */
  memoryBandwidthTbs: number;
  bf16DenseTflops: number;
  fp8DenseTflops: number;
  /** 不支持为 null */
  fp4DenseTflops: number | null;
  fp64DenseTflops: number;
  nvlink: string;
  /** TDP / GPU（W） */
  tdpW: number;
  /** 节点功耗（kW；GB300 为机柜级） */
  nodePowerKw: number;
  migInstances: string;
  cooling: 'air' | 'liquid';
}

export const GPU_SPECS: Record<NodePoolCode, GpuSpec> = {
  H100_SXM: {
    code: 'H100_SXM',
    productName: 'H100 SXM5',
    architecture: 'Hopper (TSMC 4N)',
    gpusPerNode: 8,
    vramGb: 80,
    memoryBandwidthTbs: 3.35,
    bf16DenseTflops: 989,
    fp8DenseTflops: 1979,
    fp4DenseTflops: null,
    fp64DenseTflops: 34,
    nvlink: 'Gen4 · 900 GB/s（双向/GPU）',
    tdpW: 700,
    nodePowerKw: 10.2,
    migInstances: '7 × 10 GB',
    cooling: 'air',
  },
  H200_NVL: {
    code: 'H200_NVL',
    productName: 'H200 SXM',
    architecture: 'Hopper (TSMC 4N)',
    gpusPerNode: 8,
    vramGb: 141,
    memoryBandwidthTbs: 4.8,
    bf16DenseTflops: 989,
    fp8DenseTflops: 1979,
    fp4DenseTflops: null,
    fp64DenseTflops: 34,
    nvlink: 'Gen4 · 900 GB/s',
    tdpW: 700,
    nodePowerKw: 10.2,
    migInstances: '7 × 20 GB',
    cooling: 'air',
  },
  B200_NVL72: {
    code: 'B200_NVL72',
    productName: 'B200（GB200 NVL72 节点）',
    architecture: 'Blackwell (TSMC 4NP)',
    gpusPerNode: 8,
    vramGb: 192,
    memoryBandwidthTbs: 8,
    bf16DenseTflops: 2250,
    fp8DenseTflops: 4500,
    fp4DenseTflops: 9000,
    fp64DenseTflops: 40,
    nvlink: 'Gen5 · 1.8 TB/s',
    tdpW: 1000,
    nodePowerKw: 14.3,
    migInstances: '7 × 24 GB',
    cooling: 'liquid',
  },
  B300: {
    code: 'B300',
    productName: 'B300 SXM',
    architecture: 'Blackwell Ultra',
    gpusPerNode: 8,
    vramGb: 288,
    memoryBandwidthTbs: 8,
    bf16DenseTflops: 2250,
    fp8DenseTflops: 4500,
    fp4DenseTflops: 13500,
    fp64DenseTflops: 1.4,
    nvlink: 'Gen5 · 1.8 TB/s',
    tdpW: 1400,
    nodePowerKw: 14.5,
    migInstances: '7 × 34 GB',
    cooling: 'liquid',
  },
  GB300_NVL72: {
    code: 'GB300_NVL72',
    productName: 'GB300 NVL72 机柜',
    architecture: 'Blackwell Ultra',
    gpusPerNode: 72,
    vramGb: 288,
    memoryBandwidthTbs: 8,
    bf16DenseTflops: 2250,
    fp8DenseTflops: 4500,
    fp4DenseTflops: 13500,
    fp64DenseTflops: 1.4,
    nvlink: 'Gen5 · 全域 130 TB/s',
    tdpW: 1400,
    nodePowerKw: 132,
    migInstances: '7 × 34 GB',
    cooling: 'liquid',
  },
};

/** 节点 / 服务器配套规格（§3.2，用于裸金属与云服务器实例规格派生） */
export interface NodePlatformSpec {
  cpu: string;
  systemMemoryGb: number;
  localNvme: string;
  network: string;
}
export const NODE_PLATFORM: Record<NodePoolCode, NodePlatformSpec> = {
  H100_SXM: {
    cpu: '2 × Xeon Platinum 8480（56C/112T）',
    systemMemoryGb: 2048,
    localNvme: '8 × 3.84 TB',
    network: '8 × 400 Gb/s NDR IB（总 400 GB/s）',
  },
  H200_NVL: {
    cpu: '2 × Xeon Platinum 8568Y+（48C/96T）',
    systemMemoryGb: 2048,
    localNvme: '8 × 3.84 TB',
    network: '8 × 400 Gb/s NDR IB',
  },
  B200_NVL72: {
    cpu: '2 × Xeon Platinum 8570（56C）+ Grace 管理通道',
    systemMemoryGb: 2252,
    localNvme: '8 × 3.84 TB',
    network: '8 × 400 Gb/s NDR IB + Spectrum-X',
  },
  B300: {
    cpu: '2 × Xeon Platinum 8580（60C）',
    systemMemoryGb: 2252,
    localNvme: '8 × 3.84 TB',
    network: '8 × ConnectX-8 800 Gb/s（总 800 GB/s）',
  },
  GB300_NVL72: {
    cpu: '36 × Grace CPU（72C）',
    systemMemoryGb: 17 * 1024,
    localNvme: '柜级 NVMe 层',
    network: 'NVLink 域 + 800 Gb/s 上联',
  },
};

// ─────────── 派生余量（§3.3 must derive） ───────────
/** 节点总显存 = GPU/节点 × 显存/GPU */
export const nodeTotalVramGb = (code: NodePoolCode): number =>
  GPU_SPECS[code].gpusPerNode * GPU_SPECS[code].vramGb;
/** 节点 peak BF16 = GPU 数 × BF16 dense（TFLOPS） */
export const nodePeakBf16Tflops = (code: NodePoolCode): number =>
  GPU_SPECS[code].gpusPerNode * GPU_SPECS[code].bf16DenseTflops;
/** 节点 idle 功耗（W）= GPU 数 × 80 W（60–100 中值）+ 系统基线 400 W（§3.3） */
export const nodeIdlePowerW = (code: NodePoolCode): number =>
  GPU_SPECS[code].gpusPerNode * 80 + 400;

export const gpuSpec = (code: NodePoolCode): GpuSpec => GPU_SPECS[code];

/**
 * 固件与驱动基线（§3.2 扩展，用于裸金属「固件与驱动」Tab）。
 * 展示口径：驱动版本需 ≥ 镜像 CUDA 版本要求，不合规需高亮（Vast.ai 卡片信息）。
 */
export const FIRMWARE_BASELINE: Record<
  NodePoolCode,
  { vbios: string; driverVersion: string; cudaVersion: string; bmcFirmware: string }
> = {
  H100_SXM: { vbios: '96.00.7E.00.1F', driverVersion: '560.35.03', cudaVersion: '12.6', bmcFirmware: '2.14' },
  H200_NVL: { vbios: '96.00.9B.00.0A', driverVersion: '560.35.03', cudaVersion: '12.6', bmcFirmware: '2.14' },
  B200_NVL72: { vbios: '97.00.4A.00.16', driverVersion: '570.86.15', cudaVersion: '12.8', bmcFirmware: '3.02' },
  B300: { vbios: '97.00.5C.00.02', driverVersion: '570.86.15', cudaVersion: '12.8', bmcFirmware: '3.02' },
  GB300_NVL72: { vbios: '98.00.1A.00.04', driverVersion: '575.51.03', cudaVersion: '12.9', bmcFirmware: '3.10' },
};

export const firmwareOf = (code: NodePoolCode) => FIRMWARE_BASELINE[code];
