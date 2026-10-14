// 领域数据种子：区域限定 JP/TH/US，GPU 限定 H100/H200/B200/B300/GB300，金额单位 USD
// 万卡级：机队由 fleet.js 的集群数组承载（约一万张卡），其余资源为活跃负载抽样；所有 KPI 由 state 实算。
import { GPU, REGIONS, IMAGES, MODEL_GROUPS, gpu } from "./catalog.js";
import { buildFleet, fleetFromState } from "./fleet.js";
import { k8sSeed } from "./k8s.js";
import { adminSeed } from "./admin.js";

function rng(seed) {
  let x = seed;
  return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}
const B = (zh, en) => ({ zh, en });
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const between = (r, a, b) => a + Math.floor(r() * (b - a + 1));

const GPU_IDS = GPU.map((g) => g.id);
const REGION_IDS = REGIONS.map((r) => r.id);
const IMAGE_IDS = IMAGES.map((i) => i.id);

// 租户按 tier 分层采样：大任务主要归企业客户，小负载向中小客户倾斜
const TENANT_ENTERPRISE = ["Nexa AI Labs", "Helios Bio", "Meridian Auto", "Kestrel Finance", "Sakura Robotics", "Orion Research", "Atlas Frontier", "Quantum Grid AI"];
const TENANT_SCALE = ["Siam Media Tech", "Pacific Vision", "Aster Data", "Lumen Robotics", "Nova Studios", "Banyan Compute", "Cedar Analytics", "Ironwood Labs"];
const TENANT_SMALL = ["Bangkok Fintech", "Ratchada Tech", "Mekong Vision", "Aichi Robotics", "Kansai Media", "Downtown AI", "Beacon ML", "Harbor Genomics"];
const TENANT_NAMES = [...TENANT_ENTERPRISE, ...TENANT_SCALE, ...TENANT_SMALL];
// 大负载(训练任务) 70% 企业 / 30% 中型；小负载(实例/端点) 40/35/25 分层
let entCursor = 0;
const tenantForJob = (r) => {
  // 前 8 个大任务轮转分给每家企业客户（保底千卡级用量），之后 70/30 抽样
  if (entCursor < TENANT_ENTERPRISE.length) return TENANT_ENTERPRISE[entCursor++];
  return (r() < 0.7 ? TENANT_ENTERPRISE : TENANT_SCALE)[Math.floor(r() * (r() < 0.7 ? TENANT_ENTERPRISE.length : TENANT_SCALE.length))];
};
const tenantForSmall = (r) => {
  const roll = r();
  const pool = roll < 0.4 ? TENANT_ENTERPRISE : roll < 0.75 ? TENANT_SCALE : TENANT_SMALL;
  return pool[Math.floor(r() * pool.length)];
};

const DATASETS = ["nlp-corpus-v3", "vision-dataset", "pretrain-tokens", "rlhf-preference", "speech-th-v1", "code-corpus-2t", "multimodal-web-1b", "math-reasoning-9m", "chemistry-mol-44m", "bio-genome-12tb"];
const TEMPLATES = ["PyTorch DDP", "DeepSpeed ZeRO", "FSDP", "Megatron-Core", "Ray Train", "SLURM Batch", "NeMo"];
const JOB_TYPES = [
  { id: "pretrain", name: B("分布式预训练", "Distributed pre-training") },
  { id: "sft", name: B("监督微调 SFT", "Supervised fine-tune") },
  { id: "lora", name: B("LoRA 微调", "LoRA fine-tune") },
  { id: "rlhf", name: B("RLHF / 对齐", "RLHF / alignment") },
  { id: "eval", name: B("批量评估", "Batch evaluation") },
  { id: "inference-train", name: B("推理蒸馏", "Distillation") },
  { id: "multimodal", name: B("多模态训练", "Multimodal training") },
];

function gpuForVram(vram) {
  if (vram >= 600) return pick(Math.random, ["B300", "GB300"]) ? "B300" : "GB300";
  if (vram >= 240) return "B200";
  if (vram >= 120) return "H200";
  return "H100";
}

