import { Router } from "express";
import { get, pushEvent } from "../store.js";
import { series } from "../services/workload.js";

const EV = (zh, en) => ({ zh, en });

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
      ? [EV("42.6 QPS", "42.6 QPS"), EV("189 ms P95", "189 ms P95"), EV("0.12% 错误率", "0.12% error"), EV("3 副本", "3 replicas")]
      : tab === "jobs"
      ? [EV("68% 进度", "68% progress"), EV("1.2e-4 损失", "1.2e-4 loss"), EV("8 GPU", "8 GPUs"), EV("2h 14m", "2h 14m")]
      : [EV("76% 利用率", "76% util"), EV("61.2 GB 显存", "61.2 GB VRAM"), EV("42% 内存", "42% memory"), EV("1.8 GB/s 网络", "1.8 GB/s net")];
    res.json({ tab, range, values, primary, secondary });
  });

  r.post("/alerts", (req, res) => {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ error: "请输入规则名称 / Rule name required" });
    const ev = pushEvent("info", EV(
      `已创建告警规则：${name}（${body.metric || "GPU 利用率"} > ${body.value || 90}）`,
      `Alert rule created: ${name} (${body.metric || "GPU utilization"} > ${body.value || 90})`
    ));
    res.json({ ok: true, event: ev });
  });
  return r;
}
