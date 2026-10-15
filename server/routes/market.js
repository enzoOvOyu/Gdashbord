import { Router } from "express";
import { GPU, REGIONS, stockIn } from "../data/catalog.js";
import { get } from "../store.js";
import { fleetFromState } from "../data/fleet.js";

export default function marketRouter() {
  const r = Router();

  // 按型号 / 区域 / 关键词筛选与排序
  // 口径统一：可分配量取机队实算的空闲卡数（与总览 / K8s 同源），不再用 catalog 的静态
  // stock，避免「可分配 GPU」在算力市场与总览出现两个互相矛盾的数字。
  r.get("/", (req, res) => {
    const { query = "", gpu = "all", region = "all", sort = "recommended" } = req.query;
    const q = String(query || "").toLowerCase();
    const f = fleetFromState(get());
    const targetRegion = region === "all" ? null : region;
    const freeOf = (gid, rid) => (rid
      ? ((f.byRegionModel || []).find((x) => x.region === rid && x.gpu === gid) || {}).free || 0
      : (f.byRegionModel || []).filter((x) => x.gpu === gid).reduce((a, x) => a + x.free, 0));

    let data = GPU.filter((g) => {
      if (gpu !== "all" && g.id !== gpu) return false;
      if (targetRegion && !(freeOf(g.id, targetRegion) > 0)) return false;
      if (q && !(g.name.toLowerCase().includes(q) || String(g.id).toLowerCase().includes(q))) return false;
      return true;
    }).map((g) => ({
      ...g,
      region: targetRegion,
      available: freeOf(g.id, targetRegion),
      // 该型号仍有空闲库存的区域数（卡片"可选区域"用，避免永远显示全部区域数）
      regionsAvailable: (f.byRegionModel || []).filter((x) => x.gpu === g.id && x.free > 0).length,
    }));

    if (sort === "price") data.sort((a, b) => a.price - b.price);
    if (sort === "vram") data.sort((a, b) => b.vram - a.vram);
    if (sort === "recommended") data.sort((a, b) => b.score - a.score);

    res.json({
      gpus: data,
      total: data.length,
      regions: REGIONS.map((x) => ({ ...x, stock: ((f.byRegion || []).find((r) => r.region === x.id) || {}).free || 0 })),
    });
  });

  // 某型号在某区域的库存
  r.get("/stock", (req, res) => {
    const { gpu, region } = req.query;
    res.json({ gpu, region, available: stockIn(gpu, region) });
  });

  r.get("/:id", (req, res) => {
    const g = GPU.find((x) => x.id === req.params.id);
    if (!g) return res.status(404).json({ error: "gpu not found" });
    res.json(g);
  });

  return r;
}
