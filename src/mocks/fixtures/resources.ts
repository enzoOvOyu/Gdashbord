// 4 类资源种子 + 订单 / 供给步骤 / 落位 / 事件（ARCH §12.2 · PRD §5 · MOCK-DATA §5/§9）
// G5 确定性：同一 seed 连续两次加载得到完全一致的数据，禁止 Math.random 用于初始值。
import type {
  DisplayId,
  InternalId,
  NodePoolCode,
  ProvisioningStep,
  RegionCode,
  Resource,
  ResourceEvent,
  ResourceKind,
  ResourcePlacement,
  ResourceSpec,
  ResourceStatus,
  ResourceUuid,
  DeploymentOrder,
} from '../../types/domain';
import { KIND_META } from '../../lib/ids';
import { GPU_SPECS } from './gpu-specs';
import { intBetween, rngFor } from '../lib/rng';

const HOUR = 3600_000;
const now = Date.now();

interface Seed {
  kind: ResourceKind;
  name: string;
  region: RegionCode;
  pool: NodePoolCode;
  status: ResourceStatus;
  gpuCount: number;
  storageGb: number;
  ageHours: number;
  /** 用途标签，决定监控曲线形态（§8.2） */
  workload: string;
}

/** 14 个覆盖四类 × 五种生命周期状态的演示实例（PRD §5.4 闭环全覆盖） */
const SEEDS: Seed[] = [
  { kind: 'gpu_vm', name: 'llm-pretrain-01', region: 'jp', pool: 'H100_SXM', status: 'running', gpuCount: 8, storageGb: 1000, ageHours: 96, workload: '训练' },
  { kind: 'gpu_vm', name: 'notebook-dev-01', region: 'jp', pool: 'H100_SXM', status: 'running', gpuCount: 1, storageGb: 200, ageHours: 30, workload: '开发' },
  { kind: 'gpu_vm', name: 'eval-batch-02', region: 'sg', pool: 'H200_NVL', status: 'stopped', gpuCount: 4, storageGb: 500, ageHours: 240, workload: '批处理' },
  { kind: 'gpu_vm', name: 'new-server-03', region: 'us', pool: 'H100_SXM', status: 'provisioning', gpuCount: 2, storageGb: 300, ageHours: 0, workload: '待定' },
  { kind: 'gpu_baremetal', name: 'bm-b200-rack01', region: 'us', pool: 'B200_NVL72', status: 'running', gpuCount: 8, storageGb: 8000, ageHours: 720, workload: '训练' },
  { kind: 'gpu_baremetal', name: 'bm-h100-jp07', region: 'jp', pool: 'H100_SXM', status: 'running', gpuCount: 8, storageGb: 6000, ageHours: 480, workload: '训练' },
  { kind: 'gpu_baremetal', name: 'bm-b300-sg02', region: 'sg', pool: 'B300', status: 'error', gpuCount: 8, storageGb: 6000, ageHours: 12, workload: '训练' },
  { kind: 'vgpu', name: 'cks-inference-cluster', region: 'jp', pool: 'H100_SXM', status: 'running', gpuCount: 16, storageGb: 2000, ageHours: 336, workload: '托管K8s' },
  { kind: 'vgpu', name: 'cks-training-us', region: 'us', pool: 'H200_NVL', status: 'running', gpuCount: 32, storageGb: 4000, ageHours: 168, workload: '托管K8s' },
  { kind: 'vgpu', name: 'cks-new-sg', region: 'sg', pool: 'H100_SXM', status: 'provisioning', gpuCount: 8, storageGb: 1000, ageHours: 0, workload: '托管K8s' },
  { kind: 'inference', name: 'qwen-72b-prod', region: 'jp', pool: 'H100_SXM', status: 'running', gpuCount: 8, storageGb: 500, ageHours: 168, workload: '在线推理' },
  { kind: 'inference', name: 'llama-8b-chat', region: 'us', pool: 'H100_SXM', status: 'running', gpuCount: 1, storageGb: 200, ageHours: 72, workload: '在线推理' },
  { kind: 'inference', name: 'old-sdxl-svc', region: 'sg', pool: 'H200_NVL', status: 'terminating', gpuCount: 2, storageGb: 300, ageHours: 960, workload: '在线推理' },
  { kind: 'inference', name: 'deepseek-v3-canary', region: 'us', pool: 'B200_NVL72', status: 'error', gpuCount: 16, storageGb: 2000, ageHours: 6, workload: '在线推理' },
];

