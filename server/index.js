import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  gpus, instances, images, announcements, account,
  costTrend, gpuUsageTrend, instanceMetrics, instanceLogs, billingRecords,
} from './data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ---------- Overview（Dashboard 首页聚合数据） ----------
app.get('/api/overview', (req, res) => {
  const range = parseInt(req.query.range) || 7;
  const statusDist = { running: 12, starting: 2, stopped: 3, error: 1 };
  res.json({
    account,
    costTrend: costTrend(range),
    gpuUsageTrend: gpuUsageTrend(range),
    statusDist,
    announcements,
    recentInstances: instances.slice(0, 5),
  });
});

// ---------- 实例管理 ----------
app.get('/api/instances', (req, res) => {
  res.json(instances);
});

app.post('/api/instances/:id/action', (req, res) => {
  const inst = instances.find((i) => i.id === req.params.id);
  if (!inst) return res.status(404).json({ error: 'instance not found' });
  const { action } = req.body;
  switch (action) {
    case 'start':
      if (inst.mode === 'no-gpu') return res.status(400).json({ error: '无卡实例请使用无卡模式开机' });
      inst.status = 'starting';
      setTimeout(() => { inst.status = 'running'; }, 4000);
      break;
    case 'start-no-gpu':
      inst.mode = 'no-gpu';
      inst.status = 'running';
      inst.gpu = '—（无卡模式）';
      inst.costPerHour = 0.01;
      break;
    case 'stop':
      inst.status = 'stopped';
      inst.gpuUtil = 0; inst.memUtil = 0;
      break;
    case 'terminate':
      instances.splice(instances.indexOf(inst), 1);
      return res.json({ ok: true, message: '实例已释放' });
    case 'restart':
      inst.status = 'starting';
      setTimeout(() => { inst.status = 'running'; }, 4000);
      break;
    default:
      return res.status(400).json({ error: 'unknown action' });
  }
  res.json({ ok: true });
});

// ---------- GPU 市场（RunPod 卡片 + Vast.ai 筛选） ----------
app.get('/api/gpus', (req, res) => {
  let list = [...gpus];
  const { minVram, maxPrice, region, cloudType, sort } = req.query;
  if (minVram) list = list.filter((g) => g.vram >= +minVram);
  if (maxPrice) list = list.filter((g) => g.price <= +maxPrice);
  if (region) list = list.filter((g) => g.regions.includes(region));
  if (cloudType && cloudType !== 'all') {
    list = list.filter((g) => g.cloudType === cloudType || g.cloudType === 'both');
  }
  switch (sort) {
    case 'price-asc': list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'dlperf-desc': list.sort((a, b) => b.dlperf - a.dlperf); break;
    case 'vram-desc': list.sort((a, b) => b.vram - a.vram); break;
    case 'value': list.sort((a, b) => (b.dlperf / b.price) - (a.dlperf / a.price)); break;
  }
  res.json(list);
});

app.get('/api/gpus/regions', (req, res) => {
  const set = new Set();
  gpus.forEach((g) => g.regions.forEach((r) => set.add(r)));
  res.json([...set]);
});

// ---------- 创建实例（RunPod 部署向导） ----------
app.post('/api/instances', (req, res) => {
  const { name, gpuId, gpuCount = 1, image, diskSize = 50, pricing = 'on-demand', region } = req.body;
  const gpu = gpus.find((g) => g.id === gpuId);
  if (!gpu) return res.status(400).json({ error: 'invalid gpu' });
  const inst = {
    id: 'inst-' + String(instances.length + 1).padStart(3, '0'),
    name: name || 'new-instance',
    image: image || 'PyTorch 2.4 / CUDA 12.4',
    gpu: `NVIDIA ${gpu.name} × ${gpuCount}`,
    gpuId: gpu.id,
    gpuCount: +gpuCount,
    region: region || gpu.regions[0],
    regionCode: 'cn-bj-3',
    status: 'starting',
    costPerHour: +(gpu.price * gpuCount * (pricing === 'spot' ? 0.55 : 1)).toFixed(2),
    createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    disk: { used: 0, total: +diskSize },
    gpuUtil: 0, memUtil: 0, mode: 'gpu',
  };
  instances.unshift(inst);
  setTimeout(() => { inst.status = 'running'; }, 5000);
  res.json(inst);
});

// ---------- 镜像商城 ----------
app.get('/api/images', (req, res) => {
  let list = [...images];
  if (req.query.category && req.query.category !== '全部') {
    list = list.filter((i) => i.category === req.query.category);
  }
  res.json(list);
});

// ---------- 监控 & 日志 ----------
app.get('/api/instances/:id/metrics', (req, res) => {
  res.json(instanceMetrics(req.params.id));
});

app.get('/api/instances/:id/logs', (req, res) => {
  res.json(instanceLogs(req.params.id, parseInt(req.query.lines) || 120));
});

// ---------- 费用中心 ----------
app.get('/api/billing', (req, res) => {
  res.json({ balance: account.balance, records: billingRecords() });
});

// ---------- 生产模式：托管前端静态文件 ----------
const distDir = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distDir));
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[gdashboard] server listening on http://0.0.0.0:${PORT}`);
});
