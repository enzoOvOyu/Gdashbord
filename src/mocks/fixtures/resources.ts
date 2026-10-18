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
import { NODE_POOLS } from './nodes';
import { IMAGES } from './images';
import { MODELS } from './models';
import { intBetween, rngFor, pick } from '../lib/rng';
import { PROVISION_SUBSTEPS } from './regions-pools';
import { defaultProjectId } from './projects';
import { ORG } from './users-orgs';

const HOUR = 3600_000;
const bootAt = Date.now();
const now = (): number => Date.now();

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

/**
 * 24 个演示实例：4 类 × 4 区域 × 五种生命周期状态全覆盖。
 * 每个区域都有数据，切换区域必然产生差异（MOCK-DATA §1 G9）。
 */
const SEEDS: Seed[] = [
  // 日本 JP
  { kind: 'gpu_vm', name: 'llm-pretrain-01', region: 'jp', pool: 'H100_SXM', status: 'running', gpuCount: 8, storageGb: 1000, ageHours: 96, workload: '训练' },
  { kind: 'gpu_vm', name: 'notebook-dev-01', region: 'jp', pool: 'H100_SXM', status: 'running', gpuCount: 1, storageGb: 200, ageHours: 30, workload: '开发' },
  { kind: 'gpu_vm', name: 'jp-eval-batch-04', region: 'jp', pool: 'H200_NVL', status: 'stopped', gpuCount: 4, storageGb: 500, ageHours: 240, workload: '批处理' },
  { kind: 'gpu_baremetal', name: 'bm-h100-jp07', region: 'jp', pool: 'H100_SXM', status: 'running', gpuCount: 8, storageGb: 6000, ageHours: 480, workload: '训练' },
  { kind: 'vgpu', name: 'cks-inference-jp', region: 'jp', pool: 'H100_SXM', status: 'running', gpuCount: 16, storageGb: 2000, ageHours: 336, workload: '托管K8s' },
  { kind: 'inference', name: 'qwen-72b-prod', region: 'jp', pool: 'H100_SXM', status: 'running', gpuCount: 8, storageGb: 500, ageHours: 168, workload: '在线推理' },
  // 泰国 TH
  { kind: 'gpu_vm', name: 'th-finetune-01', region: 'th', pool: 'H100_SXM', status: 'running', gpuCount: 4, storageGb: 800, ageHours: 52, workload: '训练' },
  { kind: 'gpu_vm', name: 'th-notebook-02', region: 'th', pool: 'H100_SXM', status: 'stopped', gpuCount: 1, storageGb: 200, ageHours: 18, workload: '开发' },
  { kind: 'gpu_vm', name: 'th-new-server-03', region: 'th', pool: 'H100_SXM', status: 'provisioning', gpuCount: 2, storageGb: 300, ageHours: 0, workload: '待定' },
  { kind: 'inference', name: 'th-llama-8b-chat', region: 'th', pool: 'H100_SXM', status: 'running', gpuCount: 1, storageGb: 200, ageHours: 72, workload: '在线推理' },
  { kind: 'vgpu', name: 'cks-th-dev', region: 'th', pool: 'H100_SXM', status: 'running', gpuCount: 8, storageGb: 1000, ageHours: 120, workload: '托管K8s' },
  // 新加坡 SG
  { kind: 'gpu_vm', name: 'sg-eval-batch-02', region: 'sg', pool: 'H200_NVL', status: 'stopped', gpuCount: 4, storageGb: 500, ageHours: 240, workload: '批处理' },
  { kind: 'gpu_baremetal', name: 'bm-b300-sg02', region: 'sg', pool: 'B300', status: 'error', gpuCount: 8, storageGb: 6000, ageHours: 12, workload: '训练' },
  { kind: 'gpu_baremetal', name: 'bm-h100-sg05', region: 'sg', pool: 'H100_SXM', status: 'running', gpuCount: 8, storageGb: 6000, ageHours: 300, workload: '训练' },
  { kind: 'vgpu', name: 'cks-new-sg', region: 'sg', pool: 'H100_SXM', status: 'provisioning', gpuCount: 8, storageGb: 1000, ageHours: 0, workload: '托管K8s' },
  { kind: 'inference', name: 'old-sdxl-svc', region: 'sg', pool: 'H200_NVL', status: 'terminating', gpuCount: 2, storageGb: 300, ageHours: 960, workload: '在线推理' },
  // 美国 US
  { kind: 'gpu_vm', name: 'us-new-server-03', region: 'us', pool: 'H100_SXM', status: 'provisioning', gpuCount: 2, storageGb: 300, ageHours: 0, workload: '待定' },
  { kind: 'gpu_vm', name: 'us-render-05', region: 'us', pool: 'H200_NVL', status: 'error', gpuCount: 8, storageGb: 1000, ageHours: 6, workload: '训练' },
  { kind: 'gpu_baremetal', name: 'bm-b200-rack01', region: 'us', pool: 'B200_NVL72', status: 'running', gpuCount: 8, storageGb: 8000, ageHours: 720, workload: '训练' },
  { kind: 'gpu_baremetal', name: 'bm-gb300-us01', region: 'us', pool: 'GB300_NVL72', status: 'running', gpuCount: 8, storageGb: 16000, ageHours: 96, workload: '训练' },
  { kind: 'vgpu', name: 'cks-training-us', region: 'us', pool: 'H200_NVL', status: 'running', gpuCount: 32, storageGb: 4000, ageHours: 168, workload: '托管K8s' },
  { kind: 'vgpu', name: 'cks-us-b300', region: 'us', pool: 'B300', status: 'running', gpuCount: 16, storageGb: 2000, ageHours: 240, workload: '托管K8s' },
  { kind: 'inference', name: 'llama-8b-chat-us', region: 'us', pool: 'H100_SXM', status: 'running', gpuCount: 1, storageGb: 200, ageHours: 72, workload: '在线推理' },
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

const gpusPerNode = (pool: NodePoolCode): number =>
  NODE_POOLS.find((p) => p.code === pool)?.gpus_per_node ?? 8;

const machineCountOf = (gpuCount: number, pool: NodePoolCode): number =>
  Math.max(1, Math.round(gpuCount / gpusPerNode(pool)));

function makeSpec(seed: Seed, rand: () => number): ResourceSpec {
  const spec = GPU_SPECS[seed.pool];
  switch (seed.kind) {
    case 'gpu_vm':
      return {
        gpu_model: spec.productName,
        gpu_count: seed.gpuCount,
        vcpu: seed.gpuCount * 14,
        memory_gb: seed.gpuCount * 112,
        storage_gb: seed.storageGb,
        image_ref: pick(rand, IMAGES).name,
        env: { NVIDIA_VISIBLE_DEVICES: 'all' },
        ports: [22, 8888],
        ssh_pubkey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEnzoDemoKey',
      };
    case 'gpu_baremetal': {
      const machines = machineCountOf(seed.gpuCount, seed.pool);
      return {
        machine_type: `${spec.productName} Node`,
        machine_count: machines,
        gpu_model: spec.productName,
        gpu_count: machines * gpusPerNode(seed.pool),
        passthrough: true,
        mig_partition: null,
        cpu_model: spec.architecture,
        local_nvme_gb: seed.storageGb,
        raid_level: seed.pool === 'GB300_NVL72' ? 'raid10' : 'raid0',
        ipmi_enabled: true,
        bmc_network: 'dedicated',
        ib_enabled: true,
        hostname_prefix: seed.name,
        firmware_baseline: 'recommended',
      };
    }
    case 'vgpu': {
      const perNode = gpusPerNode(seed.pool);
      const nodeCount = Math.max(1, Math.round(seed.gpuCount / perNode));
      return {
        k8s_version: '1.31',
        control_plane_tier: seed.gpuCount > 16 ? 'ha' : 'standard',
        api_server_public: false,
        api_server_allow_cidrs: [],
        pools: [
          {
            node_pool: seed.pool,
            node_count: nodeCount,
            slicing_policy: seed.gpuCount > 16 ? 'mig' : 'time_slicing',
            mig_profile: seed.gpuCount > 16 ? '2g.48gb' : null,
            time_slice_share: seed.gpuCount > 16 ? null : 4,
            autoscale: { min: Math.max(1, nodeCount - 1), max: nodeCount + 4 },
          },
        ],
        node_count: nodeCount,
        gpu_count: seed.gpuCount,
        network_plugin: 'cilium',
        ingress_enabled: true,
        ingress_class: 'nginx',
        ib_enabled: seed.pool === 'GB300_NVL72',
        storage_class: 'nvme',
        default_pvc_gb: seed.storageGb,
        storage_gb: seed.storageGb,
        kubeconfig_access: 'console',
        rbac_default_admin: true,
      };
    }
    case 'inference': {
      const model = MODELS.find((m) => m.slug.includes('72b'))
        ?? MODELS[0];
      const perReplica = Math.min(8, seed.gpuCount);
      return {
        model_ref: model.name,
        model_slug: model.slug,
        quantization: 'bf16',
        max_model_len: 32768,
        replicas: Math.max(1, Math.round(seed.gpuCount / perReplica)),
        gpu_count: perReplica,
        port: 8000,
        engine: 'vllm',
        auth_enabled: true,
        api_key: null,
        max_batch_size: 256,
        enable_prefix_caching: true,
        enable_chunked_prefill: true,
        hpa: { min: 1, max: 6, metric: 'ttft_p99', target: 1500 },
        canary: null,
        cold_standby: false,
        warmup_prompt: null,
        env: { HF_HOME: '/models' },
      };
    }
  }
}

function buildResource(seed: Seed, index: number): Resource {
  const rand = rngFor(`resource:${index}:${seed.name}`);
  const meta = KIND_META[seed.kind];
  const uuid = stableUuid(rand) as ResourceUuid;
  const createdAt = new Date(bootAt - seed.ageHours * HOUR).toISOString();
  const id = (index + 1) as InternalId;

  const runningSince =
    seed.status === 'running' || seed.status === 'stopped'
      ? new Date(bootAt - seed.ageHours * HOUR).toISOString()
      : null;
  const stoppedAt =
    seed.status === 'stopped' ? new Date(bootAt - 6 * HOUR).toISOString() : null;

  return {
    id,
    resource_uuid: uuid,
    display_id: meta.prefix +
      Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rand() * 36)]).join('') as DisplayId,
    org_id: ORG.id,
    owner_id: 1 as InternalId,
    project_id: ((index % 3) + 1) as InternalId,
    order_id: (index + 1) as InternalId,
    kind: seed.kind,
    name: seed.name,
    region: seed.region,
    node_pool: seed.pool,
    spec_json: makeSpec(seed, rand),
    gpu_count: seed.gpuCount,
    storage_gb: seed.storageGb,
    status: seed.status,
    running_since: runningSince,
    stopped_at: stoppedAt,
    created_at: createdAt,
    updated_at: new Date(bootAt - (seed.status === 'running' ? 2 : 1) * 60_000).toISOString(),
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
    // §7.1 价格快照：下单时的真实单价（四类口径不同，见 handlers）
    price_snapshot: 0,
    status:
      r.status === 'provisioning' ? 'provisioning'
      : r.status === 'error' ? 'failed'
      : 'fulfilled',
    failure_reason: r.status === 'error' ? 'InsufficientCapacity' : null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** 供给子步骤按资源类型区分（§5.1 PROVISION_SUBSTEPS），不再四类共用 5 步 */
