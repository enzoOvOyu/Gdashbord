// 部署向导表单层（ARCH §2：React Hook Form + Zod 分步校验）
// Zod 是校验真相源；四种 kind 共用一份扁平 WizardValues，按 kind 分派 schema。
import type { Resolver } from 'react-hook-form';
import type { FieldErrors } from 'react-hook-form';
import type { NodePoolCode, RegionCode, ResourceKind } from '../../types/domain';
import {
  gpuBareMetalFormSchema,
  gpuVmFormSchema,
  inferenceFormSchema,
  resourceKindSchema,
  vgpuFormSchema,
  type WizardForm,
} from './schemas';

/** 向导表单扁平值：所有 kind 字段并列存在，仅渲染与校验当前 kind 所需项 */
export interface WizardValues {
  // 公共
  name: string;
  region: RegionCode;
  node_pool: NodePoolCode;
  // gpu_vm
  gpu_model: string;
  gpu_count: number;
  vcpu: number;
  memory_gb: number;
  storage_gb: number;
  image_ref: string;
  ports: string;
  ssh_pubkey: string;
  envPairs: Array<{ key: string; value: string }>;
  public_ip: boolean;
  // gpu_baremetal
  machine_type: string;
  passthrough: boolean;
  cpu_model: string;
  local_nvme_gb: number;
  ipmi_enabled: boolean;
  ib_enabled: boolean;
  // vgpu
  k8s_version: string;
  node_count: number;
  slicing_policy: string;
  network_plugin: string;
  ingress_enabled: boolean;
  // inference
  model_ref: string;
  replicas: number;
  port: number;
  auth_enabled: boolean;
  hpa_enabled: boolean;
  hpa_min: number;
  hpa_max: number;
  hpa_target: string;
}

const SCHEMAS = {
  gpu_vm: gpuVmFormSchema,
  gpu_baremetal: gpuBareMetalFormSchema,
  vgpu: vgpuFormSchema,
  inference: inferenceFormSchema,
} as const;

/** 把扁平 values 组装成该 kind 的表单对象 {name, region, node_pool, spec} */
export function toPayload(kind: ResourceKind, v: WizardValues): unknown {
  return {
    name: v.name,
    region: v.region,
    node_pool: v.node_pool,
    spec: buildSpec(kind, v),
  };
}

/** 构造 requested_spec（键严格取自 §12.9 契约） */
export function buildSpec(kind: ResourceKind, v: WizardValues): Record<string, unknown> {
  switch (kind) {
    case 'gpu_vm': {
      const env = parseEnv(v);
      const ports = parsePorts(v);
      const key = v.ssh_pubkey.trim();
      return {
        gpu_model: v.gpu_model,
        gpu_count: v.gpu_count,
        vcpu: v.vcpu,
        memory_gb: v.memory_gb,
        storage_gb: v.storage_gb,
        image_ref: v.image_ref,
        ...(Object.keys(env).length > 0 ? { env } : {}),
        ...(ports.length > 0 ? { ports } : {}),
        ...(key ? { ssh_pubkey: key } : {}),
      };
    }
    case 'gpu_baremetal':
      return {
        machine_type: v.machine_type,
        gpu_model: v.gpu_model,
        gpu_count: v.gpu_count,
        passthrough: v.passthrough,
        cpu_model: v.cpu_model,
        local_nvme_gb: v.local_nvme_gb,
        ipmi_enabled: v.ipmi_enabled,
        ib_enabled: v.ib_enabled,
      };
    case 'vgpu':
      return {
        k8s_version: v.k8s_version,
        node_count: v.node_count,
        gpu_count: v.gpu_count,
        slicing_policy: v.slicing_policy,
        storage_gb: v.storage_gb,
        network_plugin: v.network_plugin,
        ingress_enabled: v.ingress_enabled,
      };
    case 'inference':
      return {
        model_ref: v.model_ref,
        replicas: v.replicas,
        gpu_count: v.gpu_count,
        port: v.port,
        auth_enabled: v.auth_enabled,
        ...(v.hpa_enabled
          ? { hpa: { min: v.hpa_min, max: v.hpa_max, target: v.hpa_target } }
          : {}),
      };
    default:
      return {};
  }
}

/** 环境变量键值对 → Record（空键丢弃） */
export function parseEnv(v: WizardValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of v.envPairs ?? []) {
    const k = p.key.trim();
    if (k) out[k] = p.value;
  }
  return out;
}

