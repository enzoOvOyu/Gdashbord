// 模型库（MOCK-DATA §8.1 fixtures/models.ts；§6.5 推理语义；§7.3/§7.4 派生入参）
// 权重体积与 KV cache 一律由 params × bytes_per_param 派生，禁止硬编码常量（G2）。
import type { InternalId } from '../../types/domain';

export interface ModelSpec {
  id: InternalId;
  slug: string;
  name: string;
  source: 'hf_mirror' | 'official' | 'community';
  modality: 'llm' | 'diffusion' | 'embedding' | 'rerank' | 'multimodal';
  /** 参数量（B） */
  paramsBillion: number;
  /** 默认精度（用于 weights_gb 与 decode 上界派生） */
  precision: 'bf16' | 'fp8' | 'fp4';
  license: string;
  quantization: string | null;
  description: string;
  contextTokens: number;
  /** KV cache 派生入参（§7.4） */
  layers: number;
  kvHeads: number;
  headDim: number;
  /** 推荐部署形态（单卡可行性校验 §7.3） */
  recommendedPools: Array<'H100_SXM' | 'H200_NVL' | 'B200_NVL72' | 'B300' | 'GB300_NVL72'>;
  minTp: number;
  favorite?: boolean;
}

const BYTES_PER_PARAM = { bf16: 2, fp8: 1, fp4: 0.5 } as const;

/** weights_gb = params × bytes_per_param / 1e9（§7.3，禁止硬编码） */
export function modelWeightsGb(m: ModelSpec): number {
  return Math.round((m.paramsBillion * 1e9 * BYTES_PER_PARAM[m.precision]) / 1e9 * 10) / 10;
}

