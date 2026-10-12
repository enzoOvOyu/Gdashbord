import { Router } from "express";
import { get, save, pushEvent } from "../store.js";
import { gpu } from "../data/catalog.js";

export default function billingRouter() {
  const r = Router();
  r.get("/", (req, res) => {
    const s = get();
    const monthCost = s.bills.reduce((a, b) => a + b.cost, 0);
    const rows = [
      ...s.instances.map((x) => ({ name: x.name, type: "GPU 工作空间", gpu: x.gpu + " × " + x.count, h: 24, price: gpu(x.gpu).price * x.count })),
      ...s.endpoints.map((x) => ({ name: x.name, type: "推理服务", gpu: x.gpu, h: 12, price: gpu(x.gpu).price * x.replicas })),
      ...s.jobs.map((x) => ({ name: x.name, type: "训练任务", gpu: x.gpu + " × " + x.count, h: 3, price: gpu(x.gpu).price * x.count })),
    ].map((x) => ({ ...x, amount: Number((x.price * x.h).toFixed(2)) }));
    res.json({ balance: s.balance, budget: s.budget, monthCost: Number(monthCost.toFixed(2)), bills: s.bills, details: rows });
  });

  r.post("/budget", (req, res) => {
    const s = get();
    const value = Number((req.body || {}).budget);
    if (!Number.isFinite(value) || value < 100) return res.status(400).json({ error: "预算必须大于 100" });
    s.budget = value;
    save();
    pushEvent("info", `月度预算已更新为 ¥${value}`);
    res.json({ ok: true, budget: value });
  });

  r.post("/recharge", (req, res) => {
    const s = get();
    const amount = Number((req.body || {}).amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "金额必须大于 0" });
    s.balance += amount;
    save();
    pushEvent("success", `演示账户已充值 ¥${amount}`);
    res.json({ ok: true, balance: s.balance });
  });

  r.get("/export", (req, res) => {
    const s = get();
    const q = String.fromCharCode(34);
    const rows = [["费用类别", "说明", "金额(元)"], ...s.bills.map((x) => [x.name, x.sub, x.cost])];
    const csv = "﻿" + rows.map((r2) => r2.map((c) => q + String(c).replace(/"/g, q + q) + q).join(",")).join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=nebula_gpu_cloud_billing.csv");
    res.send(csv);
  });
  return r;
}