/** 稳定 UUID（由种子派生，保证可复现） */
function stableUuid(rand: () => number): string {
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i++) {
    s += i === 12 ? '4' : i === 16 ? hex[(Math.floor(rand() * 16) & 0x3) | 0x8] : hex[Math.floor(rand() * 16)];
    if (i === 7 || i === 11 || i === 15 || i === 19) s += '-';
  }
  return s;
}

function makeSpec(seed: Seed): ResourceSpec {
  const spec = GPU_SPECS[seed.pool];
  switch (seed.kind) {
    case 'gpu_vm':
      return {
        gpu_model: spec.productName,
        gpu_count: seed.gpuCount,
        vcpu: seed.gpuCount * 14,
        memory_gb: seed.gpuCount * 112,
        storage_gb: seed.storageGb,
        image_ref: 'nvcr.io/nvidia/pytorch:24.09-py3',
        env: { NVIDIA_VISIBLE_DEVICES: 'all' },
        ports: [22, 8888],
      };
    case 'gpu_baremetal':
      return {
        machine_type: `${spec.productName} Node`,
        gpu_model: spec.productName,
        gpu_count: seed.gpuCount,
        passthrough: true,
        cpu_model: spec.architecture,
        local_nvme_gb: seed.storageGb,
        ipmi_enabled: true,
        ib_enabled: true,
      };
    case 'vgpu':
      return {
        k8s_version: 'v1.31.2-cks',
        node_count: Math.max(1, Math.round(seed.gpuCount / spec.gpusPerNode)),
        gpu_count: seed.gpuCount,
        slicing_policy: seed.gpuCount > 16 ? 'mig-1g.24gb' : 'time-slicing-4',
        storage_gb: seed.storageGb,
        network_plugin: 'cilium',
        ingress_enabled: true,
      };
    case 'inference':
      return {
        model_ref: seed.name.includes('72b') ? 'qwen2.5-72b-instruct' : seed.name.includes('v3') ? 'deepseek-v3' : seed.name.includes('sdxl') ? 'sdxl-1.0' : 'llama-3.1-8b-instruct',
        replicas: Math.max(1, Math.round(seed.gpuCount / 8)),
        gpu_count: seed.gpuCount,
        port: 8000,
        auth_enabled: true,
        hpa: { min: 1, max: 6, target: 'ttft_p99 < 1500ms' },
        traffic_split: [{ version: 'v1', weight: 90 }, { version: 'v2-canary', weight: 10 }],
      };
  }
}

const STEP_KEYS: Array<ProvisioningStep['step_key']> = [
  'schedule',
  'provision',
  'pull_image',
  'attach_storage',
  'ready',
];

function buildResource(seed: Seed, index: number): Resource {
  const rand = rngFor(`resource:${index}:${seed.name}`);
  const meta = KIND_META[seed.kind];
  const uuid = stableUuid(rand) as ResourceUuid;
  const createdAt = new Date(now - seed.ageHours * HOUR).toISOString();
  const id = (index + 1) as InternalId;

  const runningSince =
    seed.status === 'running' || seed.status === 'stopped'
      ? new Date(now - seed.ageHours * HOUR).toISOString()
      : null;
  const stoppedAt =
    seed.status === 'stopped' ? new Date(now - 6 * HOUR).toISOString() : null;

  return {
    id,
    resource_uuid: uuid,
    display_id: meta.prefix +
      Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rand() * 36)]).join('') as DisplayId,
    org_id: 1 as InternalId,
    owner_id: 1 as InternalId,
    project_id: ((index % 3) + 1) as InternalId,
    order_id: (index + 1) as InternalId,
    kind: seed.kind,
    name: seed.name,
    region: seed.region,
    node_pool: seed.pool,
    spec_json: makeSpec(seed),
    gpu_count: seed.gpuCount,
    storage_gb: seed.storageGb,
    status: seed.status,
    running_since: runningSince,
    stopped_at: stoppedAt,
    created_at: createdAt,
    updated_at: new Date(now - (seed.status === 'running' ? 2 : 1) * 60_000).toISOString(),
    deleted_at: null,
  };
}

