// Kubernetes GPU 资源数据模型：节点池 / GPU 节点 / 命名空间配额 / 工作负载 / 调度队列 / 集群事件
// 设计参考 CoreWeave CKS（Kubernetes Service）+ SUNK + Mission Control 的运维概念
// 术语：node pool、cordon / drain、GPU straggler、topology-aware scheduling、goodput、MTTF、rack / cabinet
// GPU 型号限定 H100 / H200 / B200 / B300 / GB300；区域限定 日本 / 泰国 / 美国；文案中英双语

export const NODE_STATUS = {
  ready: ["Ready", "green"],
  cordoned: ["Cordoned", "amber"],
  draining: ["Draining", "blue"],
  remediation: ["Remediation", "red"],
  notready: ["NotReady", "red"],
};

export const POD_PHASE = {
  running: ["Running", "green"],
  pending: ["Pending", "amber"],
  succeeded: ["Succeeded", "gray"],
  failed: ["Failed", "red"],
  terminating: ["Terminating", "blue"],
};

// 节点池（Node Pools）—— 覆盖 区域 × 型号，规模对标万卡机队
export const POOLS = [
  { id: "h100-tyo", name: "gpu-h100-tyo", gpu: "H100", gpus: 8, vram: 80, nodes: 120, cpu: 224, ram: 2048, region: "JP-TYO-1", fabric: "NVLink 4.0 · 400G IB", purpose: { zh: "大模型预训练 / SFT", en: "Pre-training / SFT" } },
  { id: "h200-tyo", name: "gpu-h200-tyo", gpu: "H200", gpus: 8, vram: 141, nodes: 80, cpu: 224, ram: 2048, region: "JP-TYO-1", fabric: "NVLink 5.0 · 800G IB", purpose: { zh: "长上下文推理 / 预训练", en: "Long-context inference / pre-training" } },
  { id: "b200-tyo", name: "gpu-b200-tyo", gpu: "B200", gpus: 8, vram: 180, nodes: 40, cpu: 336, ram: 3072, region: "JP-TYO-1", fabric: "NVL72 rack domain · 1.8T", purpose: { zh: "超大模型分布式训练", en: "Large-scale distributed training" } },
  { id: "h100-bkk", name: "gpu-h100-bkk", gpu: "H100", gpus: 8, vram: 80, nodes: 60, cpu: 224, ram: 2048, region: "TH-BKK-1", fabric: "NVLink 4.0 · 200G IB", purpose: { zh: "东南亚区域训练 / 微调", en: "SE Asia training / fine-tuning" } },
  { id: "h200-bkk", name: "gpu-h200-bkk", gpu: "H200", gpus: 8, vram: 141, nodes: 30, cpu: 224, ram: 2048, region: "TH-BKK-1", fabric: "NVLink 5.0 · 200G IB", purpose: { zh: "长上下文推理", en: "Long-context inference" } },
  { id: "b200-bkk", name: "gpu-b200-bkk", gpu: "B200", gpus: 8, vram: 180, nodes: 20, cpu: 336, ram: 3072, region: "TH-BKK-1", fabric: "NVL72 rack domain · 1.2T", purpose: { zh: "区域分布式训练", en: "Regional distributed training" } },
  { id: "h100-lax", name: "gpu-h100-lax", gpu: "H100", gpus: 8, vram: 80, nodes: 140, cpu: 224, ram: 2048, region: "US-LAX-2", fabric: "NVLink 4.0 · 400G IB", purpose: { zh: "预训练 / 推理混合", en: "Mixed training / inference" } },
  { id: "h200-lax", name: "gpu-h200-lax", gpu: "H200", gpus: 8, vram: 141, nodes: 90, cpu: 224, ram: 2048, region: "US-LAX-2", fabric: "NVLink 5.0 · 800G IB", purpose: { zh: "长上下文推理工厂", en: "Long-context inference factory" } },
  { id: "b200-lax", name: "gpu-b200-lax", gpu: "B200", gpus: 8, vram: 180, nodes: 70, cpu: 336, ram: 3072, region: "US-LAX-2", fabric: "NVL72 rack domain · 1.8T", purpose: { zh: "前沿预训练", en: "Frontier pre-training" } },
  { id: "b300-lax", name: "gpu-b300-lax", gpu: "B300", gpus: 8, vram: 288, nodes: 40, cpu: 336, ram: 4096, region: "US-LAX-2", fabric: "NVL72 rack domain · 2.4T", purpose: { zh: "万亿参数 MoE 训练", en: "Trillion-param MoE training" } },
  { id: "gb300-lax", name: "gpu-gb300-lax", gpu: "GB300", gpus: 72, vram: 288, nodes: 8, cpu: 5184, ram: 73728, region: "US-LAX-2", fabric: "NVL72 · Grace Blackwell", purpose: { zh: "推理工厂 / 超大 MoE 服务", en: "Inference factory / MoE serving" } },
  { id: "h100-iad", name: "gpu-h100-iad", gpu: "H100", gpus: 8, vram: 80, nodes: 130, cpu: 224, ram: 2048, region: "US-IAD-1", fabric: "NVLink 4.0 · 800G IB", purpose: { zh: "预训练 / 推理混合", en: "Mixed training / inference" } },
  { id: "h200-iad", name: "gpu-h200-iad", gpu: "H200", gpus: 8, vram: 141, nodes: 110, cpu: 224, ram: 2048, region: "US-IAD-1", fabric: "NVLink 5.0 · 800G IB", purpose: { zh: "长上下文推理 / 预训练", en: "Long-context inference / pre-training" } },
  { id: "b200-iad", name: "gpu-b200-iad", gpu: "B200", gpus: 8, vram: 180, nodes: 90, cpu: 336, ram: 3072, region: "US-IAD-1", fabric: "NVL72 rack domain · 1.8T", purpose: { zh: "超大模型分布式训练", en: "Large-scale distributed training" } },
  { id: "b300-iad", name: "gpu-b300-iad", gpu: "B300", gpus: 8, vram: 288, nodes: 60, cpu: 336, ram: 4096, region: "US-IAD-1", fabric: "NVL72 rack domain · 2.4T", purpose: { zh: "万亿参数 MoE 训练", en: "Trillion-param MoE training" } },
  { id: "gb300-iad", name: "gpu-gb300-iad", gpu: "GB300", gpus: 72, vram: 288, nodes: 12, cpu: 5184, ram: 73728, region: "US-IAD-1", fabric: "NVL72 · Grace Blackwell", purpose: { zh: "机架级一体化训练", en: "Rack-scale integrated training" } },
];

