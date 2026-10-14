import { Router } from "express";
import { get, pushEvent } from "../store.js";
import { series } from "../services/workload.js";
import { fleetFromState } from "../data/fleet.js";

const EV = (zh, en) => ({ zh, en });

export default function monitorRouter() {
  const r = Router();
  r.get("/events", (req, res) => res.json({ events: get().events }));

  r.get("/metrics", (req, res) => {
    const s = get();
    const tab = req.query.tab || "gpu";
    const range = req.query.range || "1h";
    const n = range === "7d" ? 60 : range === "24h" ? 45 : 35;
    const primary = tab === "inference" ? series(5, 62, 30, n) : tab === "jobs" ? series(2, 80, 18, n) : series(3, 72, 24, n);
    const secondary = tab === "inference" ? series(9, 32, 18, n) : tab === "jobs" ? series(7, 45, 20, n) : series(6, 55, 16, n);
    const f = fleetFromState(s);
    const clusters = s.clusters || [];
    const runningClusters = clusters.filter((c) => c.status === "running");
    const avgTemp = runningClusters.length ? Math.round(runningClusters.reduce((a, c) => a + (c.tempC || 0), 0) / runningClusters.length) : 0;
    const totalPower = clusters.reduce((a, c) => a + (c.status === "running" ? Number(c.powerKw || 0) : 0), 0);
    const totalCarbon = clusters.reduce((a, c) => a + (c.status === "running" ? Number(c.carbon || 0) : 0), 0);
    const degraded = clusters.filter((c) => c.status === "degraded").length;
    const maintenance = clusters.filter((c) => c.status === "maintenance").length;
    const values = tab === "inference"
      ? [EV("42.6 QPS", "42.6 QPS"), EV("189 ms P95", "189 ms P95"), EV("0.12% 错误率", "0.12% error"), EV("3 副本", "3 replicas")]
      : tab === "jobs"
      ? [EV("68% 进度", "68% progress"), EV("1.2e-4 损失", "1.2e-4 loss"), EV("8 GPU", "8 GPUs"), EV("2h 14m", "2h 14m")]
      : [EV(f.utilization + "% 利用率", f.utilization + "% util"), EV(avgTemp + "°C 机队均温", avgTemp + "°C fleet temp"), EV(Math.round(totalPower) + " kW 功耗", Math.round(totalPower) + " kW power"), EV(f.clusters + " 集群", f.clusters + " clusters")];
    res.json({
      tab, range, values, primary, secondary,
      fleet: {
        total: f.total,
        online: f.online,
        allocated: f.allocated,
        free: f.free,
        utilization: f.utilization,
        clusters: f.clusters,
        avgTemp,
        totalPower,
        totalCarbon,
        degraded,
        maintenance,
        byRegion: f.byRegion,
        health: f.health,
      },
    });
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
