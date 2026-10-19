// 四类向导的分步校验 schema（PRD §4.2.0：进入下一步前必须通过当前步校验）
// 单一来源：本文件枚举与领域类型对齐，禁止在表单里另写一套。
import { t } from '../../i18n';
import { z } from 'zod';
import { REGION_LIST, NODE_POOL_LIST } from '../../lib/ids';

const region = z.enum(REGION_LIST as [string, ...string[]]);
const pool = z.enum(NODE_POOL_LIST as [string, ...string[]]);

/** 公共第 1 步：项目与区域（§4.2.0） */
export const projectRegionSchema = z.object({
  project_id: z.number().min(1, t('deploy.pickProject')),
  region,
  name: z
    .string()
    .trim()
    .min(3, t('val.nameMin3'))
    .max(63, t('val.nameMax63')),
  labels: z.array(z.string()).optional(),
});

// ─────────── v0.7 弹性伸缩（PRD §4.2.6 / §4.2.6.3；与 ARCH §12.12 scaling_policies 同模型） ───────────
// 两个策略模型**不共用一套表单**：节点池伸缩（整机/虚拟机/分片）与服务副本伸缩（推理）。
// 字段契约：{ strategy_model, trigger_metric, target_value?, min_size, max_size, scale_to_zero?,
//            drain_timeout_s, fallback_enabled, cooldown_s }
export const NODE_POOL_METRICS = ['queue_depth', 'pending_pods', 'qpm', 'gpu_allocation_rate'] as const;
export const REPLICA_METRICS = ['ttft_p99', 'kv_cache_usage', 'requests_waiting', 'concurrency'] as const;
export type NodePoolMetric = (typeof NODE_POOL_METRICS)[number];
export type ReplicaMetric = (typeof REPLICA_METRICS)[number];

/** 节点池伸缩策略：min_size ≥ 1（禁止摘掉最后一台；裸金属 warm floor） */
export const nodePoolScalingSchema = z
  .object({
    strategy_model: z.literal('node_pool'),
    trigger_metric: z.enum(NODE_POOL_METRICS),
    target_value: z.number().min(0),
    min_size: z.number().int().min(1, t('val.scalingMin1')),
    max_size: z.number().int().min(1),
    fallback_enabled: z.boolean(),
    cooldown_s: z.number().int().min(60).max(3600),
  })
  .refine((v) => v.max_size >= v.min_size, {
    get message() { return t('val.scalingMaxGeMin'); },
    path: ['max_size'],
  });

/** 服务副本伸缩策略：scale_to_zero 默认关（冷启动风险），开启时允许 min_size = 0 */
export const replicaScalingSchema = z
  .object({
    strategy_model: z.literal('replica'),
    trigger_metric: z.enum(REPLICA_METRICS),
    target_value: z.number().min(1),
    min_size: z.number().int().min(0),
    max_size: z.number().int().min(1),
    scale_to_zero: z.boolean(),
    drain_timeout_s: z.number().int().min(30).max(3600),
    fallback_enabled: z.boolean(),
    cooldown_s: z.number().int().min(60).max(3600),
  })
  .refine((v) => v.max_size >= v.min_size, {
    get message() { return t('val.scalingMaxGeMin'); },
    path: ['max_size'],
  })
  .refine((v) => v.scale_to_zero || v.min_size >= 1, {
    get message() { return t('val.scalingMin1'); },
    path: ['min_size'],
  });

/** 向导内精简表单的公共开关（默认关闭 = 固定规格，scaling=null） */
const elasticToggle = z.object({ elastic_scaling: z.boolean() });

