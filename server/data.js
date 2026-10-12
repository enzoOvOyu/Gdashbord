// Mock 数据源 —— GPU 云控制台
// 使用种子随机数，保证每次重启数据一致

// 简单可复现的伪随机
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260424);

// ---------- GPU 市场数据（参考 RunPod 卡片 + Vast.ai 筛选维度） ----------
export const gpus = [
  { id: 'rtx4090',  name: 'RTX 4090',  arch: 'Ada Lovelace', vram: 24,  cuda: '12.4', price: 1.88,  memberPrice: 1.79, dlperf: 165.2, stock: 128, regions: ['北京三区', '上海二区', '广州一区'], cloudType: 'both',    tflops: '165.2 Tensor' },
  { id: 'rtx5090',  name: 'RTX 5090',  arch: 'Blackwell',    vram: 32,  cuda: '12.8', price: 2.78,  memberPrice: 2.64, dlperf: 210.0, stock: 64,  regions: ['北京三区', '内蒙古一区'],           cloudType: 'secure',  tflops: '210 Tensor' },
  { id: 'v100',     name: 'V100',      arch: 'Volta',        vram: 32,  cuda: '12.0', price: 1.88,  memberPrice: 1.69, dlperf: 125.0, stock: 96,  regions: ['北京三区', '上海二区'],             cloudType: 'community', tflops: '125 Tensor' },
  { id: 'a800',     name: 'A800-80GB', arch: 'Ampere',       vram: 80,  cuda: '12.4', price: 4.98,  memberPrice: 4.73, dlperf: 312.0, stock: 32,  regions: ['内蒙古一区', '北京三区'],           cloudType: 'secure',  tflops: '312 Tensor' },
  { id: 'h800',     name: 'H800/80GB', arch: 'Hopper',       vram: 80,  cuda: '12.6', price: 8.88,  memberPrice: 8.44, dlperf: 756.0, stock: 16,  regions: ['内蒙古一区'],                       cloudType: 'secure',  tflops: '756 Tensor' },
  { id: 'h20',      name: 'H20/96GB',  arch: 'Hopper',       vram: 96,  cuda: '12.6', price: 7.58,  memberPrice: 7.20, dlperf: 148.0, stock: 24,  regions: ['北京三区'],                         cloudType: 'secure',  tflops: '148 Tensor' },
  { id: 'l40s',     name: 'L40S',      arch: 'Ada Lovelace', vram: 48,  cuda: '12.4', price: 3.20,  memberPrice: 3.04, dlperf: 181.1, stock: 48,  regions: ['上海二区', '广州一区'],             cloudType: 'both',    tflops: '181 Tensor' },
  { id: 'rtx3090',  name: 'RTX 3090',  arch: 'Ampere',       vram: 24,  cuda: '12.2', price: 1.32,  memberPrice: 1.25, dlperf: 71.0,  stock: 156, regions: ['北京三区', '广州一区', '美西一区'], cloudType: 'community', tflops: '71 Tensor' },
  { id: 'rtxa4000', name: 'RTX A4000', arch: 'Ampere',       vram: 16,  cuda: '12.2', price: 0.92,  memberPrice: 0.87, dlperf: 76.7,  stock: 210, regions: ['北京三区', '美西一区'],             cloudType: 'community', tflops: '76.7 Tensor' },
  { id: '4090d',    name: 'RTX 4090D', arch: 'Ada Lovelace', vram: 24,  cuda: '12.4', price: 1.68,  memberPrice: 1.60, dlperf: 147.0, stock: 88,  regions: ['上海二区', '广州一区'],             cloudType: 'both',    tflops: '147 Tensor' },
];