// 生成工作空间实例
function genInstances(r) {
  const kinds = [
    B("开发工作空间", "Workspace"), B("AI 应用环境", "AI app runtime"), B("数据处理", "Data processing"),
    B("训练开发", "Training dev"), B("大规模实验", "Large-scale lab"), B("推理调试", "Inference debug"),
  ];
  const out = [];
  const n = 26;
  for (let i = 0; i < n; i++) {
    const g = pick(r, GPU_IDS);
    const region = pick(r, REGION_IDS);
    const count = [1, 1, 2, 4, 8][Math.floor(r() * 5)];
    const status = r() > 0.16 ? "running" : "stopped";
    out.push({
      id: "ws-" + String(i + 1).padStart(3, "0"),
      name: `${pick(r, ["llm", "vision", "data", "finetune", "agent", "rag", "moec", "diffusion", "asr", "rl"])}_${pick(r, ["lab", "ws", "dev", "exp", "srv", "nb"])}${between(r, 1, 99)}`,
      gpu: g,
      count,
      region,
      image: pick(r, IMAGE_IDS),
      status,
      kind: pick(r, kinds),
      age: B(`${between(r, 1, 30)}天 ${between(r, 1, 23)}小时`, `${between(r, 1, 30)}d ${between(r, 1, 23)}h`),
      ip: status === "running" ? `203.0.113.${between(r, 10, 250)}` : "—",
      disk: pick(r, [100, 200, 500, 1000, 2000]),
      ssh: r() > 0.4,
      jupyter: r() > 0.5,
      tenant: tenantForSmall(r),
    });
  }
  return out;
}

// 生成推理端点
function genEndpoints(r) {
  const allModels = MODEL_GROUPS.flatMap((g) => g.models.map((m) => ({ ...m, group: g.id })));
  const out = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const m = pick(r, allModels);
    const engine = (m.engines || ["vLLM"]).find((e) => e !== "Proxy") || "vLLM";
    const g = gpuForVram(m.vram || 40);
    const gpusPerReplica = m.vram >= 600 ? between(r, 4, 8) : m.vram >= 240 ? between(r, 2, 4) : between(r, 1, 2);
    const region = pick(r, REGION_IDS);
    const statusRoll = r();
    const status = statusRoll > 0.86 ? "degraded" : statusRoll > 0.8 ? "scaled-zero" : statusRoll > 0.74 ? "warming" : "healthy";
    const min = r() > 0.5 ? 0 : between(r, 1, 2);
    const max = between(r, 4, 32);
    const replicas = status === "scaled-zero" ? 0 : between(r, min, Math.min(max, 8));
    const qps = +(r() * 240).toFixed(1);
    const p95 = between(r, 90, 1200);
    const p50 = Math.round(p95 * (0.4 + r() * 0.2));
    const requests = between(r, 4000, 2_400_000);
    const tps = Math.round(qps * between(r, 80, 2400));
    out.push({
      id: "ep-" + String(i + 1).padStart(3, "0"),
      name: `${m.id}-${pick(r, ["prod", "staging", "v1", "edge", "eu", "us", "jp", "th"])}`,
      modelId: m.id,
      model: m.name,
      group: m.group,
      engine,
      gpu: g,
      gpusPerReplica,
      region,
      zone: REGIONS.find((x) => x.id === region)?.zones[between(r, 0, 2)]?.id || region,
      status,
      min, max,
      qps, p50, p95,
      replicas,
      requests,
      tokensPerSec: tps,
      errorRate: +(r() * (status === "degraded" ? 4.5 : 0.8)).toFixed(2),
      gpuUtil: status === "scaled-zero" ? 0 : between(r, 38, 92),
      version: `v${between(r, 1, 3)}.${between(r, 0, 9)}.${between(r, 0, 9)}`,
      created: `2026-${String(between(r, 1, 9)).padStart(2, "0")}-${String(between(r, 1, 28)).padStart(2, "0")}`,
      tenant: tenantForSmall(r),
      dailyCost: +(replicas * gpusPerReplica * gpu(g).price * 24).toFixed(2),
    });
  }
  return out;
}

