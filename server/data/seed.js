// 领域数据种子：区域限定 JP/TH/US，GPU 限定 H100/H200/B200/B300/GB300，金额单位 USD
import { k8sSeed } from "./k8s.js";
import { adminSeed } from "./admin.js";

export function seed() {
  return {
    project: "AI Platform / Production",
    balance: 26840.5,
    budget: 30000,
    instances: [
      { id: "ws-001", name: "llm-research-lab", gpu: "H100", count: 2, region: "JP-TYO-1", image: "pytorch-2.6", status: "running", kind: { zh: "开发工作空间", en: "Workspace" }, age: { zh: "3天 12小时", en: "3d 12h" }, ip: "203.0.113.24", disk: 500, ssh: true, jupyter: true },
      { id: "ws-002", name: "comfyui-studio", gpu: "H200", count: 1, region: "US-LAX-2", image: "comfyui", status: "running", kind: { zh: "AI 应用环境", en: "AI app runtime" }, age: { zh: "12小时", en: "12h" }, ip: "203.0.113.36", disk: 200, ssh: true, jupyter: false },
      { id: "ws-003", name: "data-prep", gpu: "H100", count: 1, region: "TH-BKK-1", image: "jupyter", status: "stopped", kind: { zh: "数据处理", en: "Data processing" }, age: { zh: "1天 4小时", en: "1d 4h" }, ip: "—", disk: 100, ssh: false, jupyter: true },
      { id: "ws-004", name: "finetune-experiment", gpu: "B200", count: 4, region: "US-IAD-1", image: "pytorch-2.6", status: "running", kind: { zh: "训练开发", en: "Training dev" }, age: { zh: "2天 6小时", en: "2d 6h" }, ip: "203.0.113.88", disk: 1000, ssh: true, jupyter: false },
      { id: "ws-005", name: "gb300-moe-lab", gpu: "GB300", count: 8, region: "US-LAX-2", image: "pytorch-2.6", status: "running", kind: { zh: "大规模实验", en: "Large-scale lab" }, age: { zh: "8小时", en: "8h" }, ip: "203.0.113.102", disk: 2000, ssh: true, jupyter: true },
    ],
    endpoints: [
      { id: "ep-001", name: "qwen-chat-prod", modelId: "qwen3-235b", model: "Qwen3-235B-A22B", engine: "vLLM", gpu: "H200", gpusPerReplica: 4, region: "JP-TYO-1", status: "healthy", min: 1, max: 8, qps: 42.6, p95: 189, replicas: 3, requests: 186400, version: "v1.3.2" },
      { id: "ep-002", name: "image-generation", modelId: "flux1-dev", model: "FLUX.1-dev", engine: "ComfyUI", gpu: "H100", gpusPerReplica: 1, region: "US-LAX-2", status: "healthy", min: 0, max: 4, qps: 5.8, p95: 820, replicas: 2, requests: 21800, version: "v2.1.0" },
      { id: "ep-003", name: "embedding-dev", modelId: "bge-m3", model: "BGE-M3", engine: "Triton", gpu: "H100", gpusPerReplica: 1, region: "TH-BKK-1", status: "scaled-zero", min: 0, max: 2, qps: 0, p95: 0, replicas: 0, requests: 8700, version: "v0.8.1" },
      { id: "ep-004", name: "deepseek-reasoning", modelId: "deepseek-r1", model: "DeepSeek-R1-0528", engine: "SGLang", gpu: "B200", gpusPerReplica: 8, region: "US-IAD-1", status: "healthy", min: 1, max: 4, qps: 18.2, p95: 412, replicas: 2, requests: 64200, version: "v1.0.4" },
      { id: "ep-005", name: "vision-qwen-vl", modelId: "qwen25-vl-72b", model: "Qwen2.5-VL-72B", engine: "vLLM", gpu: "H200", gpusPerReplica: 2, region: "JP-TYO-1", status: "healthy", min: 1, max: 6, qps: 12.4, p95: 268, replicas: 2, requests: 31900, version: "v0.9.1" },
    ],
    jobs: [
      { id: "job-001", name: "qwen3-lora-finetune", type: { zh: "LoRA 微调", en: "LoRA fine-tune" }, gpu: "H100", count: 8, nodes: 1, region: "JP-TYO-1", status: "running", progress: 68, duration: "2h 14m", dataset: "nlp-corpus-v3", goodput: 61, cost: 33.86, priority: "High", template: "PyTorch DDP", image: "pytorch-2.6", epoch: 3 },
      { id: "job-002", name: "image-classifier-eval", type: { zh: "批量评估", en: "Batch evaluation" }, gpu: "H100", count: 2, nodes: 1, region: "TH-BKK-1", status: "completed", progress: 100, duration: "38m", dataset: "vision-dataset", goodput: 54, cost: 1.94, priority: "Normal", template: "Custom Container", image: "pytorch-2.6", epoch: 1 },
      { id: "job-003", name: "moe-1t-pretrain", type: { zh: "分布式预训练", en: "Distributed pre-training" }, gpu: "B300", count: 32, nodes: 4, region: "US-IAD-1", status: "queued", progress: 0, duration: "—", dataset: "pretrain-tokens", goodput: 0, cost: 0, priority: "Critical", template: "DeepSpeed ZeRO", image: "pytorch-2.6", epoch: 1 },
      { id: "job-004", name: "feature-extract", type: { zh: "批处理", en: "Batch processing" }, gpu: "H100", count: 1, nodes: 1, region: "US-LAX-2", status: "failed", progress: 34, duration: "12m", dataset: "vision-dataset", goodput: 42, cost: 0.5, priority: "Normal", template: "Ray Train", image: "pytorch-2.6", epoch: 1 },
      { id: "job-005", name: "gb300-scale-test", type: { zh: "多机扩展性测试", en: "Multi-node scaling test" }, gpu: "GB300", count: 72, nodes: 1, region: "US-LAX-2", status: "running", progress: 41, duration: "6h 52m", dataset: "pretrain-tokens", goodput: 78, cost: 376.3, priority: "Critical", template: "DeepSpeed ZeRO", image: "pytorch-2.6", epoch: 1 },
      { id: "job-006", name: "rlhf-reward-model", type: { zh: "RLHF 奖励模型", en: "RLHF reward model" }, gpu: "H200", count: 4, nodes: 1, region: "JP-TYO-1", status: "running", progress: 22, duration: "48m", dataset: "rlhf-preference", goodput: 57, cost: 5.24, priority: "High", template: "PyTorch DDP", image: "pytorch-2.6", epoch: 2 },
    ],
    clusters: [
      { id: "cl-001", name: "training-fabric-iad", sku: "sku-b300-32", nodes: 4, gpu: "B300", count: 32, region: "US-IAD-1", status: "running", scheduler: "Slurm", network: "800G InfiniBand", util: 84, price: 191.68, cpuPerNode: 288, ramPerNode: 4096, storagePerNode: "15.36 TB NVMe", jobs: 3 },
      { id: "cl-002", name: "k8s-inference-pool", sku: "sku-h200-8", nodes: 3, gpu: "H200", count: 24, region: "JP-TYO-1", status: "running", scheduler: "Kubernetes", network: "400G InfiniBand", util: 61, price: 78.96, cpuPerNode: 224, ramPerNode: 2048, storagePerNode: "7.68 TB NVMe", jobs: 5 },
      { id: "cl-003", name: "gb300-rack-lax", sku: "sku-gb300-72", nodes: 1, gpu: "GB300", count: 72, region: "US-LAX-2", status: "running", scheduler: "Slurm", network: { zh: "NVL72 全域 NVLink", en: "NVL72 full NVLink domain" }, util: 92, price: 539.28, cpuPerNode: 5184, ramPerNode: 73728, storagePerNode: "276 TB NVMe", jobs: 2 },
      { id: "cl-004", name: "dev-fabric-bkk", sku: "sku-h100-8", nodes: 2, gpu: "H100", count: 16, region: "TH-BKK-1", status: "provisioning", scheduler: "Kubernetes", network: "200G InfiniBand", util: 0, price: 39.84, cpuPerNode: 208, ramPerNode: 2048, storagePerNode: "7.68 TB NVMe", jobs: 0 },
    ],
    assets: {
      models: [
        { name: "Qwen3-235B-A22B", task: { zh: "通用 LLM", en: "General LLM" }, params: "235B MoE", license: "Apache-2.0", size: "470 GB", version: "v1.2", source: "Hugging Face", date: { zh: "今天 10:42", en: "Today 10:42" }, downloads: 1284, acl: { zh: "组织内可读", en: "Org read" } },
        { name: "DeepSeek-R1-0528", task: { zh: "推理增强", en: "Reasoning" }, params: "671B MoE", license: "MIT", size: "1.4 TB", version: "v1.0", source: "Model Registry", date: { zh: "昨天 18:20", en: "Yesterday 18:20" }, downloads: 642, acl: { zh: "私有", en: "Private" } },
        { name: "FLUX.1-dev", task: { zh: "图像生成", en: "Image generation" }, params: "12B", license: "Non-commercial", size: "23 GB", version: "v2.1", source: "Hugging Face", date: { zh: "今天 09:05", en: "Today 09:05" }, downloads: 3186, acl: { zh: "公开只读", en: "Public read" } },
        { name: "BGE-M3", task: { zh: "Embedding", en: "Embedding" }, params: "568M", license: "MIT", size: "2.4 GB", version: "v1.0", source: "Hugging Face", date: { zh: "10月09日", en: "Oct 09" }, downloads: 2941, acl: { zh: "组织内可读", en: "Org read" } },
        { name: "Qwen2.5-VL-72B", task: { zh: "多模态", en: "Multimodal" }, params: "72B", license: "Apache-2.0", size: "152 GB", version: "v0.9", source: "Model Registry", date: { zh: "10月08日", en: "Oct 08" }, downloads: 873, acl: { zh: "私有", en: "Private" } },
        { name: "Whisper-Large-v3", task: { zh: "语音识别", en: "ASR" }, params: "1.5B", license: "MIT", size: "6.2 GB", version: "v3", source: "Hugging Face", date: { zh: "10月06日", en: "Oct 06" }, downloads: 1502, acl: { zh: "公开只读", en: "Public read" } },
      ],
      datasets: [
        { name: "nlp-corpus-v3", type: { zh: "文本语料", en: "Text corpus" }, rows: "84 亿 tokens", format: "JSONL / Parquet", license: "CC-BY-4.0", size: "1.8 TB", gb: 1843, storageClass: { zh: "对象存储", en: "Object storage" }, region: "JP-TYO-1", source: "内部采集", date: { zh: "今天 09:15", en: "Today 09:15" } },
        { name: "vision-dataset", type: { zh: "图像数据", en: "Image data" }, rows: "1,240 万张", format: "WebDataset", license: "内部", size: "640 GB", gb: 640, storageClass: { zh: "共享文件系统", en: "Shared filesystem" }, region: "US-LAX-2", source: "标注平台", date: { zh: "10月10日", en: "Oct 10" } },
        { name: "pretrain-tokens", type: { zh: "预训练语料", en: "Pre-training corpus" }, rows: "2.6 万亿 tokens", format: "Parquet", license: "内部", size: "12.4 TB", gb: 12698, storageClass: { zh: "对象存储", en: "Object storage" }, region: "US-IAD-1", source: "数据工程组", date: { zh: "10月08日", en: "Oct 08" } },
        { name: "rlhf-preference", type: { zh: "偏好数据", en: "Preference data" }, rows: "86 万条", format: "JSONL", license: "内部", size: "42 GB", gb: 42, storageClass: { zh: "共享文件系统", en: "Shared filesystem" }, region: "JP-TYO-1", source: "标注平台", date: { zh: "10月05日", en: "Oct 05" } },
        { name: "speech-th-v1", type: { zh: "泰语语音", en: "Thai speech" }, rows: "3,200 小时", format: "WAV / JSON", license: "CC-BY-SA", size: "310 GB", gb: 310, storageClass: { zh: "对象存储", en: "Object storage" }, region: "TH-BKK-1", source: "合作方授权", date: { zh: "10月02日", en: "Oct 02" } },
      ],
      images: [
        { name: "pytorch-2.6-cu128", type: { zh: "官方镜像", en: "Official" }, base: "Ubuntu 24.04", cuda: "CUDA 12.8", size: "12.8 GB", version: "v2.6", scan: { zh: "无高危漏洞", en: "No critical CVE" }, source: "Registry", date: { zh: "今天 11:20", en: "Today 11:20" }, pulls: 4821 },
        { name: "vllm-openai-server", type: { zh: "推理镜像", en: "Inference" }, base: "Ubuntu 22.04", cuda: "CUDA 12.8", size: "9.2 GB", version: "v0.9", scan: { zh: "2 个中危", en: "2 medium CVE" }, source: "Registry", date: { zh: "10月11日", en: "Oct 11" }, pulls: 2140 },
        { name: "sglang-runtime", type: { zh: "推理镜像", en: "Inference" }, base: "Ubuntu 22.04", cuda: "CUDA 12.8", size: "8.6 GB", version: "v0.4", scan: { zh: "无高危漏洞", en: "No critical CVE" }, source: "Registry", date: { zh: "10月09日", en: "Oct 09" }, pulls: 1188 },
        { name: "comfyui-stable", type: { zh: "社区镜像", en: "Community" }, base: "Ubuntu 22.04", cuda: "CUDA 12.4", size: "18.6 GB", version: "v1.4", scan: { zh: "5 个中危", en: "5 medium CVE" }, source: "Registry", date: { zh: "10月08日", en: "Oct 08" }, pulls: 3672 },
        { name: "megatron-nemo2", type: { zh: "训练镜像", en: "Training" }, base: "Ubuntu 22.04", cuda: "CUDA 12.8", size: "16.4 GB", version: "v2.1", scan: { zh: "无高危漏洞", en: "No critical CVE" }, source: "Registry", date: { zh: "10月06日", en: "Oct 06" }, pulls: 964 },
      ],
      volumes: [
        { name: "shared-model-cache", type: { zh: "高性能共享存储", en: "High-perf shared" }, size: "8 TB", gb: 8192, used: 62, mount: "/models", mode: "RWX", iops: "120K", region: "JP-TYO-1", encrypted: true, snapshot: { zh: "每日 02:00", en: "Daily 02:00" }, date: { zh: "今天 10:10", en: "Today 10:10" } },
        { name: "training-checkpoints", type: { zh: "持久卷", en: "Persistent volume" }, size: "40 TB", gb: 40960, used: 47, mount: "/checkpoints", mode: "RWX", iops: "80K", region: "US-IAD-1", encrypted: true, snapshot: { zh: "每 6 小时", en: "Every 6h" }, date: { zh: "10月09日", en: "Oct 09" } },
        { name: "team-datasets", type: { zh: "对象存储桶", en: "Object bucket" }, size: "120 TB", gb: 122880, used: 38, mount: "s3://team-datasets", mode: "S3", iops: "—", region: "US-LAX-2", encrypted: true, snapshot: { zh: "版本控制已开启", en: "Versioning on" }, date: { zh: "10月08日", en: "Oct 08" } },
        { name: "bkk-scratch", type: { zh: "本地高速盘", en: "Local scratch" }, size: "4 TB", gb: 4096, used: 21, mount: "/scratch", mode: "RWO", iops: "500K", region: "TH-BKK-1", encrypted: false, snapshot: { zh: "无", en: "None" }, date: { zh: "10月04日", en: "Oct 04" } },
      ],
      acl: [
        { resource: "shared-model-cache", grantee: { zh: "算法研究组", en: "Research group" }, perm: { zh: "读写", en: "Read/Write" }, scope: { zh: "项目内", en: "Project" }, expire: "—" },
        { resource: "training-checkpoints", grantee: { zh: "训练流水线 SA", en: "Training pipeline SA" }, perm: { zh: "读写", en: "Read/Write" }, scope: { zh: "组织", en: "Organization" }, expire: "—" },
        { resource: "DeepSeek-R1-0528", grantee: { zh: "Nexa AI Labs", en: "Nexa AI Labs" }, perm: { zh: "只读", en: "Read" }, scope: { zh: "外部租户", en: "External tenant" }, expire: "2026-12-31" },
        { resource: "team-datasets", grantee: { zh: "数据工程组", en: "Data engineering" }, perm: { zh: "管理", en: "Admin" }, scope: { zh: "组织", en: "Organization" }, expire: "—" },
        { resource: "FLUX.1-dev", grantee: { zh: "公开访问", en: "Public" }, perm: { zh: "只读", en: "Read" }, scope: { zh: "互联网", en: "Internet" }, expire: "—" },
      ],
    },
    events: [
      { level: "warning", time: "23:31", text: { zh: "qwen-chat-prod p95 延迟超过 200ms", en: "qwen-chat-prod p95 latency above 200ms" } },
      { level: "success", time: "23:18", text: { zh: "训练任务 moe-1t-pretrain 已保存 checkpoint", en: "Job moe-1t-pretrain saved a checkpoint" } },
      { level: "info", time: "22:54", text: { zh: "image-generation 自动扩容至 2 副本", en: "image-generation autoscaled to 2 replicas" } },
      { level: "info", time: "21:12", text: { zh: "共享卷 shared-model-cache 已挂载到 3 个工作空间", en: "shared-model-cache mounted into 3 workspaces" } },
      { level: "warning", time: "20:41", text: { zh: "曼谷区域 B300 库存为 0，任务转入排队", en: "Bangkok B300 inventory is 0, job queued" } },
      { level: "success", time: "19:36", text: { zh: "GB300 机架 cl-003 通过 NCCL 带宽自检", en: "GB300 rack cl-003 passed NCCL bandwidth test" } },
    ],
    bills: [],
    k8s: k8sSeed(),
    admin: adminSeed(),
    keys: [
      { id: "key-001", name: "production-inference", prefix: "gpc_prod_••••7D3K", created: "2026-10-01", last: { zh: "2 分钟前", en: "2 min ago" }, active: true },
      { id: "key-002", name: "research-notebook", prefix: "gpc_dev_••••9P2A", created: "2026-09-22", last: { zh: "昨天", en: "Yesterday" }, active: true },
      { id: "key-003", name: "bkk-batch-pipeline", prefix: "gpc_dev_••••4K8M", created: "2026-10-06", last: { zh: "3 小时前", en: "3 hours ago" }, active: true },
    ],
    secrets: [
      { name: "HF_TOKEN", scope: "Research / Sandbox", updated: "2026-10-10" },
      { name: "WANDB_API_KEY", scope: "AI Platform / Production", updated: "2026-10-08" },
      { name: "S3_ENDPOINT_CRED", scope: "AI Platform / Production", updated: "2026-10-05" },
    ],
  };
}
