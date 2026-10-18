// 部署向导数据契约（ARCH §12.9 `spec_json` 契约 + PRD §4.2 六步向导）
// requested_spec（订单请求）与 spec_json（实际供给）皆过 Zod，允许存在调度降级差异。
import { z } from 'zod';

// ─────────── 枚举（与 types/domain.ts 单一来源保持一致） ───────────
export const REGION_CODES = ['jp', 'th', 'sg', 'us'] as const;
export const NODE_POOL_CODES = [
  'H100_SXM',
  'H200_NVL',
  'B200_NVL72',
  'B300',
  'GB300_NVL72',
] as const;
export const RESOURCE_KINDS = [
  'gpu_vm',
  'gpu_baremetal',
  'vgpu',
  'inference',
] as const;

export const regionSchema = z.enum(REGION_CODES);
export const nodePoolSchema = z.enum(NODE_POOL_CODES);
export const resourceKindSchema = z.enum(RESOURCE_KINDS);

// ─────────── 四步公共字段 ───────────
const base = {
  /** 实例/集群名称 */
  name: z
    .string()
    .min(2, '名称至少 2 个字符')
    .max(63, '名称最多 63 个字符')
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/, '仅支持字母、数字、- 与 _，且以字母或数字开头'),
  region: regionSchema,
  node_pool: nodePoolSchema,
};

// ─────────── §12.9 spec_json 契约（逐键对齐） ───────────

/** gpu_vm 必需：gpu_model/gpu_count/vcpu/memory_gb/storage_gb/image_ref；可选：env/ports/ssh_pubkey */
export const gpuVmSpecSchema = z.object({
  gpu_model: z.string().min(1, '请选择 GPU 型号'),
  gpu_count: z.number().int().min(1, '至少 1 张 GPU').max(8),
  vcpu: z.number().int().min(2).max(224),
  memory_gb: z.number().min(8).max(2048),
  storage_gb: z.number().min(20, '系统盘至少 20 GB').max(16384),
  image_ref: z.string().min(1, '请选择镜像'),
  env: z.record(z.string()).optional(),
  ports: z.array(z.number().int().min(1).max(65535)).optional(),
  ssh_pubkey: z.string().optional(),
});

/** gpu_baremetal 必需：machine_type/gpu_model/gpu_count/passthrough/cpu_model/local_nvme_gb；可选：ipmi_enabled/ib_enabled */
export const gpuBareMetalSpecSchema = z.object({
  machine_type: z.string().min(1, '请选择机型'),
  gpu_model: z.string().min(1, '请选择 GPU 型号'),
  gpu_count: z.number().int().min(1).max(72),
  passthrough: z.boolean(),
  cpu_model: z.string().min(1),
  local_nvme_gb: z.number().min(0).max(61440),
  ipmi_enabled: z.boolean().optional(),
  ib_enabled: z.boolean().optional(),
});

/** vgpu 必需：k8s_version/node_count/gpu_count/slicing_policy/storage_gb；可选：network_plugin/ingress_enabled */
export const vgpuSpecSchema = z.object({
  k8s_version: z.string().min(1, '请选择 K8s 版本'),
  node_count: z.number().int().min(1, '至少 1 个节点').max(64),
  gpu_count: z.number().int().min(1).max(72),
  slicing_policy: z.string().min(1, '请选择 GPU 切片策略'),
  storage_gb: z.number().min(20).max(32768),
  network_plugin: z.string().optional(),
  ingress_enabled: z.boolean().optional(),
});

/** inference 必需：model_ref/replicas/gpu_count/port/auth_enabled；可选：hpa/traffic_split */
export const inferenceSpecSchema = z.object({
  model_ref: z.string().min(1, '请选择模型'),
  replicas: z.number().int().min(1, '至少 1 个副本').max(64),
  gpu_count: z.number().int().min(1).max(8),
  port: z.number().int().min(1).max(65535),
  auth_enabled: z.boolean(),
  hpa: z
    .object({
      min: z.number().int().min(1),
      max: z.number().int().min(1),
      target: z.string().min(1),
    })
    .optional(),
  traffic_split: z
    .array(z.object({ version: z.string().min(1), weight: z.number().min(0).max(100) }))
    .optional(),
});

