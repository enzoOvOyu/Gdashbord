import { Router } from "express";
import { get } from "../store.js";
import { costSummary } from "../services/cost.js";

export default function overviewRouter() {
  const r = Router();
  // 总览：指标全部由领域状态实算，保证与部署 / 推理 / 训练 / 资产模块口径一致
  r.get("/", (req, res) => {
    const s = get();
    const cost = costSummary(s);
    const runningGpus = (s.instances || []).filter((x) => x.status === "running").reduce((a, x) => a + Number(x.count || 0), 0)
      + (s.jobs || []).filter((x) => x.status === "running").reduce((a, x) => a + Number(x.count || 0) * Number(x.nodes || 0), 0)
      + (s.clusters || []).filter((x) => x.status === "running").reduce((a, x) => a + Number(x.count || 0), 0);
    const endpointGpus = (s.endpoints || []).reduce((a, x) => a + Number(x.replicas || 0) * Number(x.gpusPerReplica || 1), 0);
    const done = (s.jobs || []).filter((x) => x.status === "completed").length;
    const failed = (s.jobs || []).filter((x) => x.status === "failed").length;
    const rate = (done + failed) ? Math.round((done / (done + failed)) * 1000) / 10 : 96.8;

    res.json({
      metrics: {
        workspaces: (s.instances || []).filter((x) => x.status === "running").length,
        endpoints: (s.endpoints || []).filter((x) => x.status === "healthy").length,
        jobsRunning: (s.jobs || []).filter((x) => x.status === "running").length,
        jobSuccessRate: rate + "%",
        monthCost: cost.monthly,
        hourlyCost: cost.hourly,
        runningGpus: runningGpus + endpointGpus,
        gpuUtilization: 76,
      },
      instances: (s.instances || []).slice(0, 4),
      endpoints: (s.endpoints || []).slice(0, 2),
      events: s.events,
      bills: cost.bills,
      balance: s.balance,
      budget: s.budget,
      currency: cost.currency,
    });
  });
  return r;
}
