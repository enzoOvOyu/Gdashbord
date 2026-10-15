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
    return item.status === "running" ? unit * Number(item.count || 1) : 0;
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
    lines.push({ id: x.id, kind: "job", kindLabel: { zh: "训练任务", en: "Training job" }, name: x.name, gpu: x.gpu, count: Number(x.count || 1), region: x.region, status: x.status, hourly: r2(h), monthly: r2(h * HOURS_PER_MONTH) });
  });
  // 注：clusters 为物理机队容量，其上的工作负载（实例 / 端点 / 任务）已单独计费，避免重复计算。
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
  const gpuCount = lines.filter((l) => l.kind !== "storage" && l.hourly > 0).reduce((a, l) => a + Number(l.count || 0), 0);
  return { bills, lines, monthly, hourly, gpuCount, gpuHours: r2(gpuCount * HOURS_PER_MONTH), currency: CURRENCY };
}

/* ================= 账单历史与预算洞察 ================= */
// 说明：seed 的 bills 为空，早期前端用硬编码趋势（如 +12.6%）填充。这里改为由实算的
// 当月消费反推确定性历史曲线并落盘，保证刷新 / 重启后读数稳定，且趋势与真实口径同源。

const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function seedFrom(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// 近 months 个月账单：当月为实算值，历史月按确定性增长曲线反推
export function billHistory(s, months = 6) {
  if (Array.isArray(s.bills) && s.bills.length === months) return s.bills;
  const monthly = costSummary(s).monthly;
  const rng = lcg(seedFrom(String(s.project || "runsun") + "|" + monthly));
  const now = new Date();
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let factor = 1;
    for (let k = i; k > 0; k--) factor *= 0.86 + rng() * 0.13;
    out.push({
      key,
      label: { zh: (d.getMonth() + 1) + "月", en: MONTH_EN[d.getMonth()] },
      cost: i === 0 ? r2(monthly) : r2(monthly * factor),
    });
  }
  s.bills = out;
  return out;
}

// 预算使用率不做 100% 截断：超支时单独给出超支金额与月底预估，避免掩盖风险
export function budgetInsight(s) {
  const cost = costSummary(s);
  const budget = Number(s.budget || 0);
  const balance = Number(s.balance || 0);
  const history = billHistory(s);
  const cur = history.length ? history[history.length - 1].cost : cost.monthly;
  const prev = history.length > 1 ? history[history.length - 2].cost : 0;
  const usedPct = budget > 0 ? Math.round((cur / budget) * 1000) / 10 : 0;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = now.getDate() / daysInMonth;
  const forecast = elapsed > 0 ? r2(cur / elapsed) : cur;

  return {
    budget,
    balance,
    monthCost: cur,
    prevMonthCost: prev,
    deltaPct: prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null,
    usedPct,
    barPct: Math.min(100, usedPct),
    overBudget: usedPct > 100,
    overage: Math.max(0, r2(cur - budget)),
    remaining: Math.max(0, r2(budget - cur)),
    forecast,
    forecastOverage: Math.max(0, r2(forecast - budget)),
    monthProgressPct: Math.round(elapsed * 1000) / 10,
    history,
    currency: CURRENCY,
  };
}
