// Kubernetes GPU 资源业务逻辑：节点运维、调度模拟、配额、机架拓扑、指标序列
// 对齐 CoreWeave Mission Control 的运维动作语义：cordon / drain / remediate / straggler 检测
// 事件流与指标文案均为 { zh, en } 双语结构
import { pushEvent } from "../store.js";
import { series } from "./workload.js";

const P = (n) => Number(n) || 0;
const EV = (zh, en) => ({ zh, en });

// 集群总览：以节点池聚合为准（万卡规模），节点级指标基于抽样样本
export function k8sSummary(s) {
  const k = s.k8s;
  const nodes = k.nodes;
  // 池聚合总量（反映全量机队），样本节点用于浏览与运维操作
  const poolTotalGpus = k.pools.reduce((a, p) => a + p.gpus * p.nodes, 0);
  const poolTotalNodes = k.pools.reduce((a, p) => a + p.nodes, 0);
  const sampleScale = poolTotalGpus / Math.max(1, nodes.reduce((a, n) => a + n.gpus, 0));
  // 分配量：优先 state 里由机队实算写入的 cluster.allocatedGpus（与机队/配额闭环）；
  // 仅当缺失时回退抽样外推。可调度/健康按比例从池总量推导。
  const baseAllocated = Number(k.cluster.allocatedGpus) > 0
    ? Math.min(poolTotalGpus, Number(k.cluster.allocatedGpus))
    : Math.round(nodes.reduce((a, n) => a + n.allocated, 0) * sampleScale);
  const cls = Object.assign({}, k.cluster, {
    totalNodes: poolTotalNodes,
    readyNodes: Math.round(poolTotalNodes * 0.94),
    totalGpus: poolTotalGpus,
    allocatedGpus: baseAllocated,
    schedulableGpus: Math.max(0, poolTotalGpus - baseAllocated),
    healthyGpus: Math.round(poolTotalGpus * (nodes.length ? nodes.filter((n) => n.health === "Pass").length / nodes.length : 0.97)),
    stragglers: Math.round(nodes.filter((n) => n.straggler).length * sampleScale),
    remediation: Math.round(nodes.filter((n) => n.status === "remediation" || n.status === "notready").length * sampleScale),
  });
  cls.allocPct = Math.round((cls.allocatedGpus / Math.max(1, cls.totalGpus)) * 1000) / 10;
  const pending = k.pods.filter((p) => p.phase === "pending");
  return {
    cluster: cls,
    pendingCount: pending.length,
    pendingGpus: pending.reduce((a, p) => a + p.gpuCount, 0),
    runningPods: k.pods.filter((p) => p.phase === "running").length,
    quotas: k.quotas,
    pools: (() => {
      // 池级 used 直接按集群总分配量 × 池容量占比分摊（与 cluster.allocatedGpus 严格闭环）
      const totalGpus = k.pools.reduce((a, p) => a + p.gpus * p.nodes, 0) || 1;
      return k.pools.map((p) => {
        const ns = nodes.filter((n) => n.pool === p.id);
        const poolTotal = p.gpus * p.nodes;
        const used = Math.round((cls.allocatedGpus * poolTotal) / totalGpus);
        return Object.assign({}, p, {
          actualNodes: p.nodes,
          total: poolTotal,
          used,
          free: poolTotal - used,
          ready: ns.filter((n) => n.status === "ready").length,
          sampleNodes: ns.length,
        });
      });
    })(),
  };
}