// ─────────── ① GPU 云服务器 ───────────
export const vmStep2Schema = z.object({
  node_pool: pool,
  gpu_count: z.number().int().min(1, t('val.gpuMin1')).max(8),
  vcpu: z.number().int().min(4),
  memory_gb: z.number().int().min(16),
});
export const vmStep3Schema = z.object({
  image_ref: z.string().min(1, t('val.pickImage')),
  system_disk_gb: z
    .number()
    .int()
    .min(40, t('val.diskRange'))
    .max(2048, t('val.diskRange')),
  data_disk_gb: z.number().int().min(0).max(32768),
  system_disk_type: z.enum(['nvme_ssd', 'ssd']),
});
export const vmStep4Schema = z.object({
  vpc: z.string().min(1, t('val.pickVpc')),
  subnet: z.string().min(1, t('val.pickSubnet')),
  security_group: z.string().min(1, t('val.pickSg')),
  public_ip: z.boolean(),
  bandwidth_mbps: z.number().int().min(1).max(1000),
  ssh_pubkey: z.string().min(10, t('val.sshRequired')),
});
/** 第 5 步（§4.2.1）：弹性伸缩开关 + 节点池伸缩策略精简表单 */
export const vmStep5Schema = elasticToggle
  .extend({
    quantity: z.number().int().min(1, t('val.machineMin1')).max(50, t('val.machineMax50')),
    auto_shutdown_idle_min: z.number().int().min(0).max(120),
    scaling: nodePoolScalingSchema.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.elastic_scaling && !v.scaling) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        get message() { return t('val.scalingRequired'); },
        path: ['scaling'],
      });
    }
    // 本次创建的实例数必须落在弹性区间内（min ≤ quantity ≤ max）
    if (v.elastic_scaling && v.scaling && (v.quantity < v.scaling.min_size || v.quantity > v.scaling.max_size)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        get message() { return t('val.scalingQuantityInRange'); },
        path: ['quantity'],
      });
    }
  });

// ─────────── ② GPU 裸金属（按「台」） ───────────
export const bmStep2Schema = z.object({
  machine_type: pool,
});
export const bmStep3Schema = z.object({
  machine_count: z
    .number()
    .int()
    .min(1, t('val.machineMin1'))
    .max(32, t('val.machineMax32')),
  passthrough: z.boolean(),
  mig_partition: z.string().optional(),
  raid_level: z.enum(['none', 'raid0', 'raid1', 'raid10']),
});
export const bmStep4Schema = z.object({
  vpc: z.string().min(1, t('val.pickVpc')),
  subnet: z.string().min(1, t('val.pickSubnet')),
  ib_enabled: z.boolean(),
  ipmi_enabled: z.boolean(),
  bmc_network: z.enum(['shared', 'dedicated']),
});
/** 第 5 步（§4.2.2）：弹性伸缩开关（明示冷启动 5–30min）+ 节点池伸缩策略；min 不允许 0 */
export const bmStep5Schema = elasticToggle
  .extend({
    image_ref: z.string().min(1, t('val.pickOs')),
    hostname_prefix: z
      .string()
      .trim()
      .min(2, t('val.prefixMin2'))
      .max(24, t('val.prefixMax24')),
    ssh_pubkey: z.string().min(10, t('val.sshRequired')),
    firmware_baseline: z.enum(['recommended', 'latest']),
    scaling: nodePoolScalingSchema.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.elastic_scaling && !v.scaling) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        get message() { return t('val.scalingRequired'); },
        path: ['scaling'],
      });
    }
    // 裸金属 stabilization 10–30min（§4.2.6.2）
    if (v.elastic_scaling && v.scaling && v.scaling.cooldown_s < 600) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        get message() { return t('val.bmStabilization'); },
        path: ['scaling'],
      });
    }
  });

// ─────────── ③ vGPU（托管 K8s） ───────────
export const vgpuStep2Schema = z.object({
  k8s_version: z.enum(['1.28', '1.29', '1.30', '1.31']),
  control_plane_tier: z.enum(['standard', 'ha']),
  api_server_public: z.boolean(),
});
/** 第 3 步（§4.2.3）：v0.7 起 `autoscale` 升级为统一「弹性伸缩」开关，每池显示 min/max 节点数 */
export const vgpuStep3Schema = elasticToggle
  .extend({
    pools: z
      .array(
        z.object({
          node_pool: pool,
          node_count: z.number().int().min(1).max(64),
          slicing_policy: z.enum(['none', 'mig', 'time_slicing', 'mps']),
          mig_profile: z.string().optional(),
          time_slice_share: z.number().int().min(2).max(8).optional(),
          /** 弹性区间（每池节点数）；未开启弹性时等于 node_count */
          min_nodes: z.number().int().min(1).max(64),
          max_nodes: z.number().int().min(1).max(64),
        }),
      )
      .min(1, t('val.poolMin1'))
      .max(5, t('val.poolMax5')),
    scaling: nodePoolScalingSchema.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.elastic_scaling) return;
    if (!v.scaling) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        get message() { return t('val.scalingRequired'); },
        path: ['scaling'],
      });
      return;
    }
    // 聚合校验：各池 min 之和 = 策略 min_size，各池 max 之和 = 策略 max_size（§4.2.6.3 同模型）
    const minSum = v.pools.reduce((a, p) => a + p.min_nodes, 0);
    const maxSum = v.pools.reduce((a, p) => a + p.max_nodes, 0);
    if (minSum !== v.scaling.min_size || maxSum !== v.scaling.max_size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        get message() { return t('val.vgpuPoolSum'); },
        path: ['scaling'],
      });
    }
    for (const p of v.pools) {
      if (p.max_nodes < p.min_nodes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          get message() { return t('val.scalingMaxGeMin'); },
          path: ['pools'],
        });
      }
    }
  });
