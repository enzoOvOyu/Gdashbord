import { Router } from "express";
import { get, save } from "../store.js";
import { deploy, instanceAction } from "../services/workload.js";

export default function workloadsRouter() {
  const r = Router();
  r.get("/", (req, res) => {
    const s = get();
    res.json({
      instances: s.instances,
      gpuAssigned: s.instances.filter((x) => x.status === "running").reduce((a, x) => a + x.count, 0),
    });
  });

  // 对齐原型 deploy()
  r.post("/deploy", (req, res) => {
    const s = get();
    const result = deploy(s, req.body || {});
    if (result.error) return res.status(400).json(result);
    save();
    res.json(result);
  });

  // 对齐原型 instanceAction()
  r.post("/:id/action", (req, res) => {
    const s = get();
    const result = instanceAction(s, req.body.action, req.params.id);
    if (result.error) return res.status(400).json(result);
    save();
    res.json(result);
  });
  return r;
}
