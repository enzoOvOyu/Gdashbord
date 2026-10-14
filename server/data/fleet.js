// 万卡级机队生成器：以“集群（节点池 / 超级 Pod）”为单一数据源，
// 由 region → zone → model 三级结构确定容量，总计约一万张 GPU。
// 所有 KPI 均由 state.clusters 实算，保证各业务模块口径一致。
import { GPU, REGIONS, REGION_PREFIX, gpu } from "./catalog.js";

// 各区域目标卡数（合计 ≈ 10,000）
const REGION_TARGET = { "US-IAD-1": 3400, "US-LAX-2": 2800, "JP-TYO-1": 2400, "TH-BKK-1": 1400 };
// 各型号占比
const MODEL_MIX = { H100: 0.28, H200: 0.24, B200: 0.22, B300: 0.16, GB300: 0.10 };

// 租户（与 adminSeed 对应）：集群按就近区域归属
const TENANTS = [
  // 大型企业客户（专属集群，千卡级）
  { id: "tn-001", name: "Nexa AI Labs", region: "US-IAD-1", tier: "enterprise" },
  { id: "tn-007", name: "Helios Bio", region: "US-IAD-1", tier: "enterprise" },
  { id: "tn-008", name: "Meridian Auto", region: "US-LAX-2", tier: "enterprise" },
  { id: "tn-011", name: "Kestrel Finance", region: "US-LAX-2", tier: "enterprise" },
  { id: "tn-002", name: "Sakura Robotics", region: "JP-TYO-1", tier: "enterprise" },
  { id: "tn-006", name: "Orion Research", region: "JP-TYO-1", tier: "enterprise" },
  { id: "tn-014", name: "Atlas Frontier", region: "US-IAD-1", tier: "enterprise" },
  { id: "tn-015", name: "Quantum Grid AI", region: "US-LAX-2", tier: "enterprise" },
  // 中型客户（数百卡）
  { id: "tn-003", name: "Siam Media Tech", region: "TH-BKK-1", tier: "scale" },
  { id: "tn-004", name: "Pacific Vision", region: "US-LAX-2", tier: "scale" },
  { id: "tn-009", name: "Aster Data", region: "US-IAD-1", tier: "scale" },
  { id: "tn-010", name: "Lumen Robotics", region: "JP-TYO-1", tier: "scale" },
  { id: "tn-012", name: "Nova Studios", region: "TH-BKK-1", tier: "scale" },
  { id: "tn-016", name: "Banyan Compute", region: "TH-BKK-1", tier: "scale" },
  { id: "tn-017", name: "Cedar Analytics", region: "US-IAD-1", tier: "scale" },
  { id: "tn-018", name: "Ironwood Labs", region: "JP-TYO-1", tier: "scale" },
  // 小型客户（数十卡，Serverless 为主）
  { id: "tn-005", name: "Bangkok Fintech", region: "TH-BKK-1", tier: "starter" },
  { id: "tn-019", name: "Ratchada Tech", region: "TH-BKK-1", tier: "starter" },
  { id: "tn-020", name: "Mekong Vision", region: "TH-BKK-1", tier: "starter" },
  { id: "tn-021", name: "Aichi Robotics", region: "JP-TYO-1", tier: "starter" },
  { id: "tn-022", name: "Kansai Media", region: "JP-TYO-1", tier: "starter" },
  { id: "tn-023", name: "Downtown AI", region: "US-LAX-2", tier: "starter" },
  { id: "tn-024", name: "Beacon ML", region: "US-IAD-1", tier: "starter" },
  { id: "tn-025", name: "Harbor Genomics", region: "US-LAX-2", tier: "starter" },
];

const FABRIC_LABEL = {
  "400G InfiniBand": "ib400",
  "200G InfiniBand": "ib200",
  "800G InfiniBand": "ib800",
};

