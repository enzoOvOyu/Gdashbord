// 业务逻辑：deploy() / instanceAction() —— 区域限定 JP/TH/US，GPU 限定 5 种型号，金额 USD
import { gpu, region, CLUSTER_SKUS, modelById } from "../data/catalog.js";
import { pushEvent } from "../store.js";

function uid(prefix) {
  return prefix + "-" + Date.now().toString().slice(-6);
}

export function deploy(s, c) {
  if (!c.name || !String(c.name).trim()) return { error: "请填写资源名称" };
  if (c.mode === "endpoint" && Number(c.minReplicas) > Number(c.maxReplicas)) {
    return { error: "最小副本数不能大于最大副本数" };
  }
  const g = gpu(c.gpu);
  const reg = region(c.region);

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
      kind: { zh: "开发工作空间", en: "Workspace" },
      age: "刚刚创建",
      ip: "203.0.113.99",
      disk: Number(c.disk),
      ssh: true,
      jupyter: true,
    });
    pushEvent("success", { zh: `工作空间 ${c.name} 已创建（${c.gpu} × ${c.count} · ${reg.name.zh}）`, en: `Workspace ${c.name} created (${c.gpu} × ${c.count} · ${reg.name.en})` });
    return { kind: "workspace", id, page: "instances" };
  }

  if (c.mode === "endpoint") {
    const id = uid("ep");
    const model = modelById(c.modelId || c.model);
    s.endpoints.unshift({
      id,
      name: c.name,
      modelId: c.modelId || (model ? model.id : ""),
      model: model ? model.name : c.model,
      engine: c.engine,
      gpu: c.gpu,
      gpusPerReplica: Number(c.count) || 1,
      region: c.region,
      status: Number(c.minReplicas) === 0 ? "scaled-zero" : "healthy",
      min: Number(c.minReplicas),
      max: Number(c.maxReplicas),
      qps: 0,
      p95: 0,
      replicas: Number(c.minReplicas),
      requests: 0,
      version: "v1.0.0",
    });
    pushEvent("success", { zh: `推理 Endpoint ${c.name} 已部署（${c.engine} · ${c.gpu}）`, en: `Endpoint ${c.name} deployed (${c.engine} · ${c.gpu})` });
    return { kind: "endpoint", id, page: "endpoints" };
  }

  if (c.mode === "job") {
    const id = uid("job");
    s.jobs.unshift({
      id,
      name: c.name,
      type: { zh: c.jobTemplate || "训练任务", en: c.jobTemplate || "Training job" },
      gpu: c.gpu,
      count: Number(c.count),
      nodes: Number(c.nodes) || 1,
      region: c.region,
      status: "queued",
      progress: 0,
      duration: "—",
      dataset: c.dataset,
      goodput: 0,
      cost: 0,
      priority: c.spot ? "Low" : "Normal",
      template: c.jobTemplate,
      image: c.image,
      epoch: Number(c.epochs) || 1,
    });
    pushEvent("info", { zh: `训练任务 ${c.name} 已加入队列（${c.gpu} × ${c.count}）`, en: `Training job ${c.name} queued (${c.gpu} × ${c.count})` });
    return { kind: "job", id, page: "jobs" };
  }

  // cluster
  const id = uid("cl");
  const nodes = Number(c.nodes) || 1;
  const total = nodes * Number(c.count);
  const sku = CLUSTER_SKUS.find((x) => x.gpu === c.gpu && x.nodes === nodes && x.gpusPerNode === Number(c.count));
  s.clusters.unshift({
    id,
    name: c.name,
    sku: sku ? sku.id : "",
    nodes,
    gpu: c.gpu,
    count: total,
    region: c.region,
    status: "provisioning",
    scheduler: c.scheduler,
    network: g.network,
    util: 0,
    price: sku ? sku.price : Number((g.price * total).toFixed(2)),
    cpuPerNode: Math.round(g.cpu * Number(c.count)),
    ramPerNode: Math.round(g.ram * Number(c.count) / 8),
    storagePerNode: g.storage,
    jobs: 0,
  });
  pushEvent("info", { zh: `训练集群 ${c.name} 已创建（${nodes} 节点 / ${total} 卡）`, en: `Cluster ${c.name} created (${nodes} nodes / ${total} GPUs)` });
  return { kind: "cluster", id, page: "jobs" };
}

export function instanceAction(s, action, id) {
  const x = s.instances.find((i) => i.id === id);
  if (!x) return { error: "instance not found" };
  if (action === "toggle-instance") {
    x.status = x.status === "running" ? "stopped" : "running";
    x.ip = x.status === "stopped" ? "—" : "203.0.113.99";
    pushEvent("info", { zh: `${x.name} 已${x.status === "running" ? "启动" : "停止"}`, en: `${x.name} ${x.status === "running" ? "started" : "stopped"}` });
    return { ok: true, instance: x };
  }
  if (action === "restart") {
    x.status = "starting";
    pushEvent("info", { zh: `${x.name} 重启指令已提交`, en: `${x.name} restart submitted` });
    setTimeout(() => {
      const cur = s.instances.find((i) => i.id === id);
      if (cur) cur.status = "running";
    }, 3000);
    return { ok: true, instance: x };
  }
  if (action === "delete-instance") {
    s.instances = s.instances.filter((i) => i.id !== id);
    pushEvent("warning", { zh: `工作空间 ${x.name} 已删除`, en: `Workspace ${x.name} deleted` });
    return { ok: true };
  }
  if (action === "connect") {
    return { ok: true, connect: `ssh -i ~/.ssh/demo_key ubuntu@${x.ip}` };
  }
  if (action === "jupyter") {
    return { ok: true, url: `https://jupyter.example.invalid/workspace/${id}` };
  }
  if (action === "logs") {
    return {
      ok: true,
      logs: [
        `[INFO] region=${x.region} image=${x.image}`,
        `[INFO] GPU ${x.gpu} × ${x.count} allocated`,
        `[INFO] volume /workspace mounted (${x.disk} GB)`,
        `[INFO] JupyterLab started on :8888`,
        `[INFO] workspace ${x.name} is ready`,
      ].join("\n"),
    };
  }
  return { error: "unknown action" };
}

// 模拟监控时序
export function series(seed = 1, base = 50, amp = 20, n = 35) {
  return Array.from({ length: n }, (_, i) =>
    Math.max(0, base + Math.sin(i * 0.55 + seed) * amp * 0.55 + Math.cos(i * 0.23 + seed) * amp * 0.45 + Math.sin(i * 2.1 + seed) * amp * 0.15)
  );
}