// 生成训练任务（规模对齐万卡平台：主力训练 128–1024 卡；按池剩余容量封顶，保证可完整放置）
function genJobs(r, clusters) {
  const out = [];
  const n = 34;
  // 区域容量加权放置（US-IAD 34% / US-LAX 28% / JP-TYO 24% / TH-BKK 14%，与机队分布一致）
  const REGION_WEIGHTS = [["US-IAD-1", 34], ["US-LAX-2", 28], ["JP-TYO-1", 24], ["TH-BKK-1", 14]];
  const weightedRegion = (rr) => {
    let roll = rr() * 100;
    for (const [rid, w] of REGION_WEIGHTS) { roll -= w; if (roll <= 0) return rid; }
    return "US-IAD-1";
  };
  // 追踪每个 区域×型号 池的已占用卡数，保证任务规模不超过池容量 × 92%
  const poolCap = {};
  clusters.forEach((c) => {
    if (c.status === "provisioning") return;
    const k = c.region + ":" + c.gpu;
    poolCap[k] = (poolCap[k] || 0) + c.count;
  });
  const poolUsed = {};
  for (let i = 0; i < n; i++) {
    const t = pick(r, JOB_TYPES);
    let g = pick(r, GPU_IDS);
    let region = weightedRegion(r);
    // 该池剩余可放置容量不足 8 卡时，换一个有空间的池
    for (let tries = 0; tries < 8 && (poolCap[region + ":" + g] || 0) - (poolUsed[region + ":" + g] || 0) < 64; tries++) {
      g = pick(r, GPU_IDS);
      region = weightedRegion(r);
    }
    const avail = (poolCap[region + ":" + g] || 0) - (poolUsed[region + ":" + g] || 0);
    if (avail < 8) continue; // 全平台已无整池空间，跳过
    const gpNode = g === "GB300" ? 72 : 8;
    // 目标规模取 剩余空间 与 设计规模 的较小值（大型任务优先占满池）
    const designed = pick(r, g === "GB300" ? [144, 216, 288] : [512, 640, 768, 896, 1024, 1152, 1280, 1536]);
    const count = Math.max(8, Math.min(designed, Math.floor(avail / 8) * 8));
    const nodes = Math.max(1, Math.round(count / gpNode));
    poolUsed[region + ":" + g] = (poolUsed[region + ":" + g] || 0) + count;
    const statusRoll = r();
    const status = statusRoll > 0.32 ? "running" : statusRoll > 0.22 ? "queued" : statusRoll > 0.14 ? "completed" : statusRoll > 0.08 ? "failed" : "preempted";
    const progress = status === "running" ? between(r, 3, 96) : status === "completed" ? 100 : status === "queued" ? 0 : between(r, 10, 80);
    const hours = status === "running" ? between(r, 1, 280) : between(r, 1, 80);
    const price = gpu(g).price;
    const cost = +((status === "completed" || status === "running" || status === "failed") ? count * price * hours : 0).toFixed(2);
    const throughput = g === "GB300" ? between(r, 8000, 26000) : between(r, 800, 9000);
    out.push({
      id: "job-" + String(i + 1).padStart(3, "0"),
      name: `${pick(r, ["moe", "llama", "qwen", "deepseek", "nemotron", "vision", "diffusion", "rlhf", "multimodal", "pretrain", "sft", "rl"])}_${pick(r, ["1t", "70b", "235b", "stage2", "v3", "x", "pro", "exp"])}_${between(r, 1, 99)}`,
      type: t.name,
      typeId: t.id,
      gpu: g,
      count,
      nodes,
      region,
      status,
      progress,
      duration: B(status === "running" ? `${between(r, 1, 200)}天 ${between(r, 1, 23)}小时` : status === "queued" ? "—" : `${between(r, 1, 40)}小时`, status === "running" ? `${between(r, 1, 200)}d ${between(r, 1, 23)}h` : status === "queued" ? "—" : `${between(r, 1, 40)}h`),
      eta: status === "running" ? B(`${between(r, 1, 72)}小时`, `${between(r, 1, 72)}h`) : "—",
      dataset: pick(r, DATASETS),
      goodput: status === "running" ? between(r, 52, 97) : status === "completed" ? between(r, 70, 96) : 0,
      cost,
      priority: pick(r, [B("Critical", "Critical"), B("High", "High"), B("Normal", "Normal"), B("Low", "Low")]),
      template: pick(r, TEMPLATES),
      image: pick(r, IMAGE_IDS),
      epoch: between(r, 1, 4),
      stage: pick(r, [B("预训练", "Pre-train"), B("微调", "Fine-tune"), B("对齐", "Alignment"), B("评估", "Eval")]),
      throughput,
      checkpoint: B(`step ${between(r, 100, 9000)}`, `step ${between(r, 100, 9000)}`),
      tenant: tenantForJob(r),
      clusterId: clusters.length ? clusters[Math.floor(r() * clusters.length)].id : null,
    });
  }
  return out;
}

