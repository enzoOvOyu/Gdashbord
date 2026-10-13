// Kubernetes GPU 资源 REST 路由
import { Router } from "express";
import { get } from "../store.js";
import { k8sSummary, nodeAction, dispatch, podAction, quotaSet, topology, k8sMetrics } from "../services/k8s.js";

export default function k8sRouter() {
  const r = Router();

  // 集群总览
  r.get("/summary", (req, res) => res.json(k8sSummary(get())));

  // GPU 节点列表（支持节点池 / 状态筛选）
  r.get("/nodes", (req, res) => {
    const { pool, status } = req.query;
    let nodes = get().k8s.nodes;
    if (pool && pool !== "all") nodes = nodes.filter((n) => n.pool === pool);
    if (status && status !== "all") nodes = nodes.filter((n) => n.status === status);
    res.json({ nodes, pools: get().k8s.pools });
  });

  // 节点详情（含其上运行的 Pod）
  r.get("/nodes/:id", (req, res) => {
    const k = get().k8s;
    const n = k.nodes.find((x) => x.id === req.params.id);
    if (!n) return res.status(404).json({ error: "节点不存在" });
    res.json({ node: n, pods: k.pods.filter((p) => p.node === n.id) });
  });

  // 节点运维动作
  r.post("/nodes/:id/action", (req, res) => {
    const out = nodeAction(get(), req.params.id, String((req.body || {}).action || ""));
    if (!out.ok) return res.status(400).json(out);
    res.json(Object.assign({ ok: true }, out));
  });

  // 命名空间配额
  r.get("/quotas", (req, res) => res.json({ quotas: get().k8s.quotas }));
  r.post("/quotas", (req, res) => {
    const b = req.body || {};
    const out = quotaSet(get(), b.ns, b.field, b.value);
    if (!out.ok) return res.status(400).json(out);
    res.json(out);
  });

  // 工作负载
  r.get("/workloads", (req, res) => {
    const { ns, phase } = req.query;
    let pods = get().k8s.pods;
    if (ns && ns !== "all") pods = pods.filter((p) => p.ns === ns);
    if (phase && phase !== "all") pods = pods.filter((p) => p.phase === phase);
    res.json({ pods, namespaces: get().k8s.quotas.map((q) => q.ns) });
  });
  r.post("/workloads/:id/action", (req, res) => {
    const out = podAction(get(), req.params.id, String((req.body || {}).action || ""));
    if (!out.ok) return res.status(400).json(out);
    res.json(Object.assign({ ok: true }, out));
  });

  // 调度队列：手动触发调度
  r.get("/scheduler", (req, res) => {
    const k = get().k8s;
    res.json({
      pending: k.pods.filter((p) => p.phase === "pending"),
      scheduled: k.scheduled,
      preempted: k.preempted,
      summary: k8sSummary(get()),
    });
  });
  r.post("/scheduler/dispatch", (req, res) => res.json(Object.assign({ ok: true }, dispatch(get()))));

  // 机架拓扑
  r.get("/topology", (req, res) => res.json({ cabinets: topology(get()) }));

  // 集群指标
  r.get("/metrics", (req, res) => {
    const tab = req.query.tab || "gpu";
    const range = req.query.range || "1h";
    res.json(Object.assign({ tab, range }, k8sMetrics(tab, range)));
  });

  // 集群事件
  r.get("/events", (req, res) => res.json({ events: get().k8s.events }));

  return r;
}
