// 四类向导的分步校验 schema（PRD §4.2.0：进入下一步前必须通过当前步校验）
// 单一来源：本文件枚举与领域类型对齐，禁止在表单里另写一套。
import { z } from 'zod';
import { REGION_LIST, NODE_POOL_LIST } from '../../lib/ids';

const region = z.enum(REGION_LIST as [string, ...string[]]);
const pool = z.enum(NODE_POOL_LIST as [string, ...string[]]);

/** 公共第 1 步：项目与区域（§4.2.0） */
export const projectRegionSchema = z.object({
  project_id: z.number().min(1, '请选择项目（可在下方直接新建）'),
  region,
  name: z
    .string()
    .trim()
    .min(3, '名称至少 3 个字符')
    .max(63, '名称最多 63 个字符'),
  labels: z.array(z.string()).optional(),
});

// ─────────── ① GPU 云服务器 ───────────
export const vmStep2Schema = z.object({
  node_pool: pool,
  gpu_count: z.number().int().min(1, '至少 1 张 GPU').max(8),
  vcpu: z.number().int().min(4),
  memory_gb: z.number().int().min(16),
});
export const vmStep3Schema = z.object({
  image_ref: z.string().min(1, '请选择镜像'),
  system_disk_gb: z
    .number()
    .int()
    .min(40, '系统盘 40–2048 GB')
    .max(2048, '系统盘 40–2048 GB'),
  data_disk_gb: z.number().int().min(0).max(32768),
  system_disk_type: z.enum(['nvme_ssd', 'ssd']),
});
export const vmStep4Schema = z.object({
  vpc: z.string().min(1, '请选择 VPC'),
  subnet: z.string().min(1, '请选择子网'),
  security_group: z.string().min(1, '请选择安全组'),
  public_ip: z.boolean(),
  bandwidth_mbps: z.number().int().min(1).max(1000),
  ssh_pubkey: z.string().min(10, '请填入 SSH 公钥'),
});
export const vmStep5Schema = z.object({
  quantity: z.number().int().min(1, '至少 1 台').max(50, '单次最多 50 台'),
  auto_shutdown_idle_min: z.number().int().min(0).max(120),
});

// ─────────── ② GPU 裸金属（按「台」） ───────────
export const bmStep2Schema = z.object({
  machine_type: pool,
});
export const bmStep3Schema = z.object({
  machine_count: z
    .number()
    .int()
    .min(1, '至少 1 台')
    .max(32, '最多 32 台，批量采购请提工单'),
  passthrough: z.boolean(),
  mig_partition: z.string().optional(),
  raid_level: z.enum(['none', 'raid0', 'raid1', 'raid10']),
});
export const bmStep4Schema = z.object({
  vpc: z.string().min(1, '请选择 VPC'),
  subnet: z.string().min(1, '请选择子网'),
  ib_enabled: z.boolean(),
  ipmi_enabled: z.boolean(),
  bmc_network: z.enum(['shared', 'dedicated']),
});
export const bmStep5Schema = z.object({
  image_ref: z.string().min(1, '请选择 OS 镜像'),
  hostname_prefix: z
    .string()
    .trim()
    .min(2, '主机名前缀至少 2 个字符')
    .max(24, '主机名前缀最多 24 个字符'),
  ssh_pubkey: z.string().min(10, '请填入 SSH 公钥'),
  firmware_baseline: z.enum(['recommended', 'latest']),
});

// ─────────── ③ vGPU（托管 K8s） ───────────
export const vgpuStep2Schema = z.object({
  k8s_version: z.enum(['1.28', '1.29', '1.30', '1.31']),
  control_plane_tier: z.enum(['standard', 'ha']),
  api_server_public: z.boolean(),
});
export const vgpuStep3Schema = z.object({
  pools: z
    .array(
      z.object({
        node_pool: pool,
        node_count: z.number().int().min(1).max(64),
        slicing_policy: z.enum(['none', 'mig', 'time_slicing', 'mps']),
        mig_profile: z.string().optional(),
        time_slice_share: z.number().int().min(2).max(8).optional(),
      }),
    )
    .min(1, '至少需要 1 个节点池')
    .max(5, '最多 5 个节点池'),
});
export const vgpuStep4Schema = z.object({
  vpc: z.string().min(1, '请选择 VPC'),
  subnet: z.string().min(1, '请选择子网'),
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
    model_slug: z.string().min(1, '请选择模型'),
    quantization: z.enum(['bf16', 'fp8', 'fp4', 'awq']),
    max_model_len: z.number().int().min(4096, '上下文 4096–1000000').max(1_000_000),
    concurrency: z.number().int().min(1, '并发至少 1').max(512, '并发最多 512'),
    avg_context_tokens: z.number().int().min(256, '平均上下文至少 256').max(1_000_000),
  })
  .refine((v) => v.avg_context_tokens <= v.max_model_len, {
    message: '平均上下文不得超过最大上下文长度',
    path: ['avg_context_tokens'],
  });
export const infStep3Schema = z.object({
  replicas: z.number().int().min(1, '至少 1 个副本').max(32),
  node_pool: pool,
  gpu_per_replica: z.number().int().min(1).max(8),
  hpa_enabled: z.boolean(),
  hpa_min: z.number().int().min(1),
  hpa_max: z.number().int().min(1).max(64),
  hpa_metric: z.enum(['ttft_p99', 'kv_cache_usage', 'requests_waiting']),
  hpa_target: z.number().min(1),
});
export const infStep4Schema = z.object({
  engine: z.enum(['vllm', 'sglang', 'trt-llm']),
  port: z.number().int().min(1, '端口 1–65535').max(65535),
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
