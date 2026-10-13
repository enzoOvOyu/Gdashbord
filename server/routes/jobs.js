import { Router } from "express";
import { get, save, pushEvent } from "../store.js";

const EV = (zh, en) => ({ zh, en });

export default function jobsRouter() {
  const r = Router();
  r.get("/", (req, res) => {
    const s = get();
    res.json({
      jobs: s.jobs,
      clusters: s.clusters,
      running: s.jobs.filter((x) => x.status === "running").length,
      queued: s.jobs.filter((x) => x.status === "queued").length,
    });
  });

  r.post("/:id/retry", (req, res) => {
    const s = get();
    const j = s.jobs.find((x) => x.id === req.params.id);
    if (!j) return res.status(404).json({ error: "job not found" });
    const copy = { ...j, id: "job-" + Date.now().toString().slice(-6), name: j.name + "-retry", status: "queued", progress: 0, duration: { zh: "—", en: "—" }, cost: 0 };
    s.jobs.unshift(copy);
    pushEvent("info", EV(`已创建重试任务 ${copy.name}`, `Retry job ${copy.name} created`));
    save();
    res.json({ ok: true, job: copy });
  });

  r.post("/:id/logs", (req, res) => {
    const s = get();
    const j = s.jobs.find((x) => x.id === req.params.id);
    if (!j) return res.status(404).json({ error: "job not found" });
    res.json({
      ok: true,
      logs: [
        "[INFO] scheduler: job allocated to GPU pool",
        "[INFO] image: pytorch:2.6-cuda12.4",
        `[INFO] dataset: ${j.dataset} mounted`,
        "[INFO] torch.distributed initialized",
        "[INFO] epoch=1 train_loss=0.00142",
        "[INFO] epoch=2 train_loss=0.00091",
        "[INFO] checkpoint uploaded to persistent storage",
      ].join("\n"),
    });
  });
  return r;
}