// 节点运维动作：cordon / uncordon / drain / remediate / delete
export function nodeAction(s, id, action) {
  const k = s.k8s;
  const n = k.nodes.find((x) => x.id === id);
  if (!n) return { ok: false, error: "节点不存在: " + id };

  if (action === "cordon") {
    n.status = "cordoned";
    n.taints = ["node.kubernetes.io/unschedulable:NoSchedule"];
    pushEvent("warning", EV(`节点 ${id} 已 cordon，停止接收新 Pod`, `Node ${id} cordoned, no new pods`));
  } else if (action === "uncordon") {
    n.status = "ready";
    n.taints = ["nvidia.com/gpu.product=" + n.gpu + ":NoSchedule"];
    pushEvent("success", EV(`节点 ${id} 已 uncordon，恢复调度`, `Node ${id} uncordoned, scheduling resumed`));
  } else if (action === "drain") {
    n.status = "draining";
    const moved = k.pods.filter((p) => p.node === id && p.phase === "running");
    moved.forEach((p) => { p.node = ""; p.phase = "pending"; p.reason = EV(`节点 ${id} drain 触发重调度`, `Rescheduled by drain of ${id}`); });
    n.allocated = 0;
    n.pods = 0;
    pushEvent("info", EV(`节点 ${id} 开始 drain，驱逐 ${moved.length} 个 Pod`, `Draining ${id}, evicting ${moved.length} pods`));
    return { ok: true, node: n, drained: moved.length };
  } else if (action === "remediate") {
    n.status = "remediation";
    n.health = "Fail";
    pushEvent("warning", EV(`Mission Control 已对 ${id} 触发自动节点修复`, `Mission Control triggered remediation on ${id}`));
  } else if (action === "restore") {
    n.status = "ready";
    n.health = "Pass";
    n.straggler = false;
    n.temp = 62;
    pushEvent("success", EV(`节点 ${id} 修复完成，重新加入调度`, `Node ${id} restored and schedulable`));
  } else if (action === "clear-straggler") {
    n.straggler = false;
    n.health = "Pass";
    pushEvent("success", EV(`节点 ${id} 的 straggler 标记已清除`, `Straggler flag cleared on ${id}`));
  } else if (action === "delete") {
    k.nodes = k.nodes.filter((x) => x.id !== id);
    k.pods.forEach((p) => { if (p.node === id) { p.node = ""; p.phase = "pending"; p.reason = EV(`节点 ${id} 已移除`, `Node ${id} removed`); } });
    pushEvent("warning", EV(`节点 ${id} 已从集群移除`, `Node ${id} removed from cluster`));
    return { ok: true, removed: id };
  } else {
    return { ok: false, error: "不支持的动作: " + action };
  }
  return { ok: true, node: n };
}

// 在候选节点中挑选一组满足 Gang 需求的节点：优先同一 NVLink 域，其次同节点池
function pickGang(cands, need) {
  const byDomain = {};
  cands.forEach((n) => (byDomain[n.domain] = byDomain[n.domain] || []).push(n));
  let best = null;
  for (const key of Object.keys(byDomain)) {
    const list = byDomain[key].slice().sort((a, b) => (b.gpus - b.allocated) - (a.gpus - a.allocated));
    let acc = 0;
    const picked = [];
    for (const n of list) {
      if (acc >= need) break;
      picked.push(n);
      acc += n.gpus - n.allocated;
    }
    if (acc >= need && (!best || picked.length < best.length)) best = picked;
  }
  if (!best) {
    const list = cands.slice().sort((a, b) => (b.gpus - b.allocated) - (a.gpus - a.allocated));
    let acc = 0;
    const picked = [];
    for (const n of list) {
      if (acc >= need) break;
      picked.push(n);
      acc += n.gpus - n.allocated;
    }
    if (acc >= need) best = picked;
  }
  return best;
}

// 抢占：Critical 可抢占 High/BestEffort，High 可抢占 BestEffort
function freeByPreemption(k, gpuType, need, requester, cands) {
  const rank = { Critical: 3, High: 2, BestEffort: 1 };
  const mine = rank[requester] || 1;
  const victims = k.pods
    .filter((p) => p.phase === "running" && p.gpu === gpuType && (rank[p.priority] || 1) < mine)
    .sort((a, b) => (rank[a.priority] || 1) - (rank[b.priority] || 1) || a.gpuUtil - b.gpuUtil);
  const freed = [];
  for (const v of victims) {
    const group = pickGang(cands, need);
    if (group) break;
    const n = k.nodes.find((x) => x.id === v.node);
    if (n) { n.allocated = Math.max(0, n.allocated - v.gpuCount); n.pods = Math.max(0, n.pods - 1); }
    v.node = "";
    v.phase = "pending";
    v.reason = EV(`被 ${requester} 优先级任务抢占（Preemption）`, `Preempted by a ${requester} priority job`);
    v.gpuUtil = 0;
    k.preempted += 1;
    freed.push(v.name);
  }
  return freed;
}

