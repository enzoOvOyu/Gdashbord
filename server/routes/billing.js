import { Router } from "express";
import { get, save, pushEvent } from "../store.js";
import { costSummary, HOURS_PER_MONTH, CURRENCY } from "../services/cost.js";

export default function billingRouter() {
  const r = Router();

  // 费用结构由各模块真实状态实算，保证与部署 / 推理 / 训练 / 资产一致
  r.get("/", (req, res) => {
    const s = get();
    const cost = costSummary(s);
    res.json({
      balance: s.balance,
      budget: s.budget,
      currency: CURRENCY,
      hoursPerMonth: HOURS_PER_MONTH,
      monthCost: cost.monthly,
      hourlyCost: cost.hourly,
      gpuCount: cost.gpuCount,
      gpuHours: cost.gpuHours,
      bills: cost.bills,
      details: cost.lines,
    });
  });

  r.post("/budget", (req, res) => {
    const s = get();
    const value = Number((req.body || {}).budget);
    if (!Number.isFinite(value) || value < 100) return res.status(400).json({ error: "预算必须大于 100" });
    s.budget = value;
    save();
    pushEvent("info", { zh: `月度预算已更新为 $${value}`, en: `Monthly budget set to $${value}` });
    res.json({ ok: true, budget: value });
  });

  r.post("/recharge", (req, res) => {
    const s = get();
    const amount = Number((req.body || {}).amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "金额必须大于 0" });
    s.balance = Number((s.balance + amount).toFixed(2));
    save();
    pushEvent("success", { zh: `演示账户已充值 $${amount}`, en: `Demo account recharged by $${amount}` });
    res.json({ ok: true, balance: s.balance });
  });

  r.get("/export", (req, res) => {
    const s = get();
    const cost = costSummary(s);
    const q = String.fromCharCode(34);
    const rows = [
      ["Category", "Detail", "Monthly (USD)", "Pct"],
      ...cost.bills.map((b) => [b.name.en, b.sub.en, b.cost, b.pct + "%"]),
      [],
      ["Workload", "GPU", "Region", "Hourly (USD)", "Monthly (USD)"],
      ...cost.lines.map((l) => [l.name, l.gpu + " x " + l.count, l.region, l.hourly, l.monthly]),
    ];
    const csv = "﻿" + rows.map((r2) => r2.map((c) => q + String(c).replace(/"/g, q + q) + q).join(",")).join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=runsun_billing_usd.csv");
    res.send(csv);
  });

  return r;
}