// ---------- 实例数据（参考 AutoDL 实例控制台：状态六色、无卡模式等） ----------
export const instances = [
  { id: 'inst-001', name: 'nlp-train-001',   image: 'PyTorch 2.4 / CUDA 12.4', gpu: 'NVIDIA H100 × 8',  gpuId: 'h800',   gpuCount: 8, region: '北京三区', regionCode: 'cn-bj-3', status: 'running',  costPerHour: 12.00, createdAt: '2026-04-24 10:23',  disk: { used: 132, total: 500 }, gpuUtil: 92, memUtil: 78,  mode: 'gpu' },
  { id: 'inst-002', name: 'vision-finetune', image: 'PyTorch 2.1 / CUDA 12.1', gpu: 'NVIDIA A100 × 4',  gpuId: 'a800',   gpuCount: 4, region: '上海二区', regionCode: 'cn-sh-2', status: 'starting', costPerHour: 5.60,  createdAt: '2026-04-24 09:18',  disk: { used: 89,  total: 300 }, gpuUtil: 0,  memUtil: 0,   mode: 'gpu' },
  { id: 'inst-003', name: 'sd-webui',        image: 'Stable Diffusion WebUI',  gpu: 'NVIDIA L40S × 1',  gpuId: 'l40s',   gpuCount: 1, region: '北京三区', regionCode: 'cn-bj-3', status: 'running',  costPerHour: 1.20,  createdAt: '2026-04-23 20:11',  disk: { used: 45,  total: 150 }, gpuUtil: 65, memUtil: 54,  mode: 'gpu' },
  { id: 'inst-004', name: 'llm-eval',        image: 'vLLM 0.6 / CUDA 12.4',    gpu: 'NVIDIA H20 × 8',   gpuId: 'h20',    gpuCount: 8, region: '北京三区', regionCode: 'cn-bj-3', status: 'stopped',  costPerHour: 8.00,  createdAt: '2026-04-23 14:02',  disk: { used: 210, total: 500 }, gpuUtil: 0,  memUtil: 0,   mode: 'gpu' },
  { id: 'inst-005', name: 'research-env',    image: 'JupyterLab / CUDA 12.2',  gpu: 'NVIDIA A100 × 2',  gpuId: 'a800',   gpuCount: 2, region: '美西一区', regionCode: 'us-wes-1', status: 'running', costPerHour: 2.40,  createdAt: '2026-04-22 16:37',  disk: { used: 67,  total: 200 }, gpuUtil: 41, memUtil: 63,  mode: 'gpu' },
  { id: 'inst-006', name: 'data-process',    image: 'CUDA 12.2 基础镜像',       gpu: 'RTX 4090 × 2',     gpuId: 'rtx4090', gpuCount: 2, region: '广州一区', regionCode: 'cn-gz-1', status: 'error',   costPerHour: 3.76,  createdAt: '2026-04-21 11:45',  disk: { used: 23,  total: 100 }, gpuUtil: 0,  memUtil: 0,   mode: 'gpu', error: 'ERR_408: 镜像拉取失败，请重试或更换镜像' },
  { id: 'inst-007', name: 'code-edit-dev',   image: 'VSCode Server 基础镜像',   gpu: '—（无卡模式）',     gpuId: null,     gpuCount: 0, region: '北京三区', regionCode: 'cn-bj-3', status: 'running',  costPerHour: 0.01,  createdAt: '2026-04-20 08:30',  disk: { used: 12,  total: 50 },  gpuUtil: 0,  memUtil: 18,  mode: 'no-gpu' },
];

// ---------- 镜像商城（参考优云智算镜像商城） ----------
export const images = [
  { id: 'img-01', name: 'PyTorch 2.4 + CUDA 12.4',   category: '框架',     downloads: 128400, size: '18.2 GB', desc: '官方 PyTorch 2.4.0 + Python 3.11 + cuDNN，开箱即用', tags: ['官方', '热门'], icon: '🔥' },
  { id: 'img-02', name: 'Stable Diffusion WebUI',    category: 'AI 应用',  downloads: 96700,  size: '22.5 GB', desc: '整合 SDXL / Flux 模型与常用插件，一键部署出图',     tags: ['一键部署', 'AIGC'], icon: '🎨' },
  { id: 'img-03', name: 'ComfyUI 工作流',             category: 'AI 应用',  downloads: 84100,  size: '20.1 GB', desc: '节点式工作流，预置常见出图/视频工作流',              tags: ['一键部署'], icon: '🧩' },
  { id: 'img-04', name: 'vLLM + Qwen2.5-72B',        category: '大模型',   downloads: 45200,  size: '145 GB',  desc: 'vLLM 0.6 推理服务，内置 Qwen2.5-72B-Instruct 权重',  tags: ['推理', '热门'], icon: '🤖' },
  { id: 'img-05', name: 'Ollama + Llama3',           category: '大模型',   downloads: 78900,  size: '32 GB',   desc: 'Ollama 运行时 + Llama3-8B，快速本地对话',           tags: ['推理'], icon: '🦙' },
  { id: 'img-06', name: 'TensorFlow 2.16 + CUDA',    category: '框架',     downloads: 32100,  size: '16.8 GB', desc: 'TF 2.16 官方镜像，含 TensorBoard',                   tags: ['官方'], icon: '📊' },
  { id: 'img-07', name: 'JupyterLab 数据科学',        category: '工具',     downloads: 67800,  size: '8.4 GB',  desc: 'JupyterLab 4 + pandas/numpy/sklearn 全家桶',         tags: ['轻量'], icon: '📓' },
  { id: 'img-08', name: 'Whisper 语音转写',           category: 'AI 应用',  downloads: 29600,  size: '12 GB',   desc: 'Whisper large-v3，支持中英多语种转写',               tags: ['一键部署'], icon: '🎙️' },
];

// ---------- 平台公告 ----------
export const announcements = [
  { id: 1, title: 'H20 GPU 已在多个地域上线', content: '全新 H20 96GB 实例已在北京三区/上海二区开放租用，性能更强 2 倍。', date: '2026-04-20', type: 'new' },
  { id: 2, title: '北京三区维护通知',         content: '将于 4 月 28 日 02:00-04:00 进行网络升级，期间可能有短暂抖动。', date: '2026-04-18', type: 'maintain' },
  { id: 3, title: '新用户专属优惠',           content: '新用户充值最高可享 50% 增送，立即参与！',                        date: '2026-04-15', type: 'promo' },
];

