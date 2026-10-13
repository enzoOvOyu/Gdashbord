import { Router } from "express";
import { get, save, pushEvent } from "../store.js";

const EV = (zh, en) => ({ zh, en });

export default function assetsRouter() {
  const r = Router();
  r.get("/", (req, res) => res.json({ assets: get().assets }));

  r.post("/", (req, res) => {
    const s = get();
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const tab = body.tab || "models";
    if (!name) return res.status(400).json({ error: "请输入资产名称 / Asset name required" });
    if (!s.assets[tab]) return res.status(400).json({ error: "未知资产类型 / Unknown asset type" });
    const item = {
      name,
      type: EV("用户登记", "User registered"),
      size: "—",
      version: "v1.0",
      source: EV("手动创建", "Manual"),
      date: EV("刚刚", "just now"),
    };
    s.assets[tab].unshift(item);
    pushEvent("info", EV(`资产 ${name} 已登记`, `Asset ${name} registered`));
    save();
    res.json({ ok: true, item, tab });
  });
  return r;
}
