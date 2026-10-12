import { Router } from "express";
import { get, save, pushEvent } from "../store.js";

export default function assetsRouter() {
  const r = Router();
  r.get("/", (req, res) => res.json({ assets: get().assets }));

  r.post("/", (req, res) => {
    const s = get();
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const tab = body.tab || "models";
    if (!name) return res.status(400).json({ error: "请输入资产名称" });
    if (!s.assets[tab]) return res.status(400).json({ error: "未知资产类型" });
    const item = { name, type: "用户登记", size: "—", version: "v1.0", source: "手动创建", date: "刚刚" };
    s.assets[tab].unshift(item);
    pushEvent("info", `资产 ${name} 已登记`);
    save();
    res.json({ ok: true, item, tab });
  });
  return r;
}
