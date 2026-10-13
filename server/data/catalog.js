// 目录数据：区域（日本 / 泰国 / 美国）、GPU 型号（H100/H200/B200/B300/GB300）、USD 计价
// 所有面向展示的文案均为 { zh, en } 双语结构

export const CURRENCY = "USD";

// ===== 区域：固定为日本 / 泰国 / 美国 =====
export const REGIONS = [
  {
    id: "JP-TYO-1",
    country: "JP",
    city: { zh: "东京", en: "Tokyo" },
    name: { zh: "日本 · 东京 TYO-1", en: "Japan · Tokyo TYO-1" },
    tier: "Tier III+",
    latency: { zh: "东亚 ~35ms", en: "East Asia ~35ms" },
    power: { zh: "绿电 68%", en: "68% renewable" },
    compliance: ["ISO 27001", "SOC 2", "PIPA"],
    fabric: "400G InfiniBand",
  },
  {
    id: "TH-BKK-1",
    country: "TH",
    city: { zh: "曼谷", en: "Bangkok" },
    name: { zh: "泰国 · 曼谷 BKK-1", en: "Thailand · Bangkok BKK-1" },
    tier: "Tier III",
    latency: { zh: "东南亚 ~25ms", en: "SE Asia ~25ms" },
    power: { zh: "绿电 41%", en: "41% renewable" },
    compliance: ["ISO 27001", "PDPA"],
    fabric: "200G InfiniBand",
  },
  {
    id: "US-LAX-2",
    country: "US",
    city: { zh: "洛杉矶", en: "Los Angeles" },
    name: { zh: "美国 · 洛杉矶 LAX-2", en: "USA · Los Angeles LAX-2" },
    tier: "Tier III+",
    latency: { zh: "美西 ~12ms", en: "US West ~12ms" },
    power: { zh: "绿电 55%", en: "55% renewable" },
    compliance: ["SOC 2", "HIPAA", "ISO 27001"],
    fabric: "400G InfiniBand",
  },
  {
    id: "US-IAD-1",
    country: "US",
    city: { zh: "弗吉尼亚", en: "Ashburn" },
    name: { zh: "美国 · 弗吉尼亚 IAD-1", en: "USA · Ashburn IAD-1" },
    tier: "Tier IV",
    latency: { zh: "美东 ~9ms", en: "US East ~9ms" },
    power: { zh: "绿电 62%", en: "62% renewable" },
    compliance: ["FedRAMP", "SOC 2", "HIPAA", "PCI DSS"],
    fabric: "800G InfiniBand",
  },
];