// 调度模拟：按拓扑约束与可用 GPU 放置 Pending Pod（对齐 SUNK 拓扑感知调度）
export function dispatch(s) {
  const k = s.k8s;
  const pend = k.pods.filter((p) => p.phase === "pending").sort((a, b) => b.gpuCount - a.gpuCount);
  const placed = [], blocked = [], preempted = [];

  for (const p of pend) {
    const cands = () => k.nodes.filter((n) => n.status === "ready" && n.gpu === p.gpu);
    let group = pickGang(cands().filter((n) => n.gpus - n.allocated > 0), p.gpuCount);
    // 容量不足时按优先级抢占
    if (!group) {
      const freed = freeByPreemption(k, p.gpu, p.gpuCount, p.priority, cands());
      if (freed.length) preempted.push({ name: p.name, victims: freed });
      group = pickGang(cands().filter((n) => n.gpus - n.allocated > 0), p.gpuCount);
    }
    if (!group) {
      const free = cands().reduce((a, n) => a + Math.max(0, n.gpus - n.allocated), 0);
      p.reason = EV(
        `0/${k.nodes.length} 节点可用：nvidia.com/gpu 不足（需 ${p.gpuCount}，${p.gpu} 可调度 ${free}）`,
        `0/${k.nodes.length} nodes available: Insufficient nvidia.com/gpu (need ${p.gpuCount}, ${free} schedulable ${p.gpu})`
      );
      blocked.push({ name: p.name, reason: p.reason });
      continue;
    }
    // 在选中的节点组内按需分配，优先温度低的节点
    group.sort((a, b) => a.temp - b.temp);
    let remain = p.gpuCount;
    for (const n of group) {
      if (remain <= 0) break;
      const take = Math.min(remain, n.gpus - n.allocated);
      if (take <= 0) continue;
      n.allocated += take;
      n.pods += 1;
      n.cpuUsed = Math.min(n.cpu, n.cpuUsed + take * 28);
      n.ramUsed = Math.min(n.ram, n.ramUsed + take * 220);
      remain -= take;
    }
    p.node = group[0].id;
    p.phase = "running";
    p.reason = "";
    p.gpuUtil = 55 + Math.floor(Math.random() * 40);
    p.age = EV("刚刚", "just now");
    p.note = group.length > 1
      ? EV(`Gang 跨 ${group.length} 个节点（同拓扑域）`, `Gang across ${group.length} nodes (same topology domain)`)
      : EV("单节点放置", "Placed on a single node");
    placed.push({ name: p.name, node: p.node, gpus: p.gpuCount, nodes: group.length });
  }

  if (placed.length) {
    k.scheduled += placed.length;
    pushEvent("success", EV(`调度器已放置 ${placed.length} 个任务（${placed.reduce((a, x) => a + x.gpus, 0)} GPU）`, `Scheduler placed ${placed.length} jobs (${placed.reduce((a, x) => a + x.gpus, 0)} GPUs)`));
  }
  if (preempted.length) {
    pushEvent("warning", EV(`${preempted.length} 个任务通过抢占获得 GPU`, `${preempted.length} jobs acquired GPUs via preemption`));
  }
  if (blocked.length) {
    pushEvent("warning", EV(`${blocked.length} 个任务仍阻塞：可调度 GPU 不足`, `${blocked.length} jobs still blocked: not enough schedulable GPUs`));
  }
  return { placed, blocked, preempted, summary: k8sSummary(s) };
}

// 工作负载动作：restart / delete / scale
export function podAction(s, id, action) {
  const k = s.k8s;
  const p = k.pods.find((x) => x.id === id);
  if (!p) return { ok: false, error: "工作负载不存在: " + id };

  if (action === "restart") {
    p.restarts += 1;
    p.phase = "running";
    p.reason = "";
    p.gpuUtil = 20 + Math.floor(Math.random() * 40);
    pushEvent("info", EV(`已重启 ${p.name}（第 ${p.restarts} 次）`, `Restarted ${p.name} (${p.restarts}th)`));
  } else if (action === "delete") {
    if (p.node) {
      const n = k.nodes.find((x) => x.id === p.node);
      if (n) { n.allocated = Math.max(0, n.allocated - p.gpuCount); n.pods = Math.max(0, n.pods - 1); }
    }
    k.pods = k.pods.filter((x) => x.id !== id);
    pushEvent("warning", EV(`工作负载 ${p.name} 已删除并释放 ${p.gpuCount} GPU`, `Workload ${p.name} deleted, released ${p.gpuCount} GPUs`));
    return { ok: true, removed: id };
  } else if (action === "preempt") {
    if (p.node) {
      const n = k.nodes.find((x) => x.id === p.node);
      if (n) { n.allocated = Math.max(0, n.allocated - p.gpuCount); n.pods = Math.max(0, n.pods - 1); }
    }
    p.node = "";
    p.phase = "pending";
    p.reason = EV("被高优先级任务抢占（Preemption）", "Preempted by a higher-priority job");
    k.preempted += 1;
    pushEvent("warning", EV(`已抢占 ${p.name}，释放 ${p.gpuCount} GPU 给高优先级任务`, `Preempted ${p.name}, freed ${p.gpuCount} GPUs for high-priority jobs`));
  } else {
    return { ok: false, error: "不支持的动作: " + action };
  }
  return { ok: true, pod: p };
}

