// 容量分布（真实的新算力铺开节奏，MOCK-DATA §5.4）
// 结论：GB300_NVL72 在 TH/JP/SG 应不可选（灰 + 申请配额）⇒ 状态栏「算力供给」真实依据。
import type { NodePoolCode, RegionCode } from '../../types/domain';

/** 池 → 可用区域（§5.4） */
export const POOL_REGIONS: Record<NodePoolCode, RegionCode[]> = {
  H100_SXM: ['us', 'jp', 'sg', 'th'],
  H200_NVL: ['us', 'jp', 'sg'],
  B200_NVL72: ['us', 'jp'],
  B300: ['us', 'sg'],
  GB300_NVL72: ['us'],
};

/** 区域 → 节点数 / 机柜数（§5.4） */
export const POOL_CAPACITY: Record<NodePoolCode, Record<string, number>> = {
  H100_SXM: { us: 512, jp: 256, sg: 192, th: 128 },
  H200_NVL: { us: 256, jp: 128, sg: 96 },
  B200_NVL72: { us: 24, jp: 8 }, // 按机柜售卖，最小单位 1 柜
  B300: { us: 64, sg: 32 },
  GB300_NVL72: { us: 12 }, // 旗舰，仅美国，需申请配额
};

/** 是否按机柜售卖（B200_NVL72 / GB300_NVL72） */
export const CABINET_POOLS: NodePoolCode[] = ['B200_NVL72', 'GB300_NVL72'];

/** 节点状态占比区间（§5.3，落实 G7「不完美即真实」） */
export const NODE_STATE_RATIO = {
  ready: [0.88, 0.94],
  cordoned: [0.02, 0.04],
  draining: [0.005, 0.02],
  remediation: [0.005, 0.02],
  notready: [0.01, 0.03],
} as const;

/** 供给时长与失败率（§5.1，必须按类型区分） */
export const PROVISION_PROFILE = {
  gpu_vm: { minSec: 45, maxSec: 95, failureRate: 0.03 },
  gpu_baremetal: { minSec: 8 * 60, maxSec: 20 * 60, failureRate: 0.05 },
  vgpu: { minSec: 3 * 60, maxSec: 7 * 60, failureRate: 0.04 },
  inference: { minSec: 60, maxSec: 12 * 60, failureRate: 0.06 },
} as const;

/** 供给子阶段（§5.1） */
export const PROVISION_SUBSTEPS = {
  gpu_vm: ['配额校验', '资源预留', '镜像拉取', '启动', '健康检查'],
  gpu_baremetal: [
    '硬件分配',
    'RAID 配置',
    '固件校验',
    'OS 灌装',
    'PXE',
    '带外纳管',
  ],
  vgpu: [
    '控制面创建',
    '节点注册',
    'GPU Operator 部署',
    '设备插件就绪',
    'CNI/CSI',
  ],
  inference: [
    '副本调度',
    '镜像拉取',
    '权重加载',
    'CUDA graph 捕获',
    '预热',
    '探活',
  ],
} as const;

/** 常见失败原因（§5.1，失败必须有具体原因） */
export const FAILURE_REASONS = [
  { code: 'InsufficientCapacity', text: '容量不足：该节点池当前区域无可分配 GPU' },
  { code: 'ImagePullBackOff', text: '镜像拉取超时：registry 不可达或镜像体积过大' },
  { code: 'ModelOOM', text: '权重加载 OOM：模型权重所需显存超过单卡可用显存' },
  { code: 'DriverVersionMismatch', text: '驱动不匹配：镜像 CUDA 版本与节点驱动不兼容' },
  { code: 'QUOTA_EXCEEDED', text: '配额不足：已用 GPU 超出组织配额上限' },
] as const;

/** 池在该区域是否可选（§5.4） */
export function isPoolAvailableIn(pool: NodePoolCode, region: RegionCode): boolean {
  return POOL_REGIONS[pool].includes(region);
}