/** 端口串 → number[]（支持逗号/空格分隔；越界丢弃） */
export function parsePorts(v: WizardValues): number[] {
  return (v.ports ?? '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 65535);
}

/**
 * 按 kind 分派的 resolver：把 Zod 报错路径 `spec.xxx` 映射回扁平字段名，
 * 使 RHF 能将错误定位到具体输入。
 */
export function wizardResolver(kind: ResourceKind): Resolver<WizardValues> {
  return async (values) => {
    const schema = SCHEMAS[kind];
    const result = schema.safeParse(toPayload(kind, values));
    if (result.success) {
      return { values: values as WizardValues, errors: {} };
    }
    const errors: FieldErrors<WizardValues> = {};
    for (const issue of result.error.issues) {
      const p = issue.path;
      const key = p[0] === 'spec' ? String(p[1]) : String(p[0]);
      if (!key) continue;
      // 已存在则保留首个错误，避免后续覆盖
      if (!(errors as Record<string, unknown>)[key]) {
        (errors as Record<string, unknown>)[key] = {
          type: 'validation',
          message: issue.message,
        };
      }
    }
    return { values: {}, errors };
  };
}

/** 六步向导定义（PRD §4.2） */
export const WIZARD_STEPS = [
  { key: 'pool', title: '选型', desc: '区域、名称与 GPU 节点池' },
  { key: 'image', title: '镜像 / 模型', desc: '基础镜像或推理模型' },
  { key: 'spec', title: '规格', desc: '算力、内存与存储' },
  { key: 'network', title: '网络与端口', desc: '网络插件、端口与鉴权' },
  { key: 'env', title: '环境变量', desc: '环境变量与 SSH 公钥' },
  { key: 'confirm', title: '确认', desc: '价格预估与提交' },
] as const;

export type StepKey = (typeof WIZARD_STEPS)[number]['key'];

/** 每步需要校验的字段（RHF trigger 目标），按 kind 区分 */
export function fieldsOfStep(
  kind: ResourceKind,
  step: StepKey,
): Array<keyof WizardValues> {
  switch (step) {
    case 'pool':
      return [
        'name',
        'region',
        'node_pool',
        ...(kind === 'gpu_baremetal' ? (['machine_type'] as Array<keyof WizardValues>) : []),
        ...(kind === 'vgpu' ? (['k8s_version', 'slicing_policy'] as Array<keyof WizardValues>) : []),
      ];
    case 'image':
      return kind === 'inference'
        ? ['model_ref']
        : kind === 'gpu_baremetal'
          ? ['cpu_model', 'local_nvme_gb']
          : ['image_ref'];
    case 'spec':
      return kind === 'vgpu'
        ? ['node_count', 'gpu_count', 'storage_gb']
        : kind === 'inference'
          ? ['replicas', 'gpu_count']
          : ['gpu_count', 'vcpu', 'memory_gb', 'storage_gb'];
    case 'network':
      return kind === 'inference'
        ? ['port', 'auth_enabled']
        : kind === 'vgpu'
          ? ['network_plugin', 'ingress_enabled']
          : kind === 'gpu_baremetal'
            ? ['ipmi_enabled', 'ib_enabled']
            : ['public_ip'];
    case 'env':
      return kind === 'gpu_vm' ? ['ports', 'ssh_pubkey'] : [];
    case 'confirm':
      return kind === 'inference' ? ['hpa_min', 'hpa_max'] : [];
    default:
      return [];
  }
}

/** 初始值：由机型派生默认 CPU/内存/盘，避免无意义硬编码 */
export function defaultValues(
  kind: ResourceKind,
  pool: NodePoolCode,
  region: RegionCode,
  platform: { systemMemoryGb: number },
  gpuName: string,
  extra?: Partial<WizardValues>,
): WizardValues {
  const mem = Math.min(platform.systemMemoryGb, 512);
  return {
    name: '',
    region,
    node_pool: pool,
    gpu_model: gpuName,
    gpu_count: kind === 'gpu_baremetal' ? 8 : 1,
    vcpu: kind === 'gpu_vm' ? 16 : 0,
    memory_gb: kind === 'gpu_vm' ? Math.min(mem, 128) : 0,
    storage_gb: kind === 'gpu_baremetal' ? 0 : 100,
    image_ref: '',
    ports: '',
    ssh_pubkey: '',
    envPairs: [{ key: '', value: '' }],
    public_ip: true,
    machine_type: pool,
    passthrough: true,
    cpu_model: '',
    local_nvme_gb: 0,
    ipmi_enabled: true,
    ib_enabled: true,
    k8s_version: 'v1.34.1',
    node_count: 2,
    slicing_policy: 'none',
    network_plugin: 'Calico',
    ingress_enabled: false,
    model_ref: '',
    replicas: 1,
    port: 8000,
    auth_enabled: true,
    hpa_enabled: false,
    hpa_min: 1,
    hpa_max: 4,
    hpa_target: 'gpu_utilization=70',
    ...extra,
  };
}

export { resourceKindSchema };
export type { WizardForm };
