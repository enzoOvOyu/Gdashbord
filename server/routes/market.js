import { Router } from "express";
import { GPU, REGIONS, stockIn } from "../data/catalog.js";

export default function marketRouter() {
  const r = Router();

  // 按型号 / 区域 / 关键词筛选与排序；区域库存来自 GPU.stock
  r.get("/", (req, res) => {
    const { query = "", gpu = "all", region = "all", sort = "recommended" } = req.query;
    const q = String(query || "").toLowerCase();
    let data = GPU.filter((g) => {
      if (gpu !== "all" && g.id !== gpu) return false;
      if (region !== "all" && !(g.stock[region] > 0)) return false;
      if (q && !(g.name.toLowerCase().includes(q) || String(g.id).toLowerCase().includes(q))) return false;
      return true;
    }).map((g) => ({
      ...g,
      region: region === "all" ? null : region,
      available: region === "all"
        ? Object.values(g.stock).reduce((a, b) => a + b, 0)
        : g.stock[region] || 0,
    }));

    if (sort === "price") data.sort((a, b) => a.price - b.price);
    if (sort === "vram") data.sort((a, b) => b.vram - a.vram);
    if (sort === "recommended") data.sort((a, b) => b.score - a.score);

    res.json({
      gpus: data,
      total: data.length,
      regions: REGIONS.map((x) => ({ ...x, stock: GPU.reduce((a, g) => a + (g.stock[x.id] || 0), 0) })),
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