const FRIENDLY = ["fabric", "spine", "mesh", "core", "forge", "nexus", "halo", "apex", "quartz", "atlas", "pulse", "vertex", "helix", "ember", "cobalt", "lattice"];

function rngFactory(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function roundTo(n, step) {
  return Math.max(step, Math.round(n / step) * step);
}

// 把 cell 卡数拆分为若干集群
function splitCell(region, zone, g, cell, idxStart, rng, counter) {
  const out = [];
  let remaining = cell;
  const isRack = g.id === "GB300";
  const sizes = isRack ? [72, 144, 216] : [8, 16, 32, 64, 128, 192, 256];
  let i = idxStart;
  while (remaining > 0) {
    const step = isRack ? 72 : 8;
    let sz = pick(rng, sizes);
    sz = Math.min(sz, remaining);
    sz = roundTo(sz, step);
    if (sz <= 0) sz = step;
    if (sz > remaining) sz = roundTo(remaining, step);
    remaining -= sz;
    counter.n++;
    out.push(makeCluster(region, zone, g, sz, counter.n, rng, i++));
  }
  return out;
}

function makeCluster(region, zone, g, count, n, rng, labelIdx) {
  const prefix = REGION_PREFIX[region.id];
  const statusRoll = rng();
  let status = "running";
  if (statusRoll > 0.96) status = "maintenance";
  else if (statusRoll > 0.92) status = "provisioning";
  else if (statusRoll > 0.87) status = "degraded";
  const gpusPerNode = g.id === "GB300" ? 72 : 8;
  const nodes = Math.round(count / gpusPerNode);
  const util = status === "running" ? Math.round(52 + rng() * 43)
    : status === "degraded" ? Math.round(28 + rng() * 40)
    : 0;
  const isRack = g.id === "GB300";
  const network = isRack ? "NVL72 NVLink domain" : region.fabric;
  const topo = isRack ? "NVL72" : "8-GPU NVLink node";
  const scheduler = isRack || g.id === "B300" ? "Slurm" : (n % 2 === 0 ? "Kubernetes" : "Slurm");
  const fabricKey = FABRIC_LABEL[region.fabric] || "ib";
  const name = `${prefix}-${g.id.toLowerCase()}-${fabricKey}-${String(labelIdx + 1).padStart(2, "0")}`;
  const priceHour = +(count * gpu(g.id).price).toFixed(2);
  const billing = rng() > 0.7 ? (rng() > 0.5 ? "reserved" : "spot") : "on-demand";
  const priceEff = billing === "reserved" ? +(priceHour * 0.82).toFixed(2) : billing === "spot" ? +(priceHour * 0.55).toFixed(2) : priceHour;
  const tdp = g.tdp;
  const powerKw = +((count * tdp) / 1000 * 1.12).toFixed(1);
  const carbon = +(powerKw * 0.42).toFixed(1); // kg CO2e / h（按区域电网因子近似）
  const bw = isRack ? "14.4 TB/s NVLink" : (g.arch.includes("Blackwell") ? "3.6 TB/s NVLink" : "900 GB/s NVLink");
  const tempC = status === "running" ? Math.round(30 + rng() * 12) : status === "degraded" ? Math.round(40 + rng() * 8) : 24;
  const nodeHealth = status === "running"
    ? { healthy: nodes - (rng() > 0.8 ? 1 : 0), warn: rng() > 0.8 ? 1 : 0, fault: 0 }
    : status === "degraded"
      ? { healthy: Math.max(0, nodes - 2), warn: 1, fault: 1 }
      : { healthy: 0, warn: 0, fault: 0 };
  const roles = ["training", "inference", "notebook"];
  const rolesSet = ["training", ...(rng() > 0.4 ? ["inference"] : []), ...(rng() > 0.6 ? ["notebook"] : [])];
  const months = 1 + Math.floor(rng() * 18);
  const created = monthsAgo(months);
  const uptimeDays = status === "running" ? Math.round(20 + rng() * 200) : Math.round(rng() * 20);
  const mttbf = Math.round(400 + rng() * 1600);
  return {
    id: "cl-" + String(n).padStart(4, "0"),
    name,
    region: region.id,
    zone: zone.id,
    country: region.country,
    gpu: g.id,
    nodes,
    gpusPerNode,
    count,
    scheduler,
    network,
    topo,
    fabric: region.fabric,
    status,
    util,
    price: priceHour,
    priceEff,
    billing,
    cpuPerNode: g.cpu * gpusPerNode,
    ramPerNode: g.ram * gpusPerNode,
    storagePerNode: isRack ? "276 TB NVMe" : +(7.68 * gpusPerNode).toFixed(1) + " TB NVMe",
    roles: rolesSet,
    powerKw,
    carbon,
    bandwidth: bw,
    tempC,
    nodeHealth,
    jobs: status === "running" ? Math.round(1 + rng() * (isRack ? 8 : 4)) : 0,
    created,
    uptimeDays,
    mttbf,
    tenant: null, // 由调用方填充
    rackUnits: isRack ? nodes * 42 : nodes * 6,
  };
}

function monthsAgo(m) {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { zh: s + " 上线", en: "commissioned " + s };
}

// 构建完整机队（集群数组 + 租户用量）
export function buildFleet(seed = 20261013) {
  const rng = rngFactory(seed);
  const clusters = [];
  const counter = { n: 0 };
  const tenantCursor = {};
  TENANTS.forEach((t) => (tenantCursor[t.id] = 0));

  for (const region of REGIONS) {
    for (const g of GPU) {
      const cell = roundTo(REGION_TARGET[region.id] * MODEL_MIX[g.id], g.id === "GB300" ? 72 : 8);
      // 拆分到若干集群，逐可用区轮转
      let remaining = cell;
      let zi = 0;
      while (remaining > 0) {
        const step = g.id === "GB300" ? 72 : 8;
        const sizes = g.id === "GB300" ? [72, 144, 216] : [8, 16, 32, 64, 128, 192, 256];
        let sz = Math.min(pick(rng, sizes), remaining);
        sz = roundTo(sz, step);
        if (sz <= 0) sz = step;
        if (sz > remaining) sz = roundTo(remaining, step);
        remaining -= sz;
        counter.n++;
        const zone = region.zones[zi % region.zones.length];
        zi++;
        const c = makeCluster(region, zone, g, sz, counter.n, rng, clusters.length);
        // 租户归属：优先就近区域
        const sameRegion = TENANTS.filter((t) => t.region === region.id);
        const pool = sameRegion.length ? sameRegion : TENANTS;
        let pickT = pool[tenantCursor[pool[0].id] % pool.length];
        // 简单轮转
        const idx = pool.findIndex((t) => t.id === pickT.id);
        tenantCursor[pool[0].id] = (tenantCursor[pool[0].id] || 0) + 1;
        c.tenant = pickT.id;
        c.tenantName = pickT.name;
        clusters.push(c);
      }
    }
  }

  // 租户用量汇总
  const usage = {};
  TENANTS.forEach((t) => (usage[t.id] = { id: t.id, name: t.region ? t.name : t.name, capacity: 0, used: 0, region: t.region }));
  clusters.forEach((c) => {
    const u = usage[c.tenant];
    if (!u) return;
    u.capacity += c.count;
    u.used += c.status === "running" ? Math.round(c.count * (c.util / 100)) : 0;
  });

  return { clusters, usage: Object.values(usage), tenants: TENANTS };
}

// 从真实工作负载推导需求：running 实例 + 端点副本 + running 任务 → region -> {gpu -> gpus}
export function workloadDemand(s) {
  const demand = {};
  const add = (region, gpuId, n) => {
    if (!n || n <= 0) return;
    demand[region] = demand[region] || {};
    demand[region][gpuId] = (demand[region][gpuId] || 0) + n;
  };
  (s.instances || []).forEach((x) => { if (x.status === "running") add(x.region, x.gpu, Number(x.count || 0)); });
  (s.endpoints || []).forEach((x) => {
    if (x.status === "scaled-zero") return;
    add(x.region, x.gpu, Number(x.replicas || 0) * Number(x.gpusPerReplica || 1));
  });
  (s.jobs || []).forEach((x) => { if (x.status === "running") add(x.region, x.gpu, Number(x.count || 0)); });
  return demand;
}

// 需求 → 集群分配映射（同区域同型号按容量比例分摊，单集群上限 95%）
export function assignDemand(clusters, demand) {
  const assigned = new Map(); // cluster.id -> gpus
  for (const region of Object.keys(demand)) {
    for (const gpuId of Object.keys(demand[region])) {
      const need = demand[region][gpuId];
      const pool = clusters.filter((c) => c.region === region && c.gpu === gpuId && (c.status === "running" || c.status === "degraded"));
      const poolCap = pool.reduce((a, c) => a + c.count, 0);
      if (!poolCap) continue; // 该区域无此型号可用集群：负载无法承载（不应发生）
      let remain = need;
      pool.forEach((c) => {
        const share = Math.min(Math.round((c.count / poolCap) * need), Math.round(c.count * 0.95));
        assigned.set(c.id, share);
        remain -= share;
      });
      if (remain > 0) pool.forEach((c) => {
        const extra = Math.min(remain, c.count - (assigned.get(c.id) || 0));
        assigned.set(c.id, (assigned.get(c.id) || 0) + extra);
        remain -= extra;
      });
      // 池仍放不下（理论不发生：生成端有放置守卫）——按比例记录溢出供诊断
      if (remain > 0) (demand.__overflow = demand.__overflow || 0, demand.__overflow += remain);
    }
  }
  return assigned;
}

// 由状态实算机队 KPI —— 分配量从真实工作负载闭环推导（消除悬空分配）：
// 负载需求 → 按区域/型号聚合 → 分摊到集群 → 实算 util 与机队 KPI
export function fleetFromState(s) {
  const clusters = (s && s.clusters) || [];
  let total = 0, online = 0, reserved = 0;
  const byRegion = {};
  const byModel = {};
  const byZone = {};
  const health = { healthy: 0, degraded: 0, provisioning: 0, maintenance: 0 };

  const demand = workloadDemand(s);
  const assigned = assignDemand(clusters, demand);

  // 按租户维度记录需求（region -> gpu -> n），用于把集群分配量精确归因到租户
  const tenantDemand = {};
  const addT = (tenant, region, gpuId, n) => {
    if (!n || n <= 0 || !tenant) return;
    tenantDemand[tenant] = tenantDemand[tenant] || {};
    tenantDemand[tenant][region] = tenantDemand[tenant][region] || {};
    tenantDemand[tenant][region][gpuId] = (tenantDemand[tenant][region][gpuId] || 0) + n;
  };
  (s.instances || []).forEach((x) => { if (x.status === "running") addT(x.tenant, x.region, x.gpu, Number(x.count || 0)); });
  (s.endpoints || []).forEach((x) => {
    if (x.status === "scaled-zero") return;
    addT(x.tenant, x.region, x.gpu, Number(x.replicas || 0) * Number(x.gpusPerReplica || 1));
  });
  (s.jobs || []).forEach((x) => { if (x.status === "running") addT(x.tenant, x.region, x.gpu, Number(x.count || 0)); });

  // 每个资源池（region×gpu）的集群分配总量，按租户需求占比精确归因
  const poolAssigned = {};
  clusters.forEach((c) => {
    const key = c.region + ":" + c.gpu;
    poolAssigned[key] = (poolAssigned[key] || 0) + (assigned.get(c.id) || 0);
  });
  const tenantUsage = {};
  for (const t of Object.keys(tenantDemand)) {
    let used = 0;
    let hourly = 0;
    for (const region of Object.keys(tenantDemand[t])) {
      for (const gpuId of Object.keys(tenantDemand[t][region])) {
        const tNeed = tenantDemand[t][region][gpuId];
        const totalNeed = (demand[region] && demand[region][gpuId]) || 0;
        const poolA = poolAssigned[region + ":" + gpuId] || 0;
        if (totalNeed > 0) used += poolA * (tNeed / totalNeed);
      }
    }
    tenantUsage[t] = { used: Math.round(used), hourly: 0 };
  }
  // 租户计费时价：按其负载的目录价逐项实算（与费用中心口径一致）
  const priceOf = (gpuId) => { const g = GPU.find((x) => x.id === gpuId); return g ? g.price : 0; };
  for (const t of Object.keys(tenantUsage)) {
    let hourly = 0;
    (s.instances || []).forEach((x) => { if (x.tenant === t && x.status === "running") hourly += priceOf(x.gpu) * Number(x.count || 0); });
    (s.endpoints || []).forEach((x) => { if (x.tenant === t && x.status !== "scaled-zero") hourly += priceOf(x.gpu) * Number(x.replicas || 0) * Number(x.gpusPerReplica || 1); });
    (s.jobs || []).forEach((x) => { if (x.tenant === t && x.status === "running") hourly += priceOf(x.gpu) * Number(x.count || 0); });
    tenantUsage[t].hourly = +hourly.toFixed(2);
  }

  let allocated = 0;
  for (const c of clusters) {
    total += c.count;
    if (c.status === "running" || c.status === "degraded") online += c.count;
    const used = Math.min(c.count, assigned.get(c.id) || 0);
    allocated += used;
    if (c.billing === "reserved") reserved += used;
    c.liveUtil = Math.round((used / c.count) * 100);
    byRegion[c.region] = byRegion[c.region] || { region: c.region, total: 0, online: 0, allocated: 0, free: 0 };
    byRegion[c.region].total += c.count;
    byRegion[c.region].online += (c.status === "running" || c.status === "degraded") ? c.count : 0;
    byRegion[c.region].allocated += used;
    byModel[c.gpu] = byModel[c.gpu] || { gpu: c.gpu, total: 0, allocated: 0, free: 0 };
    byModel[c.gpu].total += c.count;
    byModel[c.gpu].allocated += used;
    byZone[c.zone] = byZone[c.zone] || { zone: c.zone, region: c.region, total: 0, allocated: 0, free: 0 };
    byZone[c.zone].total += c.count;
    byZone[c.zone].allocated += used;
    const healthKey = c.status === "running" ? "healthy" : c.status;
    if (health[healthKey] !== undefined) health[healthKey] += 1;
  }
  for (const k in byRegion) byRegion[k].free = byRegion[k].total - byRegion[k].allocated;
  for (const k in byModel) byModel[k].free = byModel[k].total - byModel[k].allocated;
  for (const k in byZone) byZone[k].free = byZone[k].total - byZone[k].allocated;
  const free = total - allocated;
  return {
    total,
    online,
    allocated,
    free,
    reserved,
    utilization: total ? Math.round((allocated / total) * 100) : 0,
    reservedPct: allocated ? Math.round((reserved / allocated) * 100) : 0,
    clusters: clusters.length,
    byRegion: Object.values(byRegion),
    byModel: Object.values(byModel),
    byZone: Object.values(byZone),
    health,
    tenantUsage,
    _assigned: assigned,
  };
}

// 各区域 / 型号可立即分配的库存（供部署中心展示）
export function fleetInventory(s) {
  const f = fleetFromState(s);
  return {
    byRegion: f.byRegion.map((r) => ({ ...r, name: (REGIONS.find((x) => x.id === r.region) || {}).name || r.region })),
    byModel: f.byModel,
    total: f.total,
    free: f.free,
    allocated: f.allocated,
    utilization: f.utilization,
  };
}
