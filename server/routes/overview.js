import { Router } from "express";
import { get } from "../store.js";

export default function overviewRouter() {
  const r = Router();
  // 对齐原型 overview()：工作负载、服务、任务与成本汇总
  r.get("/", (req, res) => {
    const s = get();
    const monthCost = s.bills.reduce((a, b) => a + b.cost, 0);
    res.json({
      metrics: {
        workspaces: s.instances.filter((x) => x.status === "running").length,
        endpoints: s.endpoints.filter((x) => x.status === "healthy").length,
        jobSuccessRate: "96.8%",
        monthCost: Number(monthCost.toFixed(2)),
      },
      instances: s.instances.slice(0, 4),
      endpoints: s.endpoints.slice(0, 2),
      events: s.events,
      bills: s.bills,
      balance: s.balance,
      budget: s.budget,
    });
  });
  return r;
}