// 生成资产
function genAssets(r) {
  const models = [
    { name: "Qwen3-235B-A22B", task: B("通用 LLM", "General LLM"), params: "235B MoE", license: "Apache-2.0", size: "470 GB", version: "v1.2", source: "Hugging Face", date: B("今天 10:42", "Today 10:42"), downloads: 1284, acl: B("组织内可读", "Org read") },
    { name: "DeepSeek-R1-0528", task: B("推理增强", "Reasoning"), params: "671B MoE", license: "MIT", size: "1.4 TB", version: "v1.0", source: "Model Registry", date: B("昨天 18:20", "Yesterday 18:20"), downloads: 642, acl: B("私有", "Private") },
    { name: "FLUX.1-dev", task: B("图像生成", "Image generation"), params: "12B", license: "Non-commercial", size: "23 GB", version: "v2.1", source: "Hugging Face", date: B("今天 09:05", "Today 09:05"), downloads: 3186, acl: B("公开只读", "Public read") },
    { name: "BGE-M3", task: B("Embedding", "Embedding"), params: "568M", license: "MIT", size: "2.4 GB", version: "v1.0", source: "Hugging Face", date: B("10月09日", "Oct 09"), downloads: 2941, acl: B("组织内可读", "Org read") },
    { name: "Qwen2.5-VL-72B", task: B("多模态", "Multimodal"), params: "72B", license: "Apache-2.0", size: "152 GB", version: "v0.9", source: "Model Registry", date: B("10月08日", "Oct 08"), downloads: 873, acl: B("私有", "Private") },
    { name: "Whisper-Large-v3", task: B("语音识别", "ASR"), params: "1.5B", license: "MIT", size: "6.2 GB", version: "v3", source: "Hugging Face", date: B("10月06日", "Oct 06"), downloads: 1502, acl: B("公开只读", "Public read") },
    { name: "Llama-4-Maverick", task: B("通用 LLM", "General LLM"), params: "400B MoE", license: "Llama 4 Community", size: "760 GB", version: "v0.1", source: "Model Registry", date: B("10月11日", "Oct 11"), downloads: 980, acl: B("私有", "Private") },
    { name: "Qwen3-32B", task: B("轻量 LLM", "Small LLM"), params: "32B", license: "Apache-2.0", size: "64 GB", version: "v2.0", source: "Hugging Face", date: B("10月03日", "Oct 03"), downloads: 4512, acl: B("组织内可读", "Org read") },
    { name: "DeepSeek-V3-0324", task: B("通用 LLM", "General LLM"), params: "671B MoE", license: "MIT", size: "1.3 TB", version: "v1.1", source: "Model Registry", date: B("10月05日", "Oct 05"), downloads: 1520, acl: B("私有", "Private") },
    { name: "Wan2.2-T2V-A14B", task: B("视频生成", "Video generation"), params: "14B", license: "Apache-2.0", size: "34 GB", version: "v1.0", source: "Hugging Face", date: B("10月01日", "Oct 01"), downloads: 2210, acl: B("公开只读", "Public read") },
    { name: "Qwen3-EMB-8B", task: B("Embedding", "Embedding"), params: "8B", license: "Apache-2.0", size: "16 GB", version: "v1.0", source: "Model Registry", date: B("09月28日", "Sep 28"), downloads: 1320, acl: B("组织内可读", "Org read") },
    { name: "InternVL3-78B", task: B("多模态", "Multimodal"), params: "78B", license: "MIT", size: "162 GB", version: "v0.3", source: "Hugging Face", date: B("09月25日", "Sep 25"), downloads: 612, acl: B("私有", "Private") },
    { name: "GPT-OSS-120B", task: B("推理增强", "Reasoning"), params: "120B MoE", license: "Apache-2.0", size: "240 GB", version: "v1.0", source: "Hugging Face", date: B("09月22日", "Sep 22"), downloads: 1980, acl: B("组织内可读", "Org read") },
    { name: "Stable-Diffusion-3.5", task: B("图像生成", "Image generation"), params: "8B", license: "Community", size: "18 GB", version: "v1.0", source: "Hugging Face", date: B("09月20日", "Sep 20"), downloads: 4021, acl: B("公开只读", "Public read") },
    { name: "Qwen3-ASR-1.7B", task: B("语音识别", "ASR"), params: "1.7B", license: "Apache-2.0", size: "3.4 GB", version: "v1.0", source: "Model Registry", date: B("09月18日", "Sep 18"), downloads: 870, acl: B("组织内可读", "Org read") },
    { name: "Phi-4-14B", task: B("轻量 LLM", "Small LLM"), params: "14B", license: "MIT", size: "28 GB", version: "v1.0", source: "Hugging Face", date: B("09月15日", "Sep 15"), downloads: 2630, acl: B("公开只读", "Public read") },
  ];
  const datasets = [
    { name: "nlp-corpus-v3", type: B("文本语料", "Text corpus"), rows: "84 亿 tokens", format: "JSONL / Parquet", license: "CC-BY-4.0", size: "1.8 TB", gb: 1843, storageClass: B("对象存储", "Object storage"), region: "JP-TYO-1", source: "内部采集", date: B("今天 09:15", "Today 09:15") },
    { name: "vision-dataset", type: B("图像数据", "Image data"), rows: "1,240 万张", format: "WebDataset", license: "内部", size: "640 GB", gb: 640, storageClass: B("共享文件系统", "Shared filesystem"), region: "US-LAX-2", source: "标注平台", date: B("10月10日", "Oct 10") },
    { name: "pretrain-tokens", type: B("预训练语料", "Pre-training corpus"), rows: "2.6 万亿 tokens", format: "Parquet", license: "内部", size: "12.4 TB", gb: 12698, storageClass: B("对象存储", "Object storage"), region: "US-IAD-1", source: "数据工程组", date: B("10月08日", "Oct 08") },
    { name: "rlhf-preference", type: B("偏好数据", "Preference data"), rows: "86 万条", format: "JSONL", license: "内部", size: "42 GB", gb: 42, storageClass: B("共享文件系统", "Shared filesystem"), region: "JP-TYO-1", source: "标注平台", date: B("10月05日", "Oct 05") },
    { name: "speech-th-v1", type: B("泰语语音", "Thai speech"), rows: "3,200 小时", format: "WAV / JSON", license: "CC-BY-SA", size: "310 GB", gb: 310, storageClass: B("对象存储", "Object storage"), region: "TH-BKK-1", source: "合作方授权", date: B("10月02日", "Oct 02") },
    { name: "code-corpus-2t", type: B("代码语料", "Code corpus"), rows: "2 万亿 tokens", format: "Parquet", license: "内部", size: "9.1 TB", gb: 9318, storageClass: B("对象存储", "Object storage"), region: "US-IAD-1", source: "开源清洗", date: B("09月30日", "Sep 30") },
    { name: "multimodal-web-1b", type: B("多模态数据", "Multimodal"), rows: "10 亿样本", format: "WebDataset", license: "内部", size: "22 TB", gb: 22528, storageClass: B("对象存储", "Object storage"), region: "US-LAX-2", source: "爬虫管线", date: B("09月26日", "Sep 26") },
    { name: "math-reasoning-9m", type: B("数学推理", "Math reasoning"), rows: "900 万题", format: "JSONL", license: "内部", size: "120 GB", gb: 120, storageClass: B("共享文件系统", "Shared filesystem"), region: "JP-TYO-1", source: "合成生成", date: B("09月23日", "Sep 23") },
    { name: "chemistry-mol-44m", type: B("分子数据", "Molecular"), rows: "4,400 万分子", format: "SDF / Parquet", license: "CC-BY", size: "380 GB", gb: 380, storageClass: B("对象存储", "Object storage"), region: "US-LAX-2", source: "合作实验室", date: B("09月19日", "Sep 19") },
    { name: "bio-genome-12tb", type: B("基因组数据", "Genomics"), rows: "3.2 万样本", format: "BAM / Parquet", license: "受限", size: "12 TB", gb: 12288, storageClass: B("共享文件系统", "Shared filesystem"), region: "US-IAD-1", source: "医学合作", date: B("09月16日", "Sep 16") },
  ];
  const images = [
    { name: "pytorch-2.6-cu128", type: B("官方镜像", "Official"), base: "Ubuntu 24.04", cuda: "CUDA 12.8", size: "12.8 GB", version: "v2.6", scan: B("无高危漏洞", "No critical CVE"), source: "Registry", date: B("今天 11:20", "Today 11:20"), pulls: 4821 },
    { name: "vllm-openai-server", type: B("推理镜像", "Inference"), base: "Ubuntu 22.04", cuda: "CUDA 12.8", size: "9.2 GB", version: "v0.9", scan: B("2 个中危", "2 medium CVE"), source: "Registry", date: B("10月11日", "Oct 11"), pulls: 2140 },
    { name: "sglang-runtime", type: B("推理镜像", "Inference"), base: "Ubuntu 22.04", cuda: "CUDA 12.8", size: "8.6 GB", version: "v0.4", scan: B("无高危漏洞", "No critical CVE"), source: "Registry", date: B("10月09日", "Oct 09"), pulls: 1188 },
    { name: "comfyui-stable", type: B("社区镜像", "Community"), base: "Ubuntu 22.04", cuda: "CUDA 12.4", size: "18.6 GB", version: "v1.4", scan: B("5 个中危", "5 medium CVE"), source: "Registry", date: B("10月08日", "Oct 08"), pulls: 3672 },
    { name: "megatron-nemo2", type: B("训练镜像", "Training"), base: "Ubuntu 22.04", cuda: "CUDA 12.8", size: "16.4 GB", version: "v2.1", scan: B("无高危漏洞", "No critical CVE"), source: "Registry", date: B("10月06日", "Oct 06"), pulls: 964 },
    { name: "deepspeed-0712", type: B("训练镜像", "Training"), base: "Ubuntu 22.04", cuda: "CUDA 12.8", size: "15.1 GB", version: "v0.16", scan: B("1 个中危", "1 medium CVE"), source: "Registry", date: B("10月04日", "Oct 04"), pulls: 1422 },
    { name: "jax-paxml", type: B("训练镜像", "Training"), base: "Debian 12", cuda: "CUDA 12.8", size: "13.8 GB", version: "v1.3", scan: B("无高危漏洞", "No critical CVE"), source: "Registry", date: B("10月02日", "Oct 02"), pulls: 522 },
    { name: "ray-train-2.4", type: B("分布式训练", "Distributed"), base: "Ubuntu 22.04", cuda: "CUDA 12.8", size: "11.2 GB", version: "v2.4", scan: B("无高危漏洞", "No critical CVE"), source: "Registry", date: B("09月29日", "Sep 29"), pulls: 877 },
    { name: "tensorrt-llm", type: B("推理镜像", "Inference"), base: "Ubuntu 22.04", cuda: "CUDA 12.8", size: "14.0 GB", version: "v1.0", scan: B("3 个中危", "3 medium CVE"), source: "Registry", date: B("09月27日", "Sep 27"), pulls: 1633 },
    { name: "jupyter-ds", type: B("数据科学", "Data science"), base: "Ubuntu 22.04", cuda: "CUDA 12.8", size: "9.8 GB", version: "v3.2", scan: B("无高危漏洞", "No critical CVE"), source: "Registry", date: B("09月24日", "Sep 24"), pulls: 5210 },
  ];
  const volumes = [
    { name: "shared-model-cache", type: B("高性能共享存储", "High-perf shared"), size: "8 TB", gb: 8192, used: 62, mount: "/models", mode: "RWX", iops: "120K", region: "JP-TYO-1", encrypted: true, snapshot: B("每日 02:00", "Daily 02:00"), date: B("今天 10:10", "Today 10:10") },
    { name: "training-checkpoints", type: B("持久卷", "Persistent volume"), size: "40 TB", gb: 40960, used: 47, mount: "/checkpoints", mode: "RWX", iops: "80K", region: "US-IAD-1", encrypted: true, snapshot: B("每 6 小时", "Every 6h"), date: B("10月09日", "Oct 09") },
    { name: "team-datasets", type: B("对象存储桶", "Object bucket"), size: "120 TB", gb: 122880, used: 38, mount: "s3://team-datasets", mode: "S3", iops: "—", region: "US-LAX-2", encrypted: true, snapshot: B("版本控制已开启", "Versioning on"), date: B("10月08日", "Oct 08") },
    { name: "bkk-scratch", type: B("本地高速盘", "Local scratch"), size: "4 TB", gb: 4096, used: 21, mount: "/scratch", mode: "RWO", iops: "500K", region: "TH-BKK-1", encrypted: false, snapshot: B("无", "None"), date: B("10月04日", "Oct 04") },
    { name: "inference-weights", type: B("高性能共享存储", "High-perf shared"), size: "16 TB", gb: 16384, used: 73, mount: "/weights", mode: "RWX", iops: "140K", region: "US-IAD-1", encrypted: true, snapshot: B("每日 04:00", "Daily 04:00"), date: B("10月03日", "Oct 03") },
    { name: "europe-model-mirror", type: B("对象存储桶", "Object bucket"), size: "60 TB", gb: 61440, used: 51, mount: "s3://eu-mirror", mode: "S3", iops: "—", region: "US-LAX-2", encrypted: true, snapshot: B("版本控制已开启", "Versioning on"), date: B("09月30日", "Sep 30") },
    { name: "pretrain-corpus-cache", type: B("高性能共享存储", "High-perf shared"), size: "96 TB", gb: 98304, used: 64, mount: "/corpus", mode: "RWX", iops: "200K", region: "US-IAD-1", encrypted: true, snapshot: B("每日 03:00", "Daily 03:00"), date: B("09月28日", "Sep 28") },
    { name: "tokyo-fast-ssd", type: B("本地高速盘", "Local scratch"), size: "8 TB", gb: 8192, used: 44, mount: "/local", mode: "RWO", iops: "480K", region: "JP-TYO-1", encrypted: true, snapshot: B("无", "None"), date: B("09月26日", "Sep 26") },
    { name: "multimodal-blob", type: B("对象存储桶", "Object bucket"), size: "220 TB", gb: 225280, used: 29, mount: "s3://mm-blob", mode: "S3", iops: "—", region: "US-LAX-2", encrypted: true, snapshot: B("版本控制已开启", "Versioning on"), date: B("09月22日", "Sep 22") },
    { name: "genomics-fs", type: B("共享文件系统", "Shared filesystem"), size: "28 TB", gb: 28672, used: 58, mount: "/genomics", mode: "RWX", iops: "90K", region: "US-IAD-1", encrypted: true, snapshot: B("每 12 小时", "Every 12h"), date: B("09月20日", "Sep 20") },
    { name: "bkk-dataset-fs", type: B("共享文件系统", "Shared filesystem"), size: "12 TB", gb: 12288, used: 41, mount: "/data", mode: "RWX", iops: "70K", region: "TH-BKK-1", encrypted: true, snapshot: B("每日 05:00", "Daily 05:00"), date: B("09月18日", "Sep 18") },
    { name: "backup-archive", type: B("归档存储", "Archive"), size: "320 TB", gb: 327680, used: 67, mount: "s3://backup", mode: "S3-Glacier", iops: "—", region: "US-IAD-1", encrypted: true, snapshot: B("生命周期归档", "Lifecycle"), date: B("09月15日", "Sep 15") },
  ];
  const acl = [
    { resource: "shared-model-cache", grantee: B("算法研究组", "Research group"), perm: B("读写", "Read/Write"), scope: B("项目内", "Project"), expire: "—" },
    { resource: "training-checkpoints", grantee: B("训练流水线 SA", "Training pipeline SA"), perm: B("读写", "Read/Write"), scope: B("组织", "Organization"), expire: "—" },
    { resource: "DeepSeek-R1-0528", grantee: B("Nexa AI Labs", "Nexa AI Labs"), perm: B("只读", "Read"), scope: B("外部租户", "External tenant"), expire: "2026-12-31" },
    { resource: "team-datasets", grantee: B("数据工程组", "Data engineering"), perm: B("管理", "Admin"), scope: B("组织", "Organization"), expire: "—" },
    { resource: "FLUX.1-dev", grantee: B("公开访问", "Public"), perm: B("只读", "Read"), scope: B("互联网", "Internet"), expire: "—" },
    { resource: "pretrain-corpus-cache", grantee: B("大模型训练组", "LLM Training"), perm: B("读写", "Read/Write"), scope: B("组织", "Organization"), expire: "—" },
    { resource: "inference-weights", grantee: B("在线推理组", "Online Inference"), perm: B("读写", "Read/Write"), scope: B("项目内", "Project"), expire: "—" },
    { resource: "genomics-fs", grantee: B("Helios Bio", "Helios Bio"), perm: B("读写", "Read/Write"), scope: B("外部租户", "External tenant"), expire: "2027-03-01" },
  ];
  return { models, datasets, images, volumes, acl };
}

