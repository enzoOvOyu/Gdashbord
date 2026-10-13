// 统一成本口径：所有模块（工作空间 / 推理 / 训练 / 集群 / 存储）按同一套价目表实算
// 单位统一为 USD
import { gpu } from "../data/catalog.js";

export const HOURS_PER_MONTH = 730;
export const STORAGE_PRICE_PER_GB = 0.15; // USD / GB·月
export const CURRENCY = "USD";

const r2 = (n) => Number(Number(n || 0).toFixed(2));

// 单个工作负载的小时费率（USD/h）
export function hourlyRate(item) {
  if (!item) return 0;
  const unit = gpu(item.gpu).price;
  if (item.kindType === "workspace") {
    return item.status === "running" ? unit * Number(item.count || 1) : 0;
  }
  if (item.kindType === "endpoint") {
    return unit * Number(item.replicas || 0) * Number(item.gpusPerReplica || 1);
  }
  if (item.kindType === "job") {
    return item.status === "running" ? unit * Number(item.count || 1) * Number(item.nodes || 1) : 0;
  }
  if (item.kindType === "cluster") {
    const total = Number(item.count || 0);
    return item.status === "running" ? (item.price ? Number(item.price) : unit * total) : 0;
  }
  return 0;
}

// 明细行（供费用中心与总览共用）
export function costLines(s) {
  const lines = [];
  (s.instances || []).forEach((x) => {
    const h = hourlyRate({ ...x, kindType: "workspace" });
    lines.push({ id: x.id, kind: "workspace", kindLabel: { zh: "GPU 工作空间", en: "GPU workspace" }, name: x.name, gpu: x.gpu, count: x.count, region: x.region, status: x.status, hourly: r2(h), monthly: r2(h * HOURS_PER_MONTH) });
  });
  (s.endpoints || []).forEach((x) => {
    const h = hourlyRate({ ...x, kindType: "endpoint" });
    lines.push({ id: x.id, kind: "endpoint", kindLabel: { zh: "推理服务", en: "Inference" }, name: x.name, gpu: x.gpu, count: (x.replicas || 0) * (x.gpusPerReplica || 1), region: x.region, status: x.status, hourly: r2(h), monthly: r2(h * HOURS_PER_MONTH) });
  });
  (s.jobs || []).forEach((x) => {
    const h = hourlyRate({ ...x, kindType: "job" });
    lines.push({ id: x.id, kind: "job", kindLabel: { zh: "训练任务", en: "Training job" }, name: x.name, gpu: x.gpu, count: Number(x.count || 1) * Number(x.nodes || 1), region: x.region, status: x.status, hourly: r2(h), monthly: r2(h * HOURS_PER_MONTH) });
  });
  (s.clusters || []).forEach((x) => {
    const h = hourlyRate({ ...x, kindType: "cluster" });
    lines.push({ id: x.id, kind: "cluster", kindLabel: { zh: "分布式集群", en: "Cluster" }, name: x.name, gpu: x.gpu, count: x.count, region: x.region, status: x.status, hourly: r2(h), monthly: r2(h * HOURS_PER_MONTH) });
  });
  const volGb = (s.assets?.volumes || []).reduce((a, v) => a + Number(v.gb || 0), 0);
  const storageMonthly = r2(volGb * STORAGE_PRICE_PER_GB);
  lines.push({ id: "storage", kind: "storage", kindLabel: { zh: "存储与快照", en: "Storage & snapshots" }, name: "Persistent volumes", gpu: "—", count: volGb, region: "multi-region", status: "running", hourly: r2(storageMonthly / HOURS_PER_MONTH), monthly: storageMonthly });
  return lines;
}

const CATS = [
  { id: "workspace", name: { zh: "GPU 工作空间", en: "GPU workspaces" }, sub: { zh: "开发 / 调试 / Notebook", en: "Dev / debugging" } },
  { id: "endpoint", name: { zh: "推理服务", en: "Inference" }, sub: { zh: "Serverless / 专属副本", en: "Serverless / dedicated" } },
  { id: "training", name: { zh: "训练与集群", en: "Training & clusters" }, sub: { zh: "作业队列 / 分布式训练", en: "Job queue / distributed" } },
  { id: "storage", name: { zh: "存储与快照", en: "Storage & snapshots" }, sub: { zh: "共享卷 / 对象存储", en: "Shared volumes / buckets" } },
];

// 分类汇总（费用结构）
export function costSummary(s) {
  const lines = costLines(s);
  const bills = CATS.map((c) => {
    const monthly = r2(lines.filter((l) => (c.id === "training" ? l.kind === "job" || l.kind === "cluster" : l.kind === c.id)).reduce((a, l) => a + l.monthly, 0));
    return { ...c, cost: monthly };
  });
  const monthly = r2(bills.reduce((a, b) => a + b.cost, 0));
  bills.forEach((b) => { b.pct = monthly ? Math.round((b.cost / monthly) * 100) : 0; });
  const hourly = r2(lines.reduce((a, l) => a + l.hourly, 0));
  const gpuCount = lines.filter((l) => l.kind !== "storage").reduce((a, l) => a + Number(l.count || 0), 0);
  return { bills, lines, monthly, hourly, gpuCount, gpuHours: r2(gpuCount * HOURS_PER_MONTH), currency: CURRENCY };
}
