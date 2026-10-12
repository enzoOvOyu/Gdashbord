// 业务逻辑：对齐原型 deploy() 与 instanceAction()
import { gpu } from "../data/catalog.js";
import { pushEvent } from "../store.js";

function uid(prefix) {
  return prefix + "-" + Date.now().toString().slice(-6);
}

export function deploy(s, c) {
  if (!c.name || !String(c.name).trim()) return { error: "请填写资源名称" };
  if (c.mode === "endpoint" && Number(c.minReplicas) > Number(c.maxReplicas)) {
    return { error: "最小副本数不能大于最大副本数" };
  }
  if (c.mode === "workspace") {
    const id = uid("ws");
    s.instances.unshift({
      id,
      name: c.name,
      gpu: c.gpu,
      count: Number(c.count),
      region: c.region,
      image: c.image,
      status: "running",
      kind: "GPU 开发工作空间",
      age: "刚刚创建",
      ip: "203.0.113.99",
      disk: Number(c.disk),
    });
    pushEvent("success", `工作空间 ${c.name} 已创建（GPU ${c.gpu} × ${c.count}）`);
    return { kind: "workspace", id, page: "instances" };
  }
  if (c.mode === "endpoint") {
    const id = uid("ep");
    s.endpoints.unshift({
      id,
      name: c.name,
      model: c.model,
      engine: c.engine,
      gpu: c.gpu,
      status: Number(c.minReplicas) === 0 ? "scaled-zero" : "healthy",
      min: Number(c.minReplicas),
      max: Number(c.maxReplicas),
      qps: 0,
      p95: 0,
      replicas: Number(c.minReplicas),
      requests: 0,
      version: "v1.0.0",
    });
    pushEvent("success", `推理 Endpoint ${c.name} 已部署（${c.engine}）`);
    return { kind: "endpoint", id, page: "endpoints" };
  }
  if (c.mode === "job") {
    const id = uid("job");
    s.jobs.unshift({
      id,
      name: c.name,
      type: c.jobTemplate,
      gpu: c.gpu,
      count: Number(c.count),
      status: "queued",
      progress: 0,
      duration: "—",
      dataset: c.dataset,
      cost: 0,
    });
    pushEvent("info", `训练任务 ${c.name} 已加入队列`);
    return { kind: "job", id, page: "jobs" };
  }
  const id = uid("cl");
  s.clusters.unshift({
    id,
    name: c.name,
    nodes: Number(c.nodes),
    gpu: c.gpu,
    count: Number(c.nodes) * Number(c.count),
    status: "running",
    scheduler: c.scheduler,
    network: gpu(c.gpu).network,
    util: 0,
  });
  pushEvent("info", `训练集群 ${c.name} 已创建（${c.nodes} 节点）`);
  return { kind: "cluster", id, page: "jobs" };
}

export function instanceAction(s, action, id) {
  const x = s.instances.find((i) => i.id === id);
  if (!x) return { error: "instance not found" };
  if (action === "toggle-instance") {
    x.status = x.status === "running" ? "stopped" : "running";
    x.ip = x.status === "stopped" ? "—" : "203.0.113.99";
    pushEvent("info", `${x.name} 已${x.status === "running" ? "启动" : "停止"}`);
    return { ok: true, instance: x };
  }
  if (action === "restart") {
    x.status = "starting";
    pushEvent("info", `${x.name} 重启指令已提交`);
    setTimeout(() => {
      const cur = s.instances.find((i) => i.id === id);
      if (cur) cur.status = "running";
    }, 3000);
    return { ok: true, instance: x };
  }
  if (action === "delete-instance") {
    s.instances = s.instances.filter((i) => i.id !== id);
    pushEvent("warning", `工作空间 ${x.name} 已删除`);
    return { ok: true };
  }
  if (action === "connect") {
    return { ok: true, connect: `ssh -i ~/.ssh/nebula_demo_key ubuntu@${x.ip}` };
  }
  if (action === "jupyter") {
    return { ok: true, url: `https://jupyter.example.invalid/workspace/${id}` };
  }
  if (action === "logs") {
    return {
      ok: true,
      logs: [
        `[INFO] container image pulled: ${x.image}`,
        `[INFO] GPU ${x.gpu} × ${x.count} allocated`,
        `[INFO] volume /workspace mounted (${x.disk} GB)`,
        `[INFO] JupyterLab started on :8888`,
        `[INFO] workspace ${x.name} is ready`,
      ].join("\n"),
    };
  }
  return { error: "unknown action" };
}

// 对齐原型 series()：模拟监控时序
export function series(seed = 1, base = 50, amp = 20, n = 35) {
  return Array.from({ length: n }, (_, i) =>
    Math.max(0, base + Math.sin(i * 0.55 + seed) * amp * 0.55 + Math.cos(i * 0.23 + seed) * amp * 0.45 + Math.sin(i * 2.1 + seed) * amp * 0.15)
  );
}