// 命名空间配额调整
export function quotaSet(s, ns, field, value) {
  const q = s.k8s.quotas.find((x) => x.ns === ns);
  if (!q) return { ok: false, error: "命名空间不存在: " + ns };
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return { ok: false, error: "配额必须是非负数字" };
  if (!["gpuLimit", "cpuLimit", "memLimit", "podLimit"].includes(field)) return { ok: false, error: "不支持的配额字段" };
  const old = q[field];
  q[field] = num;
  pushEvent("info", EV(`命名空间 ${ns} 的 ${field} 由 ${old} 调整为 ${num}`, `Namespace ${ns} ${field}: ${old} → ${num}`));
  return { ok: true, quota: q };
}

// 机架拓扑：按 cabinet 聚合节点热度（对齐 Cabinet Visualizer）
// 口径统一：unhealthy = status !== ready（不可调度），stragglers = health 降级但可调度 —— 与前端格子颜色一致
export function topology(s) {
  const k = s.k8s;
  const map = {};
  k.nodes.forEach((n) => {
    const key = n.cabinet;
    if (!map[key]) map[key] = { cabinet: key, rack: n.rack, nodes: [], gpus: 0, used: 0, maxTemp: 0, unhealthy: 0, stragglers: 0 };
    map[key].nodes.push(n.id);
    map[key].gpus += n.gpus;
    map[key].used += n.allocated;
    map[key].maxTemp = Math.max(map[key].maxTemp, n.temp);
    if (n.status !== "ready") map[key].unhealthy += 1;
    if (n.straggler || n.health !== "Pass") map[key].stragglers += 1;
  });
  return Object.values(map).sort((a, b) => a.cabinet.localeCompare(b.cabinet));
}

// 集群指标序列（values 为双语）
export function k8sMetrics(tab = "gpu", range = "1h") {
  const n = range === "7d" ? 60 : range === "24h" ? 45 : 35;
  if (tab === "scheduler") {
    return {
      primary: series(11, 42, 30, n), secondary: series(13, 12, 10, n),
      values: [
        EV("12 队列", "12 queued"), EV("38m 等待", "38m wait"),
        EV("128 已调度", "128 scheduled"), EV("7 抢占", "7 preempted"),
      ],
    };
  }
  if (tab === "network") {
    return {
      primary: series(17, 320, 110, n), secondary: series(19, 120, 60, n),
      values: [
        EV("382 GB/s", "382 GB/s"), EV("1.8 µs", "1.8 µs"),
        EV("0.02% 丢包", "0.02% loss"), EV("6 链路降级", "6 links degraded"),
      ],
    };
  }
  if (tab === "thermal") {
    return {
      primary: series(23, 68, 12, n), secondary: series(29, 6400, 900, n),
      values: [
        EV("72℃ 均值", "72℃ avg"), EV("86℃ 峰值", "86℃ peak"),
        EV("6.4 kW/节点", "6.4 kW/node"), EV("2 液冷异常", "2 liquid-cool alerts"),
      ],
    };
  }
  return {
    primary: series(3, 88, 14, n), secondary: series(5, 76, 18, n),
    values: [
      EV("88% 利用率", "88% util"), EV("94.6% Goodput", "94.6% goodput"),
      EV("87.8h MTTF", "87.8h MTTF"), EV("3 Straggler", "3 stragglers"),
    ],
  };
}