// ===== GPU 型号：H100 / H200 / B200 / B300 / GB300（价格单位 USD / 卡·小时）=====
export const GPU = [
  {
    id: "H100",
    name: "NVIDIA H100 SXM",
    arch: "Hopper",
    vram: 80,
    cpu: 26,
    ram: 256,
    storage: "1.6 TB NVMe",
    network: "NVLink 4.0 / 400G IB",
    fp8: 1979,
    tdp: 700,
    price: 2.49,
    spot: 0.99,
    reserved: 1.79,
    tag: { zh: "通用大模型训练 / 推理", en: "General LLM training & inference" },
    badge: { zh: "热门", en: "Popular" },
    score: 96,
    stock: { "JP-TYO-1": 96, "TH-BKK-1": 48, "US-LAX-2": 128, "US-IAD-1": 64 },
  },
  {
    id: "H200",
    name: "NVIDIA H200 SXM",
    arch: "Hopper",
    vram: 141,
    cpu: 28,
    ram: 256,
    storage: "2 TB NVMe",
    network: "NVLink 4.0 / 400G IB",
    fp8: 1979,
    tdp: 700,
    price: 3.29,
    spot: 1.32,
    reserved: 2.36,
    tag: { zh: "长上下文推理 / 大显存微调", en: "Long-context inference & fine-tune" },
    badge: { zh: "推荐", en: "Recommended" },
    score: 98,
    stock: { "JP-TYO-1": 64, "TH-BKK-1": 24, "US-LAX-2": 96, "US-IAD-1": 72 },
  },
  {
    id: "B200",
    name: "NVIDIA B200 SXM",
    arch: "Blackwell",
    vram: 180,
    cpu: 32,
    ram: 384,
    storage: "3 TB NVMe",
    network: "NVLink 5.0 / 800G IB",
    fp8: 4500,
    tdp: 1000,
    price: 4.49,
    spot: 1.89,
    reserved: 3.22,
    tag: { zh: "超大模型预训练", en: "Frontier pre-training" },
    badge: { zh: "旗舰", en: "Flagship" },
    score: 99,
    stock: { "JP-TYO-1": 40, "TH-BKK-1": 16, "US-LAX-2": 72, "US-IAD-1": 56 },
  },
  {
    id: "B300",
    name: "NVIDIA B300 SXM",
    arch: "Blackwell Ultra",
    vram: 288,
    cpu: 36,
    ram: 512,
    storage: "4 TB NVMe",
    network: "NVLink 5.0 / 800G IB",
    fp8: 7200,
    tdp: 1200,
    price: 5.99,
    spot: 2.49,
    reserved: 4.31,
    tag: { zh: "超大 MoE / 长上下文推理", en: "Large MoE & long context" },
    badge: { zh: "新上架", en: "New" },
    score: 100,
    stock: { "JP-TYO-1": 24, "TH-BKK-1": 8, "US-LAX-2": 48, "US-IAD-1": 32 },
  },
  {
    id: "GB300",
    name: "NVIDIA GB300 NVL72",
    arch: "Blackwell Ultra (Grace CPU)",
    vram: 288,
    cpu: 72,
    ram: 1024,
    storage: "8 TB NVMe",
    network: { zh: "NVLink 5.0 / 800G IB · NVL72 机架", en: "NVLink 5.0 / 800G IB · NVL72 rack" },
    fp8: 14400,
    tdp: 1400,
    price: 7.49,
    spot: 3.19,
    reserved: 5.39,
    tag: { zh: "机架级一体化训练", en: "Rack-scale integrated training" },
    badge: { zh: "机架级", en: "Rack-scale" },
    score: 100,
    stock: { "JP-TYO-1": 16, "TH-BKK-1": 0, "US-LAX-2": 36, "US-IAD-1": 24 },
  },
];

// ===== 运行环境镜像 =====
export const IMAGES = [
  { id: "pytorch-2.6", name: "PyTorch 2.6 · CUDA 12.8", desc: { zh: "通用训练与调试", en: "General training & debug" } },
  { id: "vllm-0.9", name: "vLLM 0.9 · OpenAI API", desc: { zh: "LLM 高吞吐推理", en: "High-throughput LLM serving" } },
  { id: "sglang-0.4", name: "SGLang 0.4 · RadixAttention", desc: { zh: "低延迟 LLM 服务", en: "Low-latency LLM serving" } },
  { id: "trt-llm", name: "TensorRT-LLM · Triton", desc: { zh: "极致推理性能", en: "Maximum inference perf" } },
  { id: "comfyui", name: "ComfyUI · Diffusion", desc: { zh: "图像 / 视频生成", en: "Image & video generation" } },
  { id: "jupyter", name: "JupyterLab · Data Science", desc: { zh: "交互式分析", en: "Interactive analysis" } },
  { id: "ubuntu-24", name: "Ubuntu 24.04 · CUDA 12.8", desc: { zh: "自定义环境", en: "Custom environment" } },
];

// ===== 推理引擎 =====
export const ENGINES = ["vLLM", "SGLang", "TensorRT-LLM", "Triton", "ComfyUI"];