// ---------- 账户 / 配额 ----------
export const account = {
  balance: 12650.0,
  todayCost: 320.5,
  todayCostDelta: -0.18,
  runningInstances: 12,
  totalInstances: 18,
  gpuUsed: 88,
  gpuTotal: 128,
  storageUsedGB: 1.2 * 1024,
  storageTotalGB: 5 * 1024,
  quotaExpireDays: 42,
};

// ---------- 生成趋势数据（近 N 天） ----------
export function costTrend(days = 7) {
  const out = [];
  const now = new Date('2026-04-24T00:00:00+08:00');
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    const base = 280 + rand() * 420 + (days - i) * 6;
    out.push({ date: label, cost: +base.toFixed(2) });
  }
  out[out.length - 1].cost = account.todayCost;
  return out;
}

export function gpuUsageTrend(days = 7) {
  const out = [];
  const now = new Date('2026-04-24T00:00:00+08:00');
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    out.push({
      date: label,
      computing: Math.round(48 + rand() * 50),   // 计算中
      idle: Math.round(18 + rand() * 34),        // 空闲
      other: Math.round(4 + rand() * 12),        // 其他
    });
  }
  return out;
}

// 实例级实时监控（参考 Modal 监控页：细粒度指标 + 日志）
export function instanceMetrics(id, points = 60) {
  const inst = instances.find((i) => i.id === id);
  const now = Date.now();
  const out = { gpuUtil: [], memUtil: [], vram: [], power: [], network: [] };
  for (let i = points; i >= 0; i--) {
    const t = now - i * 5000;
    const wave = (label, base, amp) => ({
      time: new Date(t).toISOString().slice(11, 19),
      value: inst && inst.status === 'running' && inst.mode === 'gpu'
        ? +Math.max(0, base + Math.sin((points - i) / 6) * amp + rand() * amp * 0.6).toFixed(1)
        : 0,
    });
    out.gpuUtil.push(wave('gpu', inst?.gpuUtil || 0, 12));
    out.memUtil.push(wave('mem', inst?.memUtil || 0, 8));
    out.vram.push(wave('vram', inst?.mode === 'gpu' ? 62 : 0, 10));
    out.power.push(wave('power', inst?.mode === 'gpu' ? 310 : 0, 60));
    out.network.push(wave('net', inst?.mode === 'gpu' ? 220 : 5, 90));
  }
  // 展平为 [{time, gpuUtil, memUtil...}] 方便前端直接用
  const merged = out.gpuUtil.map((p, idx) => ({
    time: p.time,
    gpuUtil: p.value,
    memUtil: out.memUtil[idx].value,
    vram: out.vram[idx].value,
    power: out.power[idx].value,
    network: out.network[idx].value,
  }));
  return merged;
}

const LOG_TEMPLATES = [
  '[INFO] dataset loaded: 128,450 samples in 3.2s',
  '[INFO] epoch 12/50 - loss: 0.3421 - lr: 3.0e-4 - 128.4 it/s',
  '[INFO] checkpoint saved to /workspace/ckpts/epoch_12.pt (2.1 GB)',
  '[INFO] GPU 0 util 96% | mem 71.2/80.0 GB | temp 72°C | power 402W',
  '[WARN] dataloader worker 3 slow: batch wait 1.8s > 1.0s threshold',
  '[INFO] eval accuracy: 0.8842 (+0.0031)',
  '[INFO] NCCL all-reduce latency p99: 4.2ms (8 GPUs healthy)',
  '[ERROR] connection reset by peer 172.31.2.45:50052, retrying (1/3)',
  '[INFO] wandb run synced: https://wandb.ai/demo/train-001/runs/x7f2',
  '[INFO] epoch 13/50 started',
];

export function instanceLogs(id, lines = 120) {
  const out = [];
  const start = Date.now() - lines * 4000;
  for (let i = 0; i < lines; i++) {
    const t = new Date(start + i * 4000).toISOString().replace('T', ' ').slice(0, 19);
    out.push({ ts: t, text: LOG_TEMPLATES[Math.floor(rand() * LOG_TEMPLATES.length)] });
  }
  return out;
}

// 费用中心
export function billingRecords() {
  const rows = [
    ['2026-04-24', '实例费用', 'nlp-train-001 (H100 × 8)', '-¥ 96.00'],
    ['2026-04-24', '实例费用', 'sd-webui (L40S × 1)',       '-¥ 14.40'],
    ['2026-04-24', '实例费用', 'research-env (A100 × 2)',    '-¥ 28.80'],
    ['2026-04-23', '实例费用', 'nlp-train-001 (H100 × 8)',   '-¥ 288.00'],
    ['2026-04-23', '存储费用', '网络云盘 500GB',              '-¥ 17.50'],
    ['2026-04-22', '充值',     '支付宝充值',                  '+¥ 5,000.00'],
    ['2026-04-21', '实例费用', 'vision-finetune (A100 × 4)', '-¥ 134.40'],
    ['2026-04-20', '充值',     '对公转账',                    '+¥ 10,000.00'],
  ];
  return rows.map(([date, type, desc, amount], i) => ({ id: 'bill-' + i, date, type, desc, amount }));
}