// 生成事件流
function genEvents(r) {
  const base = [
    { level: "warning", text: B("qwen-chat-prod p95 延迟超过 200ms", "qwen-chat-prod p95 latency above 200ms") },
    { level: "success", text: B("训练任务 moe-1t-pretrain 已保存 checkpoint", "Job moe-1t-pretrain saved a checkpoint") },
    { level: "info", text: B("image-generation 自动扩容至 2 副本", "image-generation autoscaled to 2 replicas") },
    { level: "info", text: B("共享卷 shared-model-cache 已挂载到 3 个工作空间", "shared-model-cache mounted into 3 workspaces") },
    { level: "warning", text: B("曼谷区域 B300 库存为 0，任务转入排队", "Bangkok B300 inventory is 0, job queued") },
    { level: "success", text: B("GB300 机架 cl-0012 通过 NCCL 带宽自检", "GB300 rack cl-0012 passed NCCL bandwidth test") },
    { level: "warning", text: B("美东 IAD-1 区域电力使用率突破 91%", "US-IAD-1 power usage exceeded 91%") },
    { level: "info", text: B("推理网关完成灰度发布 v3.4.1", "Inference gateway rolled out v3.4.1") },
    { level: "success", text: B("节点池 gpu-h100-iad 自动扩容 +12 节点", "Pool gpu-h100-iad autoscaled +12 nodes") },
    { level: "error", text: B("节点 cks-b200-iad-g007 NVLink 链路降级", "Node cks-b200-iad-g007 NVLink link degraded") },
    { level: "info", text: B("对象存储团队数据集桶开启版本控制", "Object bucket team-datasets versioning enabled") },
    { level: "warning", text: B("租户 Aster Data 配额使用率 94%", "Tenant Aster Data quota at 94%") },
    { level: "success", text: B("月度账单已生成并推送至 12 个租户", "Monthly invoices generated for 12 tenants") },
    { level: "info", text: B("新租户 Nova Studios 完成入驻与配额下发", "Tenant Nova Studios onboarded with quota") },
    { level: "warning", text: B("东京区域液冷回路温度波动 +3°C", "Tokyo liquid-cooling loop temp +3°C") },
    { level: "success", text: B("GB300 NVL72 机架在 IAD-1 扩容至 14 台", "GB300 NVL72 racks expanded to 14 in IAD-1") },
  ];
  // 打散并生成时间
  return base.map((e, i) => ({ ...e, time: `${String(23 - Math.floor(i / 2)).padStart(2, "0")}:${String(between(r, 1, 59)).padStart(2, "0")}` }));
}