export const resourceSpecSchema = z.discriminatedUnion('__kind', [
  z.object({ __kind: z.literal('gpu_vm'), ...gpuVmSpecSchema.shape }),
  z.object({ __kind: z.literal('gpu_baremetal'), ...gpuBareMetalSpecSchema.shape }),
  z.object({ __kind: z.literal('vgpu'), ...vgpuSpecSchema.shape }),
  z.object({ __kind: z.literal('inference'), ...inferenceSpecSchema.shape }),
]);

// ─────────── 向导表单：公共字段 + spec ───────────
export const gpuVmFormSchema = z.object({ ...base, spec: gpuVmSpecSchema });
export const gpuBareMetalFormSchema = z.object({ ...base, spec: gpuBareMetalSpecSchema });
export const vgpuFormSchema = z.object({ ...base, spec: vgpuSpecSchema });
export const inferenceFormSchema = z.object({ ...base, spec: inferenceSpecSchema });

export type GpuVmForm = z.infer<typeof gpuVmFormSchema>;
export type GpuBareMetalForm = z.infer<typeof gpuBareMetalFormSchema>;
export type VgpuForm = z.infer<typeof vgpuFormSchema>;
export type InferenceForm = z.infer<typeof inferenceFormSchema>;
export type WizardForm = GpuVmForm | GpuBareMetalForm | VgpuForm | InferenceForm;

/** 四 kinds 各自的规格 spec 键集合（用于从表单拆出 requested_spec） */
const SPEC_KEYS: Record<string, readonly string[]> = {
  gpu_vm: ['gpu_model', 'gpu_count', 'vcpu', 'memory_gb', 'storage_gb', 'image_ref', 'env', 'ports', 'ssh_pubkey'],
  gpu_baremetal: ['machine_type', 'gpu_model', 'gpu_count', 'passthrough', 'cpu_model', 'local_nvme_gb', 'ipmi_enabled', 'ib_enabled'],
  vgpu: ['k8s_version', 'node_count', 'gpu_count', 'slicing_policy', 'storage_gb', 'network_plugin', 'ingress_enabled'],
  inference: ['model_ref', 'replicas', 'gpu_count', 'port', 'auth_enabled', 'hpa', 'traffic_split'],
};

/** 从表单提取 requested_spec（只保留该 kind 契约内的键） */
export function pickSpec(kind: string, form: unknown): Record<string, unknown> {
  const spec = (form as { spec?: Record<string, unknown> }).spec ?? {};
  const out: Record<string, unknown> = {};
  for (const k of SPEC_KEYS[kind] ?? []) {
    if (spec[k] !== undefined) out[k] = spec[k];
  }
  return out;
}

/** 表单元信息（向导标题、步骤、各 kind 允许的采购层级） */
export const KIND_FORM_META: Record<
  string,
  { title: string; routeKey: string; gpuStepLabel: string; imageStepLabel: string }
> = {
  gpu_vm: {
    title: '新建 GPU 云服务器',
    routeKey: 'gpu-cloud-server',
    gpuStepLabel: '选择节点池与 GPU',
    imageStepLabel: '选择镜像与系统盘',
  },
  gpu_baremetal: {
    title: '新建 GPU 裸金属',
    routeKey: 'gpu-bare-metal',
    gpuStepLabel: '选择机型与 GPU 直通',
    imageStepLabel: '选择操作系统镜像',
  },
  vgpu: {
    title: '新建 vGPU 集群（托管 K8s）',
    routeKey: 'vgpu',
    gpuStepLabel: '选择 K8s 版本与节点池',
    imageStepLabel: '选择 GPU 切片策略（MIG）',
  },
  inference: {
    title: '新建推理服务',
    routeKey: 'inference-service',
    gpuStepLabel: '选择节点池与 GPU',
    imageStepLabel: '选择模型',
  },
};

/** 可选 K8s 版本（CKS 风格） */
export const K8S_VERSIONS = ['v1.34.1', 'v1.33.4', 'v1.32.8', 'v1.31.12'] as const;
/** MIG / Time-Slicing 切片策略（与 gpu-specs.migInstances 同源语义） */
export const NETWORK_PLUGINS = ['Calico', 'Cilium', 'Flannel'] as const;
/** HPA 目标指标口径（服务治理用 QPS/延迟观测，§7.1） */
export const HPA_TARGETS = [
  'gpu_utilization=70',
  'qps=100',
  'p99_latency_ms=500',
] as const;