function stepKeysOf(kind: ResourceKind): string[] {
  return [...PROVISION_SUBSTEPS[kind]];
}

function buildSteps(r: Resource): ProvisioningStep[] {
  const rand = rngFor(`steps:${r.resource_uuid}`);
  const keys = stepKeysOf(r.kind);
  const doneCount = r.status === 'provisioning' ? intBetween(rand, 1, Math.max(1, keys.length - 2)) : keys.length;
  return keys.map((key, i) => {
    const seq = i + 1;
    let state: ProvisioningStep['state'] = 'pending';
    if (r.status === 'error' && i === keys.length - 1) state = 'failed';
    else if (i < doneCount) state = 'done';
    else if (i === doneCount && r.status === 'provisioning') state = 'running';
    const started = state === 'pending' ? null : new Date(bootAt - (keys.length - i) * 8_000).toISOString();
    const finished = state === 'done' || state === 'failed' ? new Date(bootAt - (keys.length - i - 1) * 8_000).toISOString() : null;
    return {
      id: (r.id * 100 + seq) as InternalId,
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
  const kindLabel = KIND_META[r.kind].label;
  const base: Array<Omit<ResourceEvent, 'id' | 'resource_id' | 'actor_user_id' | 'type'>> = [
    {
      occurredAt: r.created_at,
      level: 'info',
      source: 'user',
      code: 'ORDER_ACCEPTED',
      title: '部署订单已受理',
      detail: `订单受理，目标形态 ${kindLabel}，区域 ${r.region.toUpperCase()}，请求 ${r.gpu_count} GPU。`,
      metricsAfter: { gpu_count: r.gpu_count, status: 'provisioning' },
      suggestedAction: '等待供给完成',
    },
    {
      occurredAt: new Date(new Date(r.created_at).getTime() + 45_000).toISOString(),
      level: 'success',
      source: 'dcgm',
      code: 'PROVISION_READY',
      title: '资源供给完成，进入 Running',
      detail: `供给完成（${stepKeysOf(r.kind).length} 个子步骤全部 done），算力费自 running_since 起算；GPU 利用率由 null → 0.0%。`,
      metricsBefore: { gpu_utilization: 'null（未采集）' },
      metricsAfter: { gpu_utilization: 0, status: 'running' },
      suggestedAction: '前往详情页查看监控',
    },
    {
      occurredAt: new Date(bootAt - 8 * HOUR).toISOString(),
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
      occurredAt: new Date(bootAt - 5 * HOUR).toISOString(),
      level: 'info',
      source: 'billing',
      code: 'COST_THRESHOLD',
      title: '本月花费已达预算 82%',
      detail: `本月花费 $4,100 / 预算 $5,000（82%），按当前速率预计 10-24 触顶（此金额由 billing_usage 聚合得出）。`,
      metricsBefore: { cost_mtd: 3680 },
      metricsAfter: { cost_mtd: 4100 },
      suggestedAction: '前往运营&运维 · 成本分析查看拆解',
    },
    {
      occurredAt: new Date(bootAt - 2 * HOUR).toISOString(),
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
      occurredAt: new Date(bootAt - 30 * 60_000).toISOString(),
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
      occurredAt: r.stopped_at ?? new Date(bootAt - 6 * HOUR).toISOString(),
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

// ─────────── 生命周期真实操作（PRD §5.4 / §5.4.1） ───────────

let eventSeq = 0;
function pushEvent(
  r: Resource,
  e: Omit<ResourceEvent, 'id' | 'resource_id' | 'type' | 'actor_user_id'>,
): void {
  eventSeq += 1;
  RESOURCE_EVENTS.unshift({
    ...e,
    id: `${r.resource_uuid}-ev-live-${eventSeq}`,
    resource_id: r.id,
    type: e.code,
    actor_user_id: e.source === 'user' ? (1 as InternalId) : null,
  });
}

export function startResource(r: Resource): Resource {
  const ts = new Date().toISOString();
  r.status = 'running';
  r.running_since = r.running_since ?? ts;
  r.stopped_at = null;
  r.updated_at = ts;
  pushEvent(r, {
    occurredAt: ts,
    level: 'success',
    source: 'user',
    code: 'RESOURCE_STARTED',
    title: '资源已启动',
    detail: '算力费自此刻起计，GPU 指标恢复采集。',
    metricsBefore: { status: 'stopped', gpu_utilization: 'null' },
    metricsAfter: { status: 'running', gpu_utilization: 0 },
    suggestedAction: '前往监控确认负载',
  });
  return r;
}

export function stopResource(r: Resource): Resource {
  const ts = new Date().toISOString();
  r.status = 'stopped';
  r.stopped_at = ts;
  r.updated_at = ts;
  pushEvent(r, {
    occurredAt: ts,
    level: 'info',
    source: 'user',
    code: 'RESOURCE_STOPPED',
    title: '资源已停止',
    detail: `算力费停计，存储继续计费（${r.storage_gb} GB × $0.08/GB·月）。`,
    metricsBefore: { status: 'running' },
    metricsAfter: { status: 'stopped', gpu_utilization: 'null' },
    suggestedAction: '需要时重新启动',
  });
  return r;
}

/**
 * 软删除（PRD §5.4.1 / ARCH §12.10）：置 deleted_at，释放配额并停止计量。
 * 历史用量与流水保留（已发生的费用不可抹除）。
 */
export function softDeleteResource(r: Resource): Resource {
  const ts = new Date().toISOString();
  r.status = 'terminating';
  r.stopped_at = r.stopped_at ?? ts;
  r.updated_at = ts;
  r.deleted_at = ts;
  pushEvent(r, {
    occurredAt: ts,
    level: 'warning',
    source: 'user',
    code: 'RESOURCE_DELETED',
    title: '资源已删除（软删）',
    detail: '资源进入 terminating 并标记 deleted_at，配额释放、计量立即停止；历史用量与扣费流水保留用于对账。',
    metricsBefore: { status: r.status },
    metricsAfter: { status: 'deleted', deleted_at: ts },
    suggestedAction: '如需恢复请联系支持（保留期 7 天）',
  });
  return r;
}

// ─────────── 运行期创建（部署向导下单 → 异步映射为资源，PRD §5.3） ───────────

const specNumber = (s: ResourceSpec, key: string, fallback: number): number => {
  const v = (s as unknown as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
};

let createdSeq = 0;

/**
 * 下单请求的算力/存储足迹（与 createResourceFromOrder 的供给钳制口径完全一致）。
 * 配额预检（PRD §7.3 超限拒绝）与资源创建共用本函数，避免两处口径漂移。
 * 裸金属按「台」折算卡数；推理按「副本 × 单副本 TP 卡数」。
 */
export function requestedFootprint(
  kind: ResourceKind,
  pool: NodePoolCode,
  spec: ResourceSpec,
): { gpu: number; storageGb: number; vcpu: number; publicIp: number } {
  const cap = GPU_SPECS[pool].gpusPerNode;
  const reqGpu = specNumber(spec, 'gpu_count', 1);
  const req = spec as unknown as Record<string, unknown>;
  const poolGpus = gpusPerNode(pool);
  const gpu =
    kind === 'gpu_baremetal'
      ? Math.min(Math.max(1, Math.round(Number(req['machine_count'] ?? 1))), 32) * poolGpus
      : kind === 'inference'
        // 推理：副本数 × 单副本 TP 卡数（规格上限 8 卡/副本 × 32 副本）
        ? Math.min(
            Math.max(1, Math.round(Number(req['replicas'] ?? 1))) *
              Math.max(1, Math.round(Number(req['gpu_per_replica'] ?? 1))),
            256,
          )
        : Math.min(reqGpu, cap * (kind === 'vgpu' ? 64 : 8));
  return {
    gpu,
    storageGb: specNumber(spec, 'storage_gb', 0),
    // vCPU 口径与配额派生一致：每 GPU 14 vCPU
    vcpu: gpu * 14,
    publicIp: 1,
  };
}

/**
 * 由订单异步供给出资源实例。
 * 请求规格 requested_spec 与供给规格 spec_json 允许存在降级差异（§12.9），
 * 此处演示"库存降级"：当 GPU 数超过机型单机上限时按上限供给。
 */
export function createResourceFromOrder(order: DeploymentOrder, name: string): Resource {
  createdSeq += 1;
  const id = (1000 + createdSeq) as InternalId;
  const rand = rngFor(`created:${order.order_uuid}:${createdSeq}`);
  const kind = order.resource_kind;
  const pool = (order.node_pool ?? 'H100_SXM') as NodePoolCode;

  // 供给降级：超出单机 GPU 上限则钳制（与配额预检同源）
  const reqGpu = specNumber(order.requested_spec, 'gpu_count', 1);
  const cap = GPU_SPECS[pool].gpusPerNode;
  const footprint = requestedFootprint(kind, pool, order.requested_spec);
  const gpuCount = footprint.gpu;
  const storageGb = footprint.storageGb;

  const ts = new Date().toISOString();
  const r: Resource = {
    id,
    resource_uuid: stableUuid(rand) as ResourceUuid,
    display_id: KIND_META[kind].prefix +
      Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rand() * 36)]).join('') as DisplayId,
    org_id: order.org_id,
    owner_id: order.owner_id,
    project_id: order.project_id ?? defaultProjectId(),
    order_id: order.id,
    kind,
    name,
    region: order.region,
    node_pool: pool,
    spec_json: order.requested_spec,
    gpu_count: gpuCount,
    storage_gb: storageGb,
    // 下单受理后进入 provisioning（PRD §5.4 状态图）
    status: 'provisioning' as ResourceStatus,
    running_since: null,
    stopped_at: null,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
  };
  RESOURCES.unshift(r);

  const keys = stepKeysOf(kind);
  const steps = keys.map((key, i) => ({
    id: (r.id * 1000 + i + 1) as InternalId,
    resource_id: r.id,
    seq: i + 1,
    step_key: key,
    state: (i === 0 ? 'running' : 'pending') as ProvisioningStep['state'],
    message: null,
    started_at: i === 0 ? ts : null,
    finished_at: null,
  }));
  PROVISIONING_STEPS.push(...steps);

  pushEvent(r, {
    occurredAt: ts,
    level: 'info',
    source: 'user',
    code: 'ORDER_ACCEPTED',
    title: '部署订单已受理',
    detail: `订单 ${order.order_uuid.slice(0, 8)} 已受理，目标 ${KIND_META[kind].label}，区域 ${order.region.toUpperCase()}，节点池 ${pool}。`,
    metricsAfter: { status: 'provisioning' },
    suggestedAction: '等待供给完成',
  });

  if (kind !== 'gpu_baremetal' && reqGpu > cap) {
    pushEvent(r, {
      occurredAt: ts,
      level: 'warning',
      source: 'k8s-scheduler',
      code: 'SPEC_DOWNGRADED',
      title: '规格降级供给',
      detail: `请求 ${reqGpu} GPU 超出单机上限 ${cap}，按可用容量供给 ${gpuCount} GPU。`,
      metricsBefore: { requested_gpu: reqGpu },
      metricsAfter: { supplied_gpu: gpuCount },
      suggestedAction: '如需整柜算力请选用 NVL72 机型',
    });
  }

  PLACEMENTS.unshift(buildPlacement(r));

  return r;
}

/** 当前时刻（供 handlers 计算运行时长） */
export const bootTimestamp = (): number => bootAt;
export const nowIso = (): string => new Date().toISOString();
export const nowMs = now;