// 生成密钥与 Secret
function genKeys(r) {
  const names = ["production-inference", "research-notebook", "bkk-batch-pipeline", "staging-eval", "ml-platform-sa", "edge-inference", "data-engineering", "training-orchestrator"];
  return names.map((nm, i) => ({
    id: "key-" + String(i + 1).padStart(3, "0"),
    name: nm,
    prefix: "gpc_" + ["prod", "dev", "stage", "eval", "sa", "edge", "data", "orch"][i] + "_••••" + ["7D3K", "9P2A", "4K8M", "2X1Q", "8R5N", "6T3B", "1W9C", "5Y7H"][i],
    created: `2026-${String(between(r, 1, 9)).padStart(2, "0")}-${String(between(r, 1, 28)).padStart(2, "0")}`,
    last: B([["2 分钟前", "2 min ago"], ["昨天", "Yesterday"], ["3 小时前", "3 hours ago"], ["1 周前", "1 week ago"], ["刚刚", "Just now"], ["5 天前", "5 days ago"], ["12 小时前", "12h ago"], ["2 周前", "2 weeks ago"]][i][0], [["2 分钟前", "2 min ago"], ["昨天", "Yesterday"], ["3 小时前", "3 hours ago"], ["1 周前", "1 week ago"], ["刚刚", "Just now"], ["5 天前", "5 days ago"], ["12 小时前", "12h ago"], ["2 周前", "2 weeks ago"]][i][1]),
    active: i !== 6,
  }));
}
function genSecrets(r) {
  const names = ["HF_TOKEN", "WANDB_API_KEY", "S3_ENDPOINT_CRED", "OPENAI_PROXY_KEY", "SLACK_WEBHOOK", "GRAFANA_TOKEN", "NEXUS_REGISTRY_PWD", "DB_CONNECTION_STR"];
  const scopes = ["AI Platform / Production", "Research / Sandbox", "AI Platform / Production", "Inference / Edge", "Ops / Alerting", "Observability", "Registry", "Data Platform"];
  return names.map((nm, i) => ({ name: nm, scope: scopes[i], updated: `2026-${String(between(r, 1, 9)).padStart(2, "0")}-${String(between(r, 1, 28)).padStart(2, "0")}` }));
}