// ===== 模型目录：按任务类型分组，覆盖主流开源与商用模型 =====
export const MODEL_GROUPS = [
  {
    id: "llm",
    name: { zh: "通用大语言模型", en: "General LLM" },
    models: [
      { id: "llama-4-maverick", name: "Llama 4 Maverick", vendor: "Meta", params: "400B MoE / 17B active", ctx: "1M", license: "Llama 4 Community", vram: 380, engines: ["vLLM", "SGLang", "TensorRT-LLM"] },
      { id: "qwen3-235b", name: "Qwen3-235B-A22B", vendor: "Alibaba", params: "235B MoE / 22B active", ctx: "128K", license: "Apache-2.0", vram: 240, engines: ["vLLM", "SGLang"] },
      { id: "deepseek-v3", name: "DeepSeek-V3-0324", vendor: "DeepSeek", params: "671B MoE / 37B active", ctx: "128K", license: "MIT", vram: 700, engines: ["vLLM", "SGLang"] },
      { id: "gemma-3-27b", name: "Gemma 3 27B IT", vendor: "Google", params: "27B", ctx: "128K", license: "Gemma Terms", vram: 60, engines: ["vLLM", "SGLang"] },
      { id: "mistral-large", name: "Mistral Large 24.11", vendor: "Mistral", params: "123B", ctx: "128K", license: "Research / Commercial", vram: 260, engines: ["vLLM"] },
    ],
  },
  {
    id: "reasoning",
    name: { zh: "推理增强模型", en: "Reasoning models" },
    models: [
      { id: "deepseek-r1", name: "DeepSeek-R1-0528", vendor: "DeepSeek", params: "671B MoE", ctx: "128K", license: "MIT", vram: 700, engines: ["vLLM", "SGLang"] },
      { id: "qwen3-32b-think", name: "Qwen3-32B (Thinking)", vendor: "Alibaba", params: "32B", ctx: "128K", license: "Apache-2.0", vram: 70, engines: ["vLLM", "SGLang"] },
      { id: "gpt-oss-120b", name: "gpt-oss-120b", vendor: "OpenAI (open weights)", params: "120B MoE", ctx: "128K", license: "Apache-2.0", vram: 150, engines: ["vLLM", "TensorRT-LLM"] },
      { id: "qwq-32b", name: "QwQ-32B", vendor: "Alibaba", params: "32B", ctx: "32K", license: "Apache-2.0", vram: 70, engines: ["vLLM"] },
    ],
  },
  {
    id: "small",
    name: { zh: "轻量 / 端侧模型（≤ 32B）", en: "Small & edge models (≤ 32B)" },
    models: [
      { id: "qwen3-8b", name: "Qwen3-8B", vendor: "Alibaba", params: "8B", ctx: "32K", license: "Apache-2.0", vram: 20, engines: ["vLLM", "SGLang"] },
      { id: "llama-3-8b", name: "Llama 3.1 8B Instruct", vendor: "Meta", params: "8B", ctx: "128K", license: "Llama 3.1 Community", vram: 20, engines: ["vLLM"] },
      { id: "gemma-3-4b", name: "Gemma 3 4B IT", vendor: "Google", params: "4B", ctx: "32K", license: "Gemma Terms", vram: 12, engines: ["vLLM"] },
      { id: "phi-4", name: "Phi-4 14B", vendor: "Microsoft", params: "14B", ctx: "16K", license: "MIT", vram: 32, engines: ["vLLM"] },
    ],
  },
  {
    id: "multimodal",
    name: { zh: "多模态 / 视觉语言", en: "Multimodal / VLM" },
    models: [
      { id: "qwen25-vl-72b", name: "Qwen2.5-VL-72B", vendor: "Alibaba", params: "72B", ctx: "128K", license: "Apache-2.0", vram: 160, engines: ["vLLM", "SGLang"] },
      { id: "internvl3-78b", name: "InternVL3-78B", vendor: "OpenGVLab", params: "78B", ctx: "32K", license: "MIT", vram: 170, engines: ["vLLM"] },
      { id: "llama-4-scout", name: "Llama 4 Scout", vendor: "Meta", params: "109B MoE / 17B active", ctx: "10M", license: "Llama 4 Community", vram: 120, engines: ["vLLM"] },
      { id: "pixtral-12b", name: "Pixtral 12B", vendor: "Mistral", params: "12B", ctx: "128K", license: "Apache-2.0", vram: 30, engines: ["vLLM"] },
    ],
  },
  {
    id: "embedding",
    name: { zh: "向量 / Embedding", en: "Embedding" },
    models: [
      { id: "bge-m3", name: "BGE-M3", vendor: "BAAI", params: "568M", ctx: "8K", license: "MIT", vram: 8, engines: ["Triton", "vLLM"] },
      { id: "qwen3-embed-8b", name: "Qwen3-Embedding-8B", vendor: "Alibaba", params: "8B", ctx: "32K", license: "Apache-2.0", vram: 20, engines: ["Triton", "vLLM"] },
      { id: "jina-v4", name: "jina-embeddings-v4", vendor: "Jina AI", params: "3.8B", ctx: "32K", license: "Apache-2.0", vram: 12, engines: ["Triton"] },
    ],
  },
  {
    id: "rerank",
    name: { zh: "重排序 / Reranker", en: "Reranker" },
    models: [
      { id: "bge-reranker-v2", name: "bge-reranker-v2-m3", vendor: "BAAI", params: "568M", ctx: "8K", license: "MIT", vram: 6, engines: ["Triton"] },
      { id: "qwen3-reranker-8b", name: "Qwen3-Reranker-8B", vendor: "Alibaba", params: "8B", ctx: "32K", license: "Apache-2.0", vram: 20, engines: ["Triton", "vLLM"] },
    ],
  },
  {
    id: "diffusion",
    name: { zh: "图像 / 视频生成", en: "Image & video generation" },
    models: [
      { id: "flux1-dev", name: "FLUX.1-dev", vendor: "Black Forest Labs", params: "12B", ctx: "—", license: "Non-commercial", vram: 32, engines: ["ComfyUI", "Triton"] },
      { id: "sd35-large", name: "Stable Diffusion 3.5 Large", vendor: "Stability AI", params: "8B", ctx: "—", license: "Community", vram: 24, engines: ["ComfyUI"] },
      { id: "qwen-image", name: "Qwen-Image", vendor: "Alibaba", params: "20B", ctx: "—", license: "Apache-2.0", vram: 44, engines: ["ComfyUI"] },
      { id: "wan22-t2v", name: "Wan2.2-T2V-A14B", vendor: "Alibaba", params: "14B", ctx: "—", license: "Apache-2.0", vram: 40, engines: ["ComfyUI"] },
    ],
  },
  {
    id: "audio",
    name: { zh: "语音识别 / 语音合成", en: "ASR & TTS" },
    models: [
      { id: "whisper-large-v3", name: "Whisper-Large-v3", vendor: "OpenAI (open weights)", params: "1.5B", ctx: "30s audio", license: "MIT", vram: 10, engines: ["Triton", "vLLM"] },
      { id: "qwen3-asr", name: "Qwen3-ASR-1.7B", vendor: "Alibaba", params: "1.7B", ctx: "streaming", license: "Apache-2.0", vram: 10, engines: ["Triton"] },
    ],
  },
  {
    id: "commercial",
    name: { zh: "商用 API 模型（托管代理）", en: "Commercial APIs (hosted proxy)" },
    models: [
      { id: "gpt-4.1", name: "GPT-4.1", vendor: "OpenAI", params: "未公开", ctx: "1M", license: "Commercial API", vram: 0, engines: ["Proxy"] },
      { id: "claude-sonnet-45", name: "Claude Sonnet 4.5", vendor: "Anthropic", params: "未公开", ctx: "200K", license: "Commercial API", vram: 0, engines: ["Proxy"] },
      { id: "gemini-25-pro", name: "Gemini 2.5 Pro", vendor: "Google", params: "未公开", ctx: "1M", license: "Commercial API", vram: 0, engines: ["Proxy"] },
      { id: "grok-4", name: "Grok 4", vendor: "xAI", params: "未公开", ctx: "256K", license: "Commercial API", vram: 0, engines: ["Proxy"] },
    ],
  },
];

