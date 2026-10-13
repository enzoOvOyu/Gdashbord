// 对齐原型常量：GPU 目录 / 镜像 / 模型清单
export const GPU = [
  { id: "H100", name: "NVIDIA H100 SXM", vram: 80, cpu: 32, ram: 256, storage: "1.6 TB NVMe", network: "NVLink / 400G IB", region: "北京三区", available: 128, price: 22.8, tag: "大模型训练", badge: "热门", score: 98 },
  { id: "H200", name: "NVIDIA H200", vram: 141, cpu: 32, ram: 256, storage: "2 TB NVMe", network: "NVLink / 400G IB", region: "上海二区", available: 64, price: 29.8, tag: "长上下文推理", badge: "推荐", score: 99 },
  { id: "B200", name: "NVIDIA B200", vram: 180, cpu: 48, ram: 384, storage: "3 TB NVMe", network: "NVLink / 800G IB", region: "新加坡一区", available: 32, price: 39.8, tag: "超大模型", badge: "新上架", score: 100 },
  { id: "A100", name: "NVIDIA A100 80G", vram: 80, cpu: 24, ram: 192, storage: "1.2 TB NVMe", network: "NVLink / 200G IB", region: "杭州一区", available: 210, price: 11.5, tag: "通用训练", badge: "高性价比", score: 91 },
  { id: "L40S", name: "NVIDIA L40S", vram: 48, cpu: 16, ram: 128, storage: "1 TB NVMe", network: "PCIe / 25G", region: "深圳一区", available: 182, price: 5.6, tag: "图像/视频推理", badge: "推理推荐", score: 88 },
  { id: "RTX4090", name: "NVIDIA RTX 4090", vram: 24, cpu: 12, ram: 64, storage: "500 GB SSD", network: "PCIe / 10G", region: "北京三区", available: 426, price: 2.8, tag: "开发调试", badge: "入门首选", score: 83 },
];

export const IMAGES = [
  "PyTorch 2.5 · CUDA 12.4",
  "vLLM · OpenAI API",
  "SGLang · LLM Serving",
  "ComfyUI · Stable Diffusion",
  "JupyterLab · Data Science",
  "Ubuntu 24.04 · CUDA 12.4",
];

export const MODELS = [
  "Qwen3-32B-Instruct",
  "DeepSeek-R1-Distill-32B",
  "Llama-3.3-70B-Instruct",
  "FLUX.1-dev",
  "自定义 Hugging Face 模型",
];

export const REGIONS = ["北京三区", "上海二区", "深圳一区", "杭州一区", "新加坡一区"];

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
];

export function gpu(id) {
  return GPU.find((x) => x.id === id) || GPU[0];
}
