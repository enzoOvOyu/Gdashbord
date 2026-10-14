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
  { id: "tn-001", name: "Nexa AI Labs", region: "US-IAD-1" },
  { id: "tn-002", name: "Sakura Robotics", region: "JP-TYO-1" },
  { id: "tn-003", name: "Siam Media Tech", region: "TH-BKK-1" },
  { id: "tn-004", name: "Pacific Vision", region: "US-LAX-2" },
  { id: "tn-005", name: "Bangkok Fintech", region: "TH-BKK-1" },
  { id: "tn-006", name: "Orion Research", region: "JP-TYO-1" },
  { id: "tn-007", name: "Helios Bio", region: "US-IAD-1" },
  { id: "tn-008", name: "Meridian Auto", region: "US-LAX-2" },
  { id: "tn-009", name: "Aster Data", region: "US-IAD-1" },
  { id: "tn-010", name: "Lumen Robotics", region: "JP-TYO-1" },
  { id: "tn-011", name: "Kestrel Finance", region: "US-LAX-2" },
  { id: "tn-012", name: "Nova Studios", region: "TH-BKK-1" },
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

// 由状态实算机队 KPI
export function fleetFromState(s) {
  const clusters = (s && s.clusters) || [];
  let total = 0, online = 0, allocated = 0, reserved = 0;
  const byRegion = {};
  const byModel = {};
  const byZone = {};
  const health = { healthy: 0, degraded: 0, provisioning: 0, maintenance: 0 };
  for (const c of clusters) {
    total += c.count;
    if (c.status === "running" || c.status === "degraded") online += c.count;
    const used = c.status === "running" ? Math.round(c.count * (c.util / 100)) : c.status === "degraded" ? Math.round(c.count * (c.util / 100) * 0.6) : 0;
    allocated += used;
    if (c.billing === "reserved") reserved += used;
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