export function seed() {
  const r = rng(20261013);
  const fleet = buildFleet(20261013);
  const clusters = fleet.clusters;

  // 生成真实工作负载（实例 / 端点 / 任务）
  const instances = genInstances(r);
  const endpoints = genEndpoints(r);
  const jobs = genJobs(r, clusters);

  // 先构造临时状态，由真实负载推导每集群实算利用率（liveUtil）与库存
  const tmpState = { clusters, instances, endpoints, jobs };
  const f0 = fleetFromState(tmpState);
  clusters.forEach((c) => { c.liveUtil = f0._assigned.get(c.id) ? Math.min(100, Math.round((f0._assigned.get(c.id) / c.count) * 100)) : (c.liveUtil || 0); });
  fleet.tenantUsage = f0.tenantUsage; // 每租户实算 { used, hourly }（零售价口径）

  // 将 GPU.stock 覆写为各区域可立即分配的自由容量（与机队一致）
  const freeByRegionModel = {};
  clusters.forEach((c) => {
    freeByRegionModel[c.region] = freeByRegionModel[c.region] || {};
    const free = Math.max(0, c.count - Math.round(c.count * ((c.liveUtil ?? c.util) / 100)));
    freeByRegionModel[c.region][c.gpu] = (freeByRegionModel[c.region][c.gpu] || 0) + free;
  });
  GPU.forEach((g) => {
    g.stock = {};
    REGION_IDS.forEach((rid) => { g.stock[rid] = freeByRegionModel[rid]?.[g.id] || 0; });
  });

  const state = {
    project: "AI Platform / Production",
    balance: 1284500.5,
    budget: 1500000,
    instances,
    endpoints,
    jobs,
    clusters,
    assets: genAssets(r),
    events: genEvents(r),
    bills: [],
    k8s: k8sSeed(f0.allocated), // 集群分配量从机队实算传入，保证 K8s 概览/配额与机队口径闭环
    keys: genKeys(r),
    secrets: genSecrets(r),
  };
  // admin 依赖真实负载（tenant used/spend 从 instances/endpoints/jobs 实算）
  state.__tenantUsage = fleet.tenantUsage;
  state.admin = adminSeed(fleet, state);
  delete state.__tenantUsage; // 临时字段不入库
  return state;
}
