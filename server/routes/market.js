import { Router } from "express";
import { GPU } from "../data/catalog.js";

export default function marketRouter() {
  const r = Router();
  // 对齐原型 market()：按型号/地域/关键词筛选与排序
  r.get("/", (req, res) => {
    const { query = "", gpu = "all", region = "all", sort = "recommended" } = req.query;
    let data = GPU.filter(
      (g) =>
        (gpu === "all" || g.id === gpu) &&
        (region === "all" || g.region === region) &&
        (!query || g.name.toLowerCase().includes(String(query).toLowerCase()) || g.tag.includes(query))
    );
    if (sort === "price") data.sort((a, b) => a.price - b.price);
    if (sort === "vram") data.sort((a, b) => b.vram - a.vram);
    res.json({ gpus: data, total: data.length });
  });
  r.get("/:id", (req, res) => {
    const g = GPU.find((x) => x.id === req.params.id);
    if (!g) return res.status(404).json({ error: "gpu not found" });
    res.json(g);
  });
  return r;
}
