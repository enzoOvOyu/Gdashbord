import { Router } from "express";
import { get } from "../store.js";
import { costSummary } from "../services/cost.js";
import { fleetFromState } from "../data/fleet.js";

export default function overviewRouter() {
  const r = Router();
  // 总览：指标全部由领域状态实算，保证与部署 / 推理 / 训练 / 资产模块口径一致
  r.get("/", (req, res) => {
    const s = get();
    const cost = costSummary(s);
    const f = fleetFromState(s);

    const runningGpus = f.allocated;
    const endpointGpus = (s.endpoints || []).reduce((a, x) => a + Number(x.replicas || 0) * Number(x.gpusPerReplica || 1), 0);
    const done = (s.jobs || []).filter((x) => x.status === "completed").length;
    const failed = (s.jobs || []).filter((x) => x.status === "failed").length;
    const rate = (done + failed) ? Math.round((done / (done + failed)) * 1000) / 10 : 96.8;

    const tenants = s.admin?.tenants || [];
    const users = s.admin?.users || [];
    const mrr = tenants.reduce((a, t) => a + Number(t.spend || 0), 0);
    const activeTenants = tenants.filter((t) => t.status === "active").length;
    const runningJobs = (s.jobs || []).filter((x) => x.status === "running").length;
    const queuedJobs = (s.jobs || []).filter((x) => x.status === "queued").length;

    res.json({
      metrics: {
        workspaces: (s.instances || []).filter((x) => x.status === "running").length,
        endpoints: (s.endpoints || []).filter((x) => x.status === "healthy").length,
        endpointsTotal: (s.endpoints || []).length,
        jobsRunning: runningJobs,
        jobsQueued: queuedJobs,
        jobSuccessRate: rate + "%",
        monthCost: cost.monthly,
        hourlyCost: cost.hourly,
        runningGpus,
        fleetTotal: f.total,
        fleetOnline: f.online,
        fleetFree: f.free,
        gpuUtilization: f.utilization,
        clusters: f.clusters,
        regions: f.byRegion.length,
        tenants: activeTenants,
        users: users.length,
        mrr,
      },
      fleet: f,
      instances: (s.instances || []).slice(0, 5),
      endpoints: (s.endpoints || []).slice(0, 3),
      events: s.events,
      bills: cost.bills,
      balance: s.balance,
      budget: s.budget,
      currency: cost.currency,
    });
  });
  return r;
}