export const MODELS: ModelSpec[] = [
  {
    id: 1 as InternalId,
    slug: 'llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    source: 'hf_mirror',
    modality: 'llm',
    paramsBillion: 8,
    precision: 'bf16',
    license: 'Llama 3.1 Community',
    quantization: null,
    description: '轻量通用对话模型，单卡可部署，适合开发与小规模在线推理。',
    contextTokens: 131072,
    layers: 32,
    kvHeads: 8,
    headDim: 128, // ⇒ 128 KiB/token（§7.4 锚点）
    recommendedPools: ['H100_SXM', 'H200_NVL'],
    minTp: 1,
    favorite: true,
  },
  {
    id: 2 as InternalId,
    slug: 'llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B Instruct',
    source: 'hf_mirror',
    modality: 'llm',
    paramsBillion: 70,
    precision: 'fp8',
    license: 'Llama 3.1 Community',
    quantization: 'FP8',
    description: '主流 70B 级对话模型，需多卡 TP 部署（单卡 80GB 装不下 BF16 权重）。',
    contextTokens: 131072,
    layers: 80,
    kvHeads: 8,
    headDim: 128,
    recommendedPools: ['H100_SXM', 'H200_NVL', 'B200_NVL72'],
    minTp: 8,
    favorite: true,
  },
  {
    id: 3 as InternalId,
    slug: 'qwen2.5-7b-instruct',
    name: 'Qwen2.5 7B Instruct',
    source: 'hf_mirror',
    modality: 'llm',
    paramsBillion: 7,
    precision: 'bf16',
    license: 'Apache 2.0',
    quantization: null,
    description: '中文能力优异的 7B 模型，单卡部署，性价比高。',
    contextTokens: 32768,
    layers: 28,
    kvHeads: 4,
    headDim: 128,
    recommendedPools: ['H100_SXM'],
    minTp: 1,
  },
  {
    id: 4 as InternalId,
    slug: 'qwen2.5-72b-instruct',
    name: 'Qwen2.5 72B Instruct',
    source: 'hf_mirror',
    modality: 'llm',
    paramsBillion: 72,
    precision: 'fp8',
    license: 'Apache 2.0',
    quantization: 'FP8',
    description: '72B 中文强模型，8 卡 TP 部署，适合高质量在线服务。',
    contextTokens: 32768,
    layers: 80,
    kvHeads: 8,
    headDim: 128,
    recommendedPools: ['H100_SXM', 'H200_NVL', 'B200_NVL72'],
    minTp: 8,
  },
  {
    id: 5 as InternalId,
    slug: 'deepseek-v3',
    name: 'DeepSeek-V3（MoE 671B）',
    source: 'community',
    modality: 'llm',
    paramsBillion: 671,
    precision: 'fp8',
    license: 'MIT',
    quantization: 'FP8',
    description: '稀疏 MoE 架构，激活参数约 37B；需大显存机柜级部署与专家并行。',
    contextTokens: 65536,
    layers: 61,
    kvHeads: 8,
    headDim: 128,
    recommendedPools: ['GB300_NVL72', 'B200_NVL72'],
    minTp: 16,
  },
  {
    id: 6 as InternalId,
    slug: 'sdxl-1.0',
    name: 'Stable Diffusion XL 1.0',
    source: 'community',
    modality: 'diffusion',
    paramsBillion: 2.6,
    precision: 'bf16',
    license: 'CreativeML OpenRAIL',
    quantization: null,
    description: '文生图主流模型，单卡可部署，适合批量出图与 ComfyUI 工作流。',
    contextTokens: 0,
    layers: 0,
    kvHeads: 0,
    headDim: 0,
    recommendedPools: ['H100_SXM'],
    minTp: 1,
  },
  {
    id: 7 as InternalId,
    slug: 'bge-m3',
    name: 'BGE-M3',
    source: 'hf_mirror',
    modality: 'embedding',
    paramsBillion: 0.6,
    precision: 'bf16',
    license: 'Apache 2.0',
    quantization: null,
    description: '多语言稠密+稀疏+多向量检索模型，适合 RAG 召回。',
    contextTokens: 8192,
    layers: 24,
    kvHeads: 16,
    headDim: 64,
    recommendedPools: ['H100_SXM'],
    minTp: 1,
  },
  {
    id: 8 as InternalId,
    slug: 'bce-reranker',
    name: 'BCE Reranker',
    source: 'official',
    modality: 'rerank',
    paramsBillion: 0.3,
    precision: 'bf16',
    license: 'Apache 2.0',
    quantization: null,
    description: '轻量级重排序模型，配合 BGE-M3 提升 RAG 精度。',
    contextTokens: 512,
    layers: 12,
    kvHeads: 12,
    headDim: 64,
    recommendedPools: ['H100_SXM'],
    minTp: 1,
  },
  {
    id: 9 as InternalId,
    slug: 'qwen2-vl-72b',
    name: 'Qwen2-VL 72B',
    source: 'official',
    modality: 'multimodal',
    paramsBillion: 72,
    precision: 'bf16',
    license: 'Apache 2.0',
    quantization: null,
    description: '视觉语言多模态模型，支持图像/视频理解，需多卡部署。',
    contextTokens: 32768,
    layers: 80,
    kvHeads: 8,
    headDim: 128,
    recommendedPools: ['H200_NVL', 'B200_NVL72'],
    minTp: 8,
  },
  {
    id: 10 as InternalId,
    slug: 'glm-4-9b-chat',
    name: 'GLM-4 9B Chat',
    source: 'community',
    modality: 'llm',
    paramsBillion: 9,
    precision: 'bf16',
    license: 'Apache 2.0',
    quantization: null,
    description: '中文对话模型，单卡部署，适合内部助手场景。',
    contextTokens: 128000,
    layers: 40,
    kvHeads: 8,
    headDim: 128,
    recommendedPools: ['H100_SXM'],
    minTp: 1,
  },
];

export const modelBySlug = (slug: string): ModelSpec | undefined =>
  MODELS.find((m) => m.slug === slug);
export const modelById = (id: number): ModelSpec | undefined =>
  MODELS.find((m) => m.id === id);
