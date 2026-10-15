import { Router } from "express";
import { get, save } from "../store.js";
import { costSummary, budgetInsight } from "../services/cost.js";
import { fleetFromState } from "../data/fleet.js";

export default function overviewRouter() {
  const r = Router();
  // 总览：指标全部由领域状态实算，保证与部署 / 推理 / 训练 / 资产模块口径一致
  r.get("/", (req, res) => {
    const s = get();
    const cost = costSummary(s);
    const f = fleetFromState(s);
    const insight = budgetInsight(s); // 与费用中心同源：预算使用率 / 环比 / 账单历史
    save();

    const runningGpus = f.allocated;
    const endpointGpus = (s.endpoints || []).reduce((a, x) => a + Number(x.replicas || 0) * Number(x.gpusPerReplica || 1), 0);
    const done = (s.jobs || []).filter((x) => x.status === "completed").length;
    const failed = (s.jobs || []).filter((x) => x.status === "failed").length;
    const terminal = done + failed;
    // 口径修正：终态样本过少时百分比没有统计意义（2 个样本里 0 个成功 ≠ 成功率 0%），
    // 这里低于 3 个样本直接返回 null，由前端展示「暂无终态样本」。
    const rate = terminal >= 3 ? Math.round((done / terminal) * 1000) / 10 : null;

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
        jobSuccessRate: rate === null ? "—" : rate + "%",
        jobSuccessSample: terminal,
        budgetUsedPct: insight.usedPct,
        budgetOver: insight.overBudget,
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
      insight,
    });
  });
  return r;
}