// 扁平模型列表（兼容旧接口）
export const MODELS = MODEL_GROUPS.flatMap((g) => g.models.map((m) => m.name));

export function modelById(id) {
  for (const g of MODEL_GROUPS) {
    const m = g.models.find((x) => x.id === id);
    if (m) return { ...m, group: g.id };
  }
  return null;
}

// ===== 一键集群规格（参考 Lambda 1-Click Clusters）=====
export const CLUSTER_SKUS = [
  { id: "sku-h100-8", name: { zh: "H100 · 8× 单节点", en: "H100 · 8× single node" }, gpu: "H100", gpusPerNode: 8, nodes: 1, totalGpus: 8, cpu: 208, ram: 2048, storage: "2× 3.84 TB NVMe", network: "NVLink + 400G IB", price: 19.92 },
  { id: "sku-h100-16", name: { zh: "H100 · 2 节点 × 8", en: "H100 · 2 nodes × 8" }, gpu: "H100", gpusPerNode: 8, nodes: 2, totalGpus: 16, cpu: 416, ram: 4096, storage: "4× 3.84 TB NVMe", network: "400G IB Fabric", price: 39.84 },
  { id: "sku-h200-8", name: { zh: "H200 · 8× 单节点", en: "H200 · 8× single node" }, gpu: "H200", gpusPerNode: 8, nodes: 1, totalGpus: 8, cpu: 224, ram: 2048, storage: "2× 3.84 TB NVMe", network: "NVLink + 400G IB", price: 26.32 },
  { id: "sku-b200-8", name: { zh: "B200 · 8× 单节点", en: "B200 · 8× single node" }, gpu: "B200", gpusPerNode: 8, nodes: 1, totalGpus: 8, cpu: 256, ram: 3072, storage: "4× 3.84 TB NVMe", network: "NVLink 5.0 + 800G IB", price: 35.92 },
  { id: "sku-b300-32", name: { zh: "B300 · 4 节点 × 8", en: "B300 · 4 nodes × 8" }, gpu: "B300", gpusPerNode: 8, nodes: 4, totalGpus: 32, cpu: 1152, ram: 16384, storage: "8× 7.68 TB NVMe", network: "800G IB Fabric", price: 191.68 },
  { id: "sku-gb300-72", name: { zh: "GB300 NVL72 机架", en: "GB300 NVL72 rack" }, gpu: "GB300", gpusPerNode: 72, nodes: 1, totalGpus: 72, cpu: 5184, ram: 73728, storage: "36× 7.68 TB NVMe", network: { zh: "NVL72 全域 NVLink", en: "NVL72 full NVLink" }, price: 539.28 },
];