export const vgpuStep4Schema = z.object({
  vpc: z.string().min(1, t('val.pickVpc')),
  subnet: z.string().min(1, t('val.pickSubnet')),
  network_plugin: z.enum(['cilium', 'calico']),
  ingress_enabled: z.boolean(),
  storage_class: z.enum(['ssd', 'nvme', 'shared-fs']),
  default_pvc_gb: z.number().int().min(0).max(32768),
});
export const vgpuStep5Schema = z.object({
  kubeconfig_access: z.enum(['download', 'console']),
  rbac_default_admin: z.boolean(),
});

// ─────────── ④ 推理服务 ───────────
export const infStep2Schema = z
  .object({
    model_slug: z.string().min(1, t('val.pickModel')),
    quantization: z.enum(['bf16', 'fp8', 'fp4', 'awq']),
    max_model_len: z.number().int().min(4096, t('val.contextRange')).max(1_000_000),
    concurrency: z.number().int().min(1, t('val.concurrencyMin1')).max(512, t('val.concurrencyMax512')),
    avg_context_tokens: z.number().int().min(256, t('val.avgCtxMin256')).max(1_000_000),
  })
  .refine((v) => v.avg_context_tokens <= v.max_model_len, {
    get message() { return t('val.avgCtxMax'); },
    path: ['avg_context_tokens'],
  });
/** 第 3 步（§4.2.4）：v0.7 起 `hpa_enabled` 升级为统一「弹性伸缩」开关，策略模型 = 服务副本伸缩 */
export const infStep3Schema = elasticToggle
  .extend({
    replicas: z.number().int().min(1, t('val.replicaMin1')).max(32),
    node_pool: pool,
    gpu_per_replica: z.number().int().min(1).max(8),
    scaling: replicaScalingSchema.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.elastic_scaling && !v.scaling) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        get message() { return t('val.scalingRequired'); },
        path: ['scaling'],
      });
      return;
    }
    // 副本数必须落在弹性区间内（min ≤ replicas ≤ max）
    if (v.elastic_scaling && v.scaling && (v.replicas < v.scaling.min_size || v.replicas > v.scaling.max_size)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        get message() { return t('val.scalingQuantityInRange'); },
        path: ['replicas'],
      });
    }
  });
export const infStep4Schema = z.object({
  engine: z.enum(['vllm', 'sglang', 'trt-llm']),
  port: z.number().int().min(1, t('val.portRange')).max(65535),
  auth_enabled: z.boolean(),
  max_batch_size: z.number().int().min(1).max(512),
  enable_prefix_caching: z.boolean(),
  enable_chunked_prefill: z.boolean(),
});
export const infStep5Schema = z.object({
  canary_enabled: z.boolean(),
  canary_replicas: z.number().int().min(1).max(32),
  traffic_percent: z.number().int().min(1).max(99),
  cold_standby: z.boolean(),
});

/** 逐步校验表：kind → 每一步 schema（含公共第 1 步） */
export const WIZARD_STEP_SCHEMAS = {
  gpu_vm: [projectRegionSchema, vmStep2Schema, vmStep3Schema, vmStep4Schema, vmStep5Schema],
  gpu_baremetal: [projectRegionSchema, bmStep2Schema, bmStep3Schema, bmStep4Schema, bmStep5Schema],
  vgpu: [projectRegionSchema, vgpuStep2Schema, vgpuStep3Schema, vgpuStep4Schema, vgpuStep5Schema],
  inference: [projectRegionSchema, infStep2Schema, infStep3Schema, infStep4Schema, infStep5Schema],
} as const;

export type WizardKind = keyof typeof WIZARD_STEP_SCHEMAS;
