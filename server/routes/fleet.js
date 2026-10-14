import { Router } from "express";
import { get } from "../store.js";
import { fleetFromState } from "../data/fleet.js";
import { REGIONS, GPU } from "../data/catalog.js";

export default function fleetRouter() {
  const r = Router();

  // 万卡机队全局视图：总量 / 在线 / 利用率 / 区域 / 型号 / 可用区 / 健康 / 集群清单
  r.get("/", (req, res) => {
    const s = get();
    const f = fleetFromState(s);
    const clusters = (s.clusters || []).slice(0, 60).map((c) => ({
      id: c.id, name: c.name, region: c.region, zone: c.zone, gpu: c.gpu,
      nodes: c.nodes, count: c.count, status: c.status, util: c.util,
      scheduler: c.scheduler, network: c.network, tenant: c.tenantName,
      billing: c.billing, price: c.price, powerKw: c.powerKw,
    }));
    res.json({
      total: f.total,
      online: f.online,
      allocated: f.allocated,
      free: f.free,
      reserved: f.reserved,
      reservedPct: f.reservedPct,
      utilization: f.utilization,
      clusters: f.clusters,
      byRegion: f.byRegion,
      byModel: f.byModel,
      byZone: f.byZone,
      health: f.health,
      regions: REGIONS,
      gpus: GPU.map((g) => ({ id: g.id, name: g.name, vram: g.vram, price: g.price, spot: g.spot, reserved: g.reserved })),
      topClusters: clusters,
    });
  });

  // 部署中心可用容量（区域 → 可用区 → 型号 两级联动）
  r.get("/capacity", (req, res) => {
    const s = get();
    const f = fleetFromState(s);
    const zones = REGIONS.flatMap((r) => r.zones.map((z) => z.id));
    const byZoneR = {};
    f.byZone.forEach((z) => { byZoneR[z.zone] = z; });
    // 逐可用区逐型号可分配量
    const cap = REGIONS.map((r) => ({
      region: r.id,
      name: r.name,
      tier: r.tier,
      fabric: r.fabric,
      power: r.power,
      compliance: r.compliance,
      zones: r.zones.map((z) => {
        const zr = byZoneR[z.id] || { total: 0, allocated: 0, free: 0 };
        return {
          zone: z.id,
          az: z.az,
          power: z.power,
          cooling: z.cooling,
          total: zr.total,
          allocated: zr.allocated,
          free: zr.free,
          models: GPU.map((g) => ({
            id: g.id,
            price: g.price,
            spot: g.spot,
            reserved: g.reserved,
            free: freeForZoneModel(s, z.id, g.id),
          })),
        };
      }),
    }));
    res.json({ regions: cap, total: f.total, free: f.free, allocated: f.allocated, utilization: f.utilization });
  });

  return r;
}

// 某可用区某型号当前可分配数量
function freeForZoneModel(s, zone, gpuId) {
  const cs = (s.clusters || []).filter((c) => c.zone === zone && c.gpu === gpuId);
  return cs.reduce((a, c) => a + (c.status === "running" ? Math.max(0, c.count - Math.round(c.count * (c.util / 100))) : c.count), 0);
}