// ===== 导航 =====
export const NAV = [
  ["overview", "speedometer2", "总览 Dashboard"],
  ["market", "shop", "GPU 算力市场"],
  ["create", "rocket-takeoff", "部署中心"],
  ["instances", "hdd-stack", "工作空间与实例"],
  ["endpoints", "lightning-charge-fill", "推理服务 Endpoints"],
  ["jobs", "cpu", "训练任务与集群"],
  ["assets", "boxes", "模型与数据资产"],
  ["security", "shield-lock", "API 密钥与权限"],
  ["kubernetes", "hdd-rack", "GPU 集群 K8s"],
  ["monitor", "graph-up-arrow", "可观测性"],
  ["billing", "receipt", "费用与预算"],
  ["admin", "shield-check", "平台管理后台"],
];

export function gpu(id) {
  return GPU.find((x) => x.id === id) || GPU[0];
}

export function region(id) {
  return REGIONS.find((x) => x.id === id) || REGIONS[0];
}

export function stockIn(gpuId, regionId) {
  const g = gpu(gpuId);
  if (!g) return 0;
  if (!regionId) return Object.values(g.stock).reduce((a, b) => a + b, 0);
  return g.stock[regionId] || 0;
}

// 单卡每小时价格（USD）
export function priceOf(gpuId, kind = "price") {
  const g = gpu(gpuId);
  return g ? g[kind] || g.price : 0;
}
