import { Router } from "express";
import { get, pushEvent } from "../store.js";
import { series } from "../services/workload.js";

export default function monitorRouter() {
  const r = Router();
  r.get("/events", (req, res) => res.json({ events: get().events }));

  r.get("/metrics", (req, res) => {
    const tab = req.query.tab || "gpu";
    const range = req.query.range || "1h";
    const n = range === "7d" ? 60 : range === "24h" ? 45 : 35;
    const primary = tab === "inference" ? series(5, 62, 30, n) : tab === "jobs" ? series(2, 80, 18, n) : series(3, 72, 24, n);
    const secondary = tab === "inference" ? series(9, 32, 18, n) : tab === "jobs" ? series(7, 45, 20, n) : series(6, 55, 16, n);
    const values = tab === "inference"
      ? ["42.6 QPS", "189 ms", "0.12%", "3 副本"]
      : tab === "jobs"
      ? ["68%", "1.2e-4", "8 GPU", "2h 14m"]
      : ["76%", "61.2 GB", "42%", "1.8 GB/s"];
    res.json({ tab, range, values, primary, secondary });
  });

  r.post("/alerts", (req, res) => {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ error: "请输入规则名称" });
    const ev = pushEvent("info", `已创建告警规则：${name}（${body.metric || "GPU 利用率"} > ${body.value || 90}）`);
    res.json({ ok: true, event: ev });
  });
  return r;
}