function buildOrder(r: Resource, index: number): DeploymentOrder {
  return {
    id: (index + 1) as InternalId,
    order_uuid: stableUuid(rngFor(`order:${index}`)),
    org_id: r.org_id,
    owner_id: r.owner_id,
    project_id: r.project_id,
    resource_kind: r.kind,
    requested_spec: r.spec_json,
    region: r.region,
    node_pool: r.node_pool,
    source_type: r.kind === 'inference' ? 'model' : 'image',
    source_ref_id: (r.kind === 'inference' ? 2 : 1) as InternalId,
    price_snapshot: 3.49,
    status:
      r.status === 'provisioning' ? 'provisioning'
      : r.status === 'error' ? 'failed'
      : 'fulfilled',
    failure_reason: r.status === 'error' ? 'InsufficientCapacity' : null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function buildSteps(r: Resource): ProvisioningStep[] {
  const rand = rngFor(`steps:${r.resource_uuid}`);
  // provisioning：前若干步 done/running，其余 pending；非 provisioning 全部 done
  const doneCount = r.status === 'provisioning' ? intBetween(rand, 1, 3) : STEP_KEYS.length;
  return STEP_KEYS.map((key, i) => {
    const seq = i + 1;
    let state: ProvisioningStep['state'] = 'pending';
    if (r.status === 'error' && i === STEP_KEYS.length - 1) state = 'failed';
    else if (i < doneCount) state = 'done';
    else if (i === doneCount && r.status === 'provisioning') state = 'running';
    const started = state === 'pending' ? null : new Date(now - (STEP_KEYS.length - i) * 8_000).toISOString();
    const finished = state === 'done' || state === 'failed' ? new Date(now - (STEP_KEYS.length - i - 1) * 8_000).toISOString() : null;
    return {
      id: (r.id * 10 + seq) as InternalId,
      resource_id: r.id,
      seq,
      step_key: key,
      state,
      message: state === 'failed' ? '容量不足：该节点池当前区域无可分配 GPU' : null,
      started_at: started,
      finished_at: finished,
    };
  });
}

function buildPlacement(r: Resource): ResourcePlacement {
  const rand = rngFor(`place:${r.resource_uuid}`);
  return {
    id: r.id as InternalId,
    resource_id: r.id,
    node_pool: r.node_pool,
    node_id: ((r.id % 8) + 1) as InternalId,
    rack_id: `rack-${r.region}-${String(intBetween(rand, 1, 12)).padStart(2, '0')}`,
    gpu_indices: Array.from({ length: Math.min(r.gpu_count, 8) }, (_, i) => i),
    assigned_at: r.created_at,
  };
}

/**
 * 有意义事件（§9.2 MUST：谁/何时/哪个组件/触发了什么度量阈值/before→after/建议动作）
 * 覆盖：创建 → 首次就绪 → 配置变更 → 至少 1 次告警/自愈 → 最近操作
 */
function buildEvents(r: Resource): ResourceEvent[] {
  const base: Array<Omit<ResourceEvent, 'id' | 'resource_id' | 'actor_user_id' | 'type'>> = [
    {
      occurredAt: r.created_at,
      level: 'info',
      source: 'user',
      code: 'ORDER_ACCEPTED',
      title: '部署订单已受理',
      detail: `订单受理，目标形态 ${KIND_META[r.kind].label}，区域 ${r.region.toUpperCase()}，请求 ${r.gpu_count} GPU。`,
      metricsAfter: { gpu_count: r.gpu_count, status: 'provisioning' },
      suggestedAction: '等待供给完成',
    },
    {
      occurredAt: new Date(new Date(r.created_at).getTime() + 45_000).toISOString(),
      level: 'success',
      source: 'dcgm',
      code: 'PROVISION_READY',
      title: '资源供给完成，进入 Running',
      detail: `供给完成（5 个子步骤全部 done），算力费自 running_since 起算；GPU 利用率由 null → 0.0%。`,
      metricsBefore: { gpu_utilization: 'null（未采集）' },
      metricsAfter: { gpu_utilization: 0, status: 'running' },
      suggestedAction: '前往详情页查看监控',
    },
    {
      occurredAt: new Date(now - 8 * HOUR).toISOString(),
      level: 'warning',
      source: 'dcgm',
      code: 'GPU_MEMORY_PRESSURE',
      title: 'GPU 显存压力告警',
      detail: `GPU 3 显存压力：已用 77.2/80 GB（96.5%）持续 12 min，已越过 95% 阈值；建议降低 batch_size 或扩容到 141 GB 机型。`,
      metricsBefore: { gpu_memory_util: 88.4 },
      metricsAfter: { gpu_memory_util: 96.5 },
      suggestedAction: '降低 batch_size 或迁移至 H200 NVL（141GB）',
    },
    {
      occurredAt: new Date(now - 5 * HOUR).toISOString(),
      level: 'info',
      source: 'billing',
      code: 'COST_THRESHOLD',
      title: '本月花费已达预算 82%',
      detail: `本月花费 $4,100 / 预算 $5,000（82%），按当前速率预计 10-24 触顶。`,
      metricsBefore: { cost_mtd: 3680 },
      metricsAfter: { cost_mtd: 4100 },
      suggestedAction: '前往运营·成本分析查看拆解',
    },
    {
      occurredAt: new Date(now - 2 * HOUR).toISOString(),
      level: 'success',
      source: 'k8s-scheduler',
      code: 'HPA_SCALE_UP',
      title: 'HPA 触发扩容',
      detail: `平均 TTFT P99 4.2 s > 目标 1.5 s 持续 3 min，副本 3 → 6，预计月度成本 +$1,283。`,
      metricsBefore: { ttft_p99: 4200, replicas: 3 },
      metricsAfter: { ttft_p99: 1450, replicas: 6 },
      suggestedAction: '确认容量与预算',
    },
  ];

  if (r.status === 'error') {
    base.push({
      occurredAt: new Date(now - 30 * 60_000).toISOString(),
      level: 'error',
      source: 'k8s-scheduler',
      code: 'INSUFFICIENT_GPU',
      title: '供给失败：容量不足',
      detail: `0/64 节点满足 nvidia.com/gpu（每实例需 ${r.gpu_count}，最大可用节点余量 4）；订单置 failed，可重试。`,
      metricsBefore: { status: 'provisioning' },
      metricsAfter: { status: 'error', failure_reason: 'InsufficientCapacity' },
      suggestedAction: '重试供给或更换节点池',
    });
  }
  if (r.status === 'stopped') {
    base.push({
      occurredAt: r.stopped_at ?? new Date(now - 6 * HOUR).toISOString(),
      level: 'info',
      source: 'user',
      code: 'RESOURCE_STOPPED',
      title: '资源已停止',
      detail: `算力费停计，存储继续计费（${r.storage_gb} GB × $0.08/GB·月）；GPU 利用率置 null（非 0）。`,
      metricsBefore: { status: 'running', gpu_utilization: 62.4 },
      metricsAfter: { status: 'stopped', gpu_utilization: 'null' },
      suggestedAction: '确认是否需要重新启动',
    });
  }

  return base.map((e, i) => ({
    ...e,
    id: `${r.resource_uuid}-ev-${i}`,
    resource_id: r.id,
    type: e.code,
    actor_user_id: e.source === 'user' ? (1 as InternalId) : null,
  }));
}

// ─────────── 导出（模块加载时确定性构建一次） ───────────
export const RESOURCES: Resource[] = SEEDS.map(buildResource);
export const ORDERS: DeploymentOrder[] = RESOURCES.map(buildOrder);
export const PROVISIONING_STEPS: ProvisioningStep[] = RESOURCES.flatMap(buildSteps);
export const PLACEMENTS: ResourcePlacement[] = RESOURCES.map(buildPlacement);
export const RESOURCE_EVENTS: ResourceEvent[] = RESOURCES.flatMap(buildEvents);

export const resourceByUuid = (uuid: string): Resource | undefined =>
  RESOURCES.find((r) => r.resource_uuid === uuid);
export const stepsOf = (resourceId: InternalId): ProvisioningStep[] =>
  PROVISIONING_STEPS.filter((s) => s.resource_id === resourceId).sort((a, b) => a.seq - b.seq);
export const eventsOf = (resourceId: InternalId): ResourceEvent[] =>
  RESOURCE_EVENTS.filter((e) => e.resource_id === resourceId).sort(
    (a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt),
  );
export const placementOf = (resourceId: InternalId): ResourcePlacement | undefined =>
  PLACEMENTS.find((p) => p.resource_id === resourceId);
export const orderOf = (resourceId: InternalId): DeploymentOrder | undefined =>
  ORDERS.find((o) => o.id === resourceId);