const POOL_REGION = POOLS.reduce((m, p) => ((m[p.id] = p.region), m), {});

// 确定性伪随机，保证每次 reset 后数据一致
function rng(seed) {
  let x = seed;
  return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

function nodeId(pool, i) {
  return `cks-${pool}-${String.fromCharCode(97 + (i % 26))}${String(i + 1).padStart(3, "0")}`;
}

// 生成 GPU 节点（可浏览样本；池聚合总量见 POOLS）
function buildNodes() {
  const rand = rng(20261013);
  const nodes = [];
  let idx = 0;
  const statusPlan = [
    "ready", "ready", "ready", "ready", "cordoned", "ready",
    "ready", "ready", "remediation", "ready", "draining", "ready",
    "ready", "ready", "ready", "notready", "ready", "ready",
    "ready", "ready", "ready", "ready", "ready", "cordoned",
    "ready", "remediation", "ready", "ready", "ready", "ready",
  ];
  // 每个池取一个样本（规模越大样本略多），上限约 130 个可浏览节点
  for (const pool of POOLS) {
    const sample = Math.min(pool.nodes, pool.gpus >= 72 ? 4 : 12);
    for (let i = 0; i < sample; i++) {
      const st = statusPlan[idx % statusPlan.length];
      const rack = `R${String(1 + Math.floor(idx / 6)).padStart(2, "0")}`;
      const domain = `${pool.id}-nvlink-${Math.floor(i / 2) + 1}`;
      const total = pool.gpus;
      const used = st === "ready" ? Math.min(total, Math.round(rand() * total)) : st === "cordoned" ? total : Math.round(rand() * total * 0.7);
      const straggler = st === "ready" && rand() > 0.88;
      const degraded = st === "remediation" || st === "notready";
      nodes.push({
        id: nodeId(pool.id, idx),
        pool: pool.id,
        poolName: pool.name,
        gpu: pool.gpu,
        gpus: total,
        vramPerGpu: pool.vram,
        allocatable: total,
        allocated: used,
        cpu: pool.cpu,
        cpuUsed: Math.round(pool.cpu * (0.25 + rand() * 0.6)),
        ram: pool.ram,
        ramUsed: Math.round(pool.ram * (0.3 + rand() * 0.55)),
        status: st,
        health: degraded ? "Fail" : straggler ? "Degraded" : "Pass",
        straggler,
        region: pool.region,
        rack,
        cabinet: `${rack}-C${1 + (idx % 2)}`,
        domain,
        temp: Math.round((st === "ready" ? 58 : 74) + rand() * 22),
        power: Math.round(total * (st === "ready" ? 520 : 180) + rand() * 400),
        taints: st === "cordoned" ? ["node.kubernetes.io/unschedulable:NoSchedule"] : ["nvidia.com/gpu.product=" + pool.gpu + ":NoSchedule"],
        pods: 1 + Math.floor(rand() * 9),
        uptime: { zh: `${1 + Math.floor(rand() * 40)}天 ${Math.floor(rand() * 24)}小时`, en: `${1 + Math.floor(rand() * 40)}d ${Math.floor(rand() * 24)}h` },
        version: "v1.32.4-cks",
        lastCheck: { zh: `${Math.floor(rand() * 9) + 1} 分钟前`, en: `${Math.floor(rand() * 9) + 1} min ago` },
      });
      idx++;
    }
  }
  return nodes;
}

// 命名空间配额（Namespace Quota）—— 万卡规模：合计 limit ≈ 集群总量 92%，used 合计与集群分配量对齐
function buildQuotas(allocated) {
  // 按 5,985 分配量映射到命名空间（与机队实算利用率一致的占比）
  const a = allocated || 5990;
  return [
    { ns: "training-prod", team: { zh: "大模型训练组", en: "LLM Training" }, priority: "Critical", gpuLimit: 3600, gpuUsed: Math.round(a * 0.52), cpuLimit: 50400, cpuUsed: 43518, memLimit: 460800, memUsed: 361500, podLimit: 9000, podUsed: 7305 },
    { ns: "inference-prod", team: { zh: "在线推理组", en: "Online Inference" }, priority: "Critical", gpuLimit: 1800, gpuUsed: Math.round(a * 0.22), cpuLimit: 28800, cpuUsed: 20500, memLimit: 230400, memUsed: 156300, podLimit: 12000, podUsed: 9630 },
    { ns: "research", team: { zh: "算法研究组", en: "Research" }, priority: "High", gpuLimit: 1600, gpuUsed: Math.round(a * 0.15), cpuLimit: 25600, cpuUsed: 18813, memLimit: 204800, memUsed: 133000, podLimit: 6000, podUsed: 4680 },
    { ns: "dev-sandbox", team: { zh: "开发沙箱", en: "Dev Sandbox" }, priority: "BestEffort", gpuLimit: 1200, gpuUsed: Math.round(a * 0.07), cpuLimit: 19200, cpuUsed: 5525, memLimit: 153600, memUsed: 45500, podLimit: 4500, podUsed: 1410 },
    { ns: "data-pipeline", team: { zh: "数据工程组", en: "Data Engineering" }, priority: "High", gpuLimit: 1040, gpuUsed: Math.round(a * 0.04), cpuLimit: 16000, cpuUsed: 8552, memLimit: 128000, memUsed: 56600, podLimit: 3600, podUsed: 1770 },
  ];
}

// 工作负载（Pods / Deployments / Jobs）
function buildPods(nodes) {
  const pick = (pool) => nodes.filter((n) => n.pool === pool);
  const h = pick("h100-tyo"), h2 = pick("h200-tyo"), b = pick("b200-tyo"), b3 = pick("b300-iad"), g = pick("gb300-iad"), ht = pick("h100-bkk");
  const readyNodes = (arr) => arr.filter((n) => n.status === "ready");
  const list = [
    { id: "pod-llama-pretrain", name: "llama4-70b-pretrain-0", ns: "training-prod", kind: "Job", gpu: "H100", gpuCount: 8, node: readyNodes(h)[0]?.id || h[0].id, phase: "running", restarts: 1, age: { zh: "6天 14小时", en: "6d 14h" }, image: "registry.cks/pytorch:2.6-cu124", owner: "ml-engineer", priority: "Critical", topology: { zh: "NVLink 域内 Gang", en: "NVLink-domain Gang" }, gpuUtil: 97, note: { zh: "SUNK 拓扑感知调度，8 卡同域", en: "SUNK topology-aware, 8 GPUs same domain" } },
    { id: "pod-llama-pretrain-1", name: "llama4-70b-pretrain-1", ns: "training-prod", kind: "Job", gpu: "H100", gpuCount: 8, node: readyNodes(h)[1]?.id || h[1].id, phase: "running", restarts: 0, age: { zh: "6天 14小时", en: "6d 14h" }, image: "registry.cks/pytorch:2.6-cu124", owner: "ml-engineer", priority: "Critical", topology: { zh: "NVLink 域内 Gang", en: "NVLink-domain Gang" }, gpuUtil: 96, note: { zh: "同上，跨节点 IB 通信", en: "Same job, cross-node IB" } },
    { id: "pod-qwen-sft", name: "qwen3-32b-sft-trainer", ns: "training-prod", kind: "PyTorchJob", gpu: "H100", gpuCount: 4, node: readyNodes(h)[2]?.id || h[2].id, phase: "running", restarts: 3, age: { zh: "2天 3小时", en: "2d 3h" }, image: "registry.cks/trl:0.12", owner: "research", priority: "High", topology: { zh: "NVLink 域内", en: "Within NVLink domain" }, gpuUtil: 88, note: { zh: "检测到 1 次 straggler 重调度", en: "1 straggler reschedule detected" } },
    { id: "pod-deepseek-eval", name: "deepseek-r1-eval-worker", ns: "research", kind: "Job", gpu: "H200", gpuCount: 8, node: readyNodes(h2)[0]?.id || h2[0].id, phase: "running", restarts: 0, age: { zh: "18 小时", en: "18h" }, image: "registry.cks/vllm:0.9", owner: "research", priority: "High", topology: { zh: "NVLink 域内 Gang", en: "NVLink-domain Gang" }, gpuUtil: 91, note: { zh: "长上下文推理评测", en: "Long-context eval" } },
    { id: "pod-b200-train", name: "nemotron-moe-pretrain", ns: "training-prod", kind: "Job", gpu: "B200", gpuCount: 8, node: readyNodes(b)[0]?.id || b[0].id, phase: "running", restarts: 0, age: { zh: "11天 2小时", en: "11d 2h" }, image: "registry.cks/megatron:nemo2", owner: "ml-engineer", priority: "Critical", topology: { zh: "NVL72 机架域", en: "NVL72 rack domain" }, gpuUtil: 99, note: { zh: "机架域内 72 卡互联", en: "72 GPUs interconnected in rack domain" } },
    { id: "pod-b300-train", name: "b300-1t-moe-pretrain", ns: "training-prod", kind: "Job", gpu: "B300", gpuCount: 8, node: readyNodes(b3)[0]?.id || b3[0].id, phase: "running", restarts: 0, age: { zh: "4天 8小时", en: "4d 8h" }, image: "registry.cks/megatron:nemo2", owner: "ml-engineer", priority: "Critical", topology: { zh: "NVL72 机架域", en: "NVL72 rack domain" }, gpuUtil: 98, note: { zh: "288GB HBM3e，单卡容纳更大 micro-batch", en: "288GB HBM3e enables larger micro-batch" } },
    { id: "pod-gb300-serve", name: "gb300-moe-serving", ns: "inference-prod", kind: "Deployment", gpu: "GB300", gpuCount: 2, node: readyNodes(g)[0]?.id || g[0].id, phase: "running", restarts: 0, age: { zh: "23天", en: "23d" }, image: "registry.cks/vllm:0.9", owner: "platform", priority: "High", topology: { zh: "无约束", en: "None" }, gpuUtil: 62, note: { zh: "HPA 4→2 副本缩容中", en: "HPA scaling down 4→2 replicas" } },
    { id: "pod-qwen-endpoint", name: "qwen3-32b-endpoint", ns: "inference-prod", kind: "Deployment", gpu: "H200", gpuCount: 2, node: readyNodes(h2)[1]?.id || h2[1].id, phase: "running", restarts: 2, age: { zh: "9天", en: "9d" }, image: "registry.cks/vllm:0.9", owner: "platform", priority: "Critical", topology: { zh: "无约束", en: "None" }, gpuUtil: 74, note: { zh: "scale-to-zero 已关闭", en: "scale-to-zero disabled" } },
    { id: "pod-th-finetune", name: "sea-lora-finetune", ns: "research", kind: "Job", gpu: "H100", gpuCount: 4, node: readyNodes(ht)[0]?.id || ht[0].id, phase: "running", restarts: 0, age: { zh: "1天 6小时", en: "1d 6h" }, image: "registry.cks/pytorch:2.6", owner: "research", priority: "High", topology: { zh: "无约束", en: "None" }, gpuUtil: 79, note: "" },
    { id: "pod-dev-notebook", name: "dev-notebook-zhang", ns: "dev-sandbox", kind: "Pod", gpu: "H100", gpuCount: 1, node: readyNodes(ht)[1]?.id || ht[1].id, phase: "running", restarts: 0, age: { zh: "4 小时", en: "4h" }, image: "registry.cks/jupyter:base", owner: "zhangwei", priority: "BestEffort", topology: { zh: "无约束", en: "None" }, gpuUtil: 21, note: { zh: "可抢占", en: "Preemptible" } },
    // 调度队列（Pending）
    { id: "pod-pending-moe", name: "moe-1t-pretrain-gang", ns: "training-prod", kind: "Job", gpu: "B300", gpuCount: 16, node: "", phase: "pending", restarts: 0, age: { zh: "42 分钟", en: "42m" }, image: "registry.cks/megatron:nemo2", owner: "ml-engineer", priority: "Critical", topology: { zh: "NVLink 域内 Gang", en: "NVLink-domain Gang" }, gpuUtil: 0, reason: { zh: "nvidia.com/gpu 不足（需 16，等待 Gang 同时满足）", en: "Insufficient nvidia.com/gpu (need 16, waiting for Gang)" }, gang: 2 },
    { id: "pod-pending-scale", name: "megatron-1t-scale-out", ns: "training-prod", kind: "Job", gpu: "GB300", gpuCount: 32, node: "", phase: "pending", restarts: 0, age: { zh: "1 小时 12 分", en: "1h 12m" }, image: "registry.cks/megatron:nemo2", owner: "ml-engineer", priority: "Critical", topology: { zh: "NVL72 机架域 Gang", en: "NVL72 rack-domain Gang" }, gpuUtil: 0, reason: { zh: "集群 GB300 总量不足，需扩容节点池后才能满足", en: "GB300 capacity insufficient; scale the pool first" }, gang: 8 },
    { id: "pod-pending-eval", name: "weekly-eval-suite", ns: "research", kind: "Job", gpu: "H200", gpuCount: 8, node: "", phase: "pending", restarts: 0, age: { zh: "17 分钟", en: "17m" }, image: "registry.cks/eval:1.4", owner: "research", priority: "High", topology: { zh: "无约束", en: "None" }, gpuUtil: 0, reason: { zh: "等待命名空间配额 training-prod 释放", en: "Waiting for training-prod quota release" }, gang: 1 },
    { id: "pod-pending-video", name: "video-gen-batch-072", ns: "inference-prod", kind: "Job", gpu: "B200", gpuCount: 4, node: "", phase: "pending", restarts: 0, age: { zh: "9 分钟", en: "9m" }, image: "registry.cks/video:0.8", owner: "platform", priority: "BestEffort", topology: { zh: "无约束", en: "None" }, gpuUtil: 0, reason: { zh: "节点存在污点 nvidia.com/gpu.product，无匹配容忍", en: "node(s) had taint nvidia.com/gpu.product, no toleration" }, gang: 1 },
    { id: "pod-failed-oom", name: "llama4-70b-pretrain-0-old", ns: "training-prod", kind: "Job", gpu: "H100", gpuCount: 8, node: h[3]?.id || "", phase: "failed", restarts: 5, age: { zh: "3 小时", en: "3h" }, image: "registry.cks/pytorch:2.6", owner: "ml-engineer", priority: "Critical", topology: { zh: "NVLink 域内 Gang", en: "NVLink-domain Gang" }, gpuUtil: 0, reason: { zh: "OOMKilled：容器内存超出 1.2 TB 限制", en: "OOMKilled: container exceeded 1.2Ti memory limit" }, gang: 1 },
    { id: "pod-succeeded-cp", name: "checkpoint-export-061", ns: "data-pipeline", kind: "Job", gpu: "H100", gpuCount: 1, node: ht[2]?.id || "", phase: "succeeded", restarts: 0, age: { zh: "5 小时", en: "5h" }, image: "registry.cks/tools:1.0", owner: "pipeline", priority: "High", topology: { zh: "无约束", en: "None" }, gpuUtil: 0, reason: "", gang: 1 },
  ];
  return list;
}

// 集群事件（kubectl get events 语义）
function buildEvents() {
  return [
    { type: "Warning", reason: "GPUHealthDegraded", object: "node/cks-h100-bkk-d004", message: { zh: "GPU 3 ECC 错误计数上升，已标记为 straggler 候选", en: "GPU 3 ECC error count rising, flagged as straggler candidate" }, count: 12, lastSeen: { zh: "2 分钟前", en: "2 min ago" } },
    { type: "Normal", reason: "Scheduled", object: "pod/qwen3-32b-sft-trainer", message: { zh: "training-prod/qwen3-32b-sft-trainer 已调度至 cks-h100-tyo-c003", en: "Assigned training-prod/qwen3-32b-sft-trainer to cks-h100-tyo-c003" }, count: 1, lastSeen: { zh: "6 分钟前", en: "6 min ago" } },
    { type: "Warning", reason: "FailedScheduling", object: "pod/moe-1t-pretrain-gang", message: { zh: "0/21 节点可用：16 Insufficient nvidia.com/gpu", en: "0/21 nodes are available: 16 Insufficient nvidia.com/gpu" }, count: 38, lastSeen: { zh: "1 分钟前", en: "1 min ago" } },
    { type: "Normal", reason: "NodeRemediation", object: "node/cks-h200-tyo-i002", message: { zh: "Mission Control 已触发自动节点修复，Pod 正在驱逐", en: "Mission Control triggered auto remediation, pods evicting" }, count: 3, lastSeen: { zh: "9 分钟前", en: "9 min ago" } },
    { type: "Warning", reason: "OOMKilling", object: "pod/llama4-70b-pretrain-0-old", message: { zh: "容器 pretrain 超出内存上限 1.2Ti", en: "Container pretrain exceeded memory limit 1.2Ti" }, count: 5, lastSeen: { zh: "3 小时前", en: "3h ago" } },
    { type: "Normal", reason: "ScalingReplicaSet", object: "deployment/gb300-moe-serving", message: { zh: "副本集已缩容至 2", en: "Scaled down replica set to 2" }, count: 2, lastSeen: { zh: "15 分钟前", en: "15 min ago" } },
    { type: "Warning", reason: "NVLINKDown", object: "node/cks-b200-tyo-g002", message: { zh: "NVLink 链路 7 降级，机架域内带宽下降 12%", en: "NVLink link 7 degraded, rack bandwidth down 12%" }, count: 7, lastSeen: { zh: "22 分钟前", en: "22 min ago" } },
    { type: "Normal", reason: "QuotaUpdated", object: "resourcequota/research", message: { zh: "nvidia.com/gpu 限额 32 → 40", en: "nvidia.com/gpu limit 32 → 40" }, count: 1, lastSeen: { zh: "1 小时前", en: "1h ago" } },
    { type: "Warning", reason: "Throttling", object: "objectstorage/team-datasets", message: { zh: "对象存储读吞吐超过配额 92%，触发限速", en: "Object storage read throughput at 92% of quota, throttling" }, count: 4, lastSeen: { zh: "11 分钟前", en: "11 min ago" } },
    { type: "Normal", reason: "AutoscalerScaleUp", object: "nodepool/gpu-h100-iad", message: { zh: "自动扩容 +12 节点以满足训练队列", en: "Autoscaler added 12 nodes for training queue" }, count: 1, lastSeen: { zh: "34 分钟前", en: "34 min ago" } },
  ];
}

// 集群元信息（总量取节点池聚合；allocated 从机队实算传入，未传时回退 60% 水位）
function buildCluster(allocated) {
  const totalGpus = POOLS.reduce((s, p) => s + p.gpus * p.nodes, 0);
  const allocatedGpus = Math.min(totalGpus, Math.round(allocated || totalGpus * 0.6));
  const readyPools = POOLS.filter((p) => p.nodes > 0).length;
  return {
    name: "cks-prod-global",
    product: "CKS · Runsun Kubernetes Service",
    version: "v1.32.4-cks",
    region: { zh: "多区域 · JP / TH / US", en: "Multi-region · JP / TH / US" },
    controlPlane: { zh: "托管控制面 · 3 副本高可用", en: "Managed control plane · 3-replica HA" },
    network: "NVIDIA Quantum-2 InfiniBand · 800 Gbps",
    scheduler: { zh: "SUNK 拓扑感知调度器", en: "SUNK topology-aware scheduler" },
    totalNodes: POOLS.reduce((s, p) => s + p.nodes, 0),
    readyNodes: Math.round(POOLS.reduce((s, p) => s + p.nodes, 0) * 0.94),
    totalGpus,
    allocatedGpus: allocatedGpus,
    schedulableGpus: totalGpus - allocatedGpus,
    healthyGpus: Math.round(totalGpus * 0.97),
    stragglers: 18,
    remediation: 9,
    goodput: 94.6,
    mttfHours: 87.8,
    jobRestartSec: 90,
    pools: readyPools,
  };
}

export function k8sSeed(allocated) {
  const nodes = buildNodes();
  const pods = buildPods(nodes);
  return {
    cluster: buildCluster(allocated),
    pools: POOLS,
    nodes,
    quotas: buildQuotas(allocated),
    pods,
    events: buildEvents(),
    scheduled: 14820,
    preempted: 312,
  };
}

export { POOL_REGION };
