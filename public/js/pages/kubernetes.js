// Kubernetes GPU 资源管理控制台（中英双语）
// 覆盖：集群概览 / GPU 节点 / 资源配额 / 调度队列 / 工作负载
// 设计参考 CoreWeave CKS + SUNK + Mission Control
import { api } from "../api.js";
import { header, metric, section, btn, esc, status, chart, tabs, select, opt, input, modal, closeModal, toast, copy, t, L } from "../ui.js";

// 双语标签快捷函数（返回已转义文案）
const b = (zh, en) => esc(L({ zh, en }));

const NODE_STATUS_MAP = {
  ready: ["Ready", "green"], cordoned: ["Cordoned", "amber"], draining: ["Draining", "blue"],
  remediation: ["Remediation", "red"], notready: ["NotReady", "red"],
};
const PHASE_MAP = {
  running: ["Running", "green"], pending: ["Pending", "amber"], succeeded: ["Succeeded", "gray"],
  failed: ["Failed", "red"], terminating: ["Terminating", "blue"],
};
const nodeStatus = (st) => { const x = NODE_STATUS_MAP[st] || [st, "gray"]; return `<span class="pill ${x[1]}"><i class="dot"></i>${x[0]}</span>`; };
const phase = (st) => { const x = PHASE_MAP[st] || [st, "gray"]; return `<span class="pill ${x[1]}"><i class="dot"></i>${x[0]}</span>`; };
const mono = (s) => `<span class="mono">${esc(s)}</span>`;
const pct = (a, b2) => (b2 > 0 ? Math.round((a / b2) * 100) : 0);

function allocBar(used, total) {
  const p = Math.min(100, pct(used, total));
  const color = p >= 90 ? "#d64545" : p >= 70 ? "#e0873a" : "#ff6000";
  return `<div class="alloc"><div class="alloc-track"><i style="width:${p}%;background:${color}"></i></div><span>${used}/${total}</span></div>`;
}
function tempPill(x) {
  const c = x >= 82 ? "red" : x >= 72 ? "amber" : "green";
  return `<span class="pill ${c}"><i class="dot"></i>${x}℃</span>`;
}

// ============ 集群概览 ============
function overviewTab(sum, cabinets, S) {
  const c = sum.cluster;
  const m = S.k8sMetrics || {};
  const vals = ((m.values && m.values.length ? m.values : ["88%", "94.6%", "87.8h", "3"]).map((x) => L(x))).slice(0, 4);
  while (vals.length < 4) vals.push("—");
  return [
    `<div class="grid cols-4 mb16">`,
    metric(b("GPU 分配率", "GPU allocation"), c.allocPct + "%", `${c.allocatedGpus} / ${c.totalGpus}`, "<i class='bi bi-cpu'></i>", c.schedulableGpus + " free", "hero"),
    metric("Goodput", c.goodput + "%", b("有效算力时间占比", "Effective compute ratio"), "<i class='bi bi-box-seam'></i>", "≥ 93%"),
    metric(b("健康 GPU", "Healthy GPUs"), c.healthyGpus, `${c.stragglers} straggler · ${c.remediation} ${b("修复中", "in repair")}`, "<i class='bi bi-check2-circle'></i>", ""),
    metric("MTTF", c.mttfHours + "h", `restart ~${c.jobRestartSec}s`, "⏱", ""),
    `</div>`,
    `<div class="grid cols-2 mb16">`,
    `<div class="card card-pad">${section(b("集群概览", "Cluster overview"), `<span class="pill blue">${esc(c.product)}</span>`)}`,
    `<div class="kv dense">`,
    `<div><span>${b("集群", "Cluster")}</span><b>${mono(c.name)}</b></div>`,
    `<div><span>K8s ${b("版本", "version")}</span><b>${mono(c.version)}</b></div>`,
    `<div><span>${b("区域", "Region")}</span><b>${esc(c.region)}</b></div>`,
    `<div><span>${b("控制面", "Control plane")}</span><b>${esc(L(c.controlPlane))}</b></div>`,
    `<div><span>${b("网络", "Network")}</span><b>${esc(c.network)}</b></div>`,
    `<div><span>${b("调度器", "Scheduler")}</span><b>${esc(c.scheduler)}</b></div>`,
    `<div><span>${b("节点", "Nodes")}</span><b>${c.readyNodes} / ${c.totalNodes} Ready</b></div>`,
    `<div><span>${b("待调度", "Pending")}</span><b>${sum.pendingCount} · ${sum.pendingGpus} GPU</b></div>`,
    `</div>`,
    `<div class="callout mt16">${b("拓扑感知调度把 Gang 任务尽量收敛在同一 NVLink 域内，减少跨机架通信；当队列阻塞时，低优先级任务可被抢占。", "Topology-aware scheduling keeps gang jobs inside one NVLink domain to cut cross-rack traffic; when the queue blocks, lower-priority jobs can be preempted.")}</div>`,
    `</div>`,
    `<div class="card card-pad">${section(b("GPU 利用率 / 分配趋势", "Utilization / allocation trend"), `<span class="pill blue">LIVE</span>`)}`,
    chart(m.primary || [40, 60, 55, 70, 65, 80], { second: m.secondary, color2: "#34383b", height: 214 }),
    `<div class="statline">`,
    `<div><span>${b("利用率", "Utilization")}</span><b>${vals[0]}</b></div><div><span>Goodput</span><b>${vals[1]}</b></div><div><span>MTTF</span><b>${vals[2]}</b></div><div><span>Straggler</span><b>${vals[3]}</b></div>`,
    `</div></div>`,
    `</div>`,
    `<div class="card card-pad mb16">${section(b("节点池 · Node Pools", "Node pools"), btn("＋ " + b("扩容节点池", "Scale pool"), "pools-scale", "sm"))}`,
    `<div class="table-wrap"><table class="dense"><thead><tr>`,
    `<th>${b("节点池", "Pool")}</th><th>${b("型号", "GPU")}</th><th>${b("单节点", "Per node")}</th><th>${b("节点数", "Nodes")}</th><th>${b("总 GPU", "Total GPUs")}</th><th>${b("已用", "Used")}</th><th>${b("可调度", "Schedulable")}</th><th>${b("分配", "Alloc")}</th><th>${b("互联", "Fabric")}</th><th>${b("用途", "Purpose")}</th>`,
    `</tr></thead><tbody>`,
    sum.pools.map((p) => `<tr><td>${mono(p.name)}</td><td>${esc(p.gpu)}</td><td>${p.gpus} × ${p.vram}GB</td><td>${p.actualNodes}</td><td>${p.total}</td><td>${p.used}</td><td>${p.free}</td><td>${allocBar(p.used, p.total)}</td><td class="small">${esc(p.fabric)}</td><td class="small">${esc(L(p.purpose))}</td></tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="card card-pad">${section(b("机架拓扑 · Cabinet", "Rack topology · cabinet"), `<span class="small muted">${b("每格代表一台 GPU 节点，颜色为 GPU 温度", "Each slot is a GPU node, colored by GPU temperature")}</span>`)}`,
    `<div class="racks">`,
    cabinets.map((cb) => {
      const nodes = S.k8sNodes ? S.k8sNodes.filter((n) => n.cabinet === cb.cabinet) : [];
      // 口径统一：异常 = status !== ready（与格子红色一致）；straggler 单独计（health 检查降级但可调度）
      const redCount = nodes.filter((n) => n.status !== "ready").length;
      const stragglerCount = nodes.filter((n) => n.straggler).length;
      const healthText = redCount > 0 ? `<span class="pill red sm"><i class="dot"></i>${redCount} ${b("异常", "unhealthy")}</span>` : stragglerCount > 0 ? `<span class="pill amber sm"><i class="dot"></i>${stragglerCount} straggler</span>` : `<span class="pill green sm"><i class="dot"></i>${b("正常", "healthy")}</span>`;
      return `<div class="rack"><div class="rack-head"><b>${mono(cb.cabinet)}</b><span class="small muted">${cb.used}/${cb.gpus} GPU · ${healthText}</span></div><div class="rack-grid">${
        nodes.map((n) => {
          // 红色仅用于不可调度（cordoned/draining/remediation/notready）；straggler 用黄色边框点缀
          const bg = n.status !== "ready" ? "#d64545" : n.temp >= 82 ? "#e0873a" : n.temp >= 72 ? "#f0b429" : "#3aa76d";
          const ring = n.straggler && n.status === "ready" ? "box-shadow:0 0 0 2px #f0b429;" : "";
          const stLabel = { ready: "Ready", cordoned: "Cordoned", draining: "Draining", remediation: "Remediation", notready: "NotReady" }[n.status] || n.status;
          return `<i class="slot" title="${esc(n.id)} · ${esc(n.gpu)} ×${n.gpus} · ${stLabel} · ${n.health} · ${n.temp}℃ · ${n.allocated}/${n.gpus}" style="background:${bg};${ring}" data-act="node:${n.id}"></i>`;
        }).join("")
      }</div></div>`;
    }).join(""),
    `</div>`,
    `<div class="flex small muted mt12"><span><i class="swatch" style="background:#3aa76d"></i> &lt;72℃ ${b("可调度", "schedulable")}</span><span><i class="swatch" style="background:#f0b429"></i> 72–81℃</span><span><i class="swatch" style="background:#e0873a"></i> ≥82℃</span><span><i class="swatch" style="background:#d64545"></i> ${b("不可调度（封锁/排空/修复/失联）", "Unschedulable (cordoned/draining/remediation/notready)")}</span><span><i class="swatch" style="background:#3aa76d;box-shadow:0 0 0 2px #f0b429"></i> ${b("straggler（降速可调度）", "straggler (degraded, schedulable)")}</span></div>`,
    `</div>`,
  ].join("");
}

// ============ GPU 节点 ============
function nodesTab(nodes, pools, S) {
  return [
    `<div class="card filterbar mb16">`,
    `<select data-set="k8sPool">${opt([["all", b("全部节点池", "All pools")], ...pools.map((p) => [p.id, p.name])], S.k8sPool)}</select>`,
    `<select data-set="k8sStatus">${opt([["all", b("全部状态", "All statuses")], ["ready", "Ready"], ["cordoned", "Cordoned"], ["draining", "Draining"], ["remediation", "Remediation"], ["notready", "NotReady"]], S.k8sStatus)}</select>`,
    `<span class="small muted">${nodes.length} ${b("个节点", "nodes")}</span>`,
    `<span class="top-spacer"></span>${btn("↻ " + b("刷新", "Refresh"), "refresh", "sm")}`,
    `</div>`,
    `<div class="card card-pad">${section(b("GPU 节点 · Nodes", "GPU nodes"), `<span class="small muted">${b("抽样浏览视图 · 全量 ", "Sampled browse view · ")}${"1,100"} ${b("节点按池聚合统计见概览页", "nodes total; aggregate stats on the overview tab")}</span>`)}`,
    `<div class="table-wrap"><table class="dense"><thead><tr>`,
    `<th>${b("节点", "Node")}</th><th>${b("状态", "Status")}</th><th>${b("节点池", "Pool")}</th><th>GPU</th><th>${b("分配", "Alloc")}</th><th>CPU</th><th>${b("内存", "RAM")}</th><th>${b("温度", "Temp")}</th><th>${b("功耗", "Power")}</th><th>${b("机架", "Rack")}</th><th>Pods</th><th>${b("健康", "Health")}</th><th>${b("操作", "Actions")}</th>`,
    `</tr></thead><tbody>`,
    nodes.map((n) => `<tr>
      <td>${mono(n.id)}${n.straggler ? ` <span class="pill red sm"><i class="dot"></i>straggler</span>` : ""}</td>
      <td>${nodeStatus(n.status)}</td>
      <td class="small">${mono(n.poolName)}</td>
      <td><b>${esc(n.gpu)}</b> <span class="small muted">×${n.gpus}</span></td>
      <td>${allocBar(n.allocated, n.gpus)}</td>
      <td class="small">${n.cpuUsed}/${n.cpu}</td>
      <td class="small">${n.ramUsed}/${n.ram}G</td>
      <td>${tempPill(n.temp)}</td>
      <td class="small">${n.power}W</td>
      <td class="small">${mono(n.cabinet)}</td>
      <td>${n.pods}</td>
      <td class="small">${n.health === "Pass" ? `<span class="pill green sm"><i class="dot"></i>Pass</span>` : `<span class="pill red sm"><i class="dot"></i>${esc(n.health)}</span>`}</td>
      <td><div class="table-actions">
        ${btn(b("详情", "Detail"), "node:" + n.id, "xs")}
        ${n.status === "ready" || n.status === "cordoned" ? btn(n.status === "cordoned" ? b("取消封锁", "Uncordon") : b("封锁", "Cordon"), (n.status === "cordoned" ? "node-uncordon:" : "node-cordon:") + n.id, "xs") : ""}
        ${btn(b("排空", "Drain"), "node-drain:" + n.id, "xs")}
        ${n.straggler ? btn(b("清标记", "Clear"), "node-clear:" + n.id, "xs") : ""}
        ${n.health !== "Pass" ? btn(b("修复", "Repair"), "node-restore:" + n.id, "xs") : ""}
      </div></td>
    </tr>`).join(""),
    `</tbody></table></div>`,
    `<div class="callout mt16">${b("cordon 停止新 Pod 调度；drain 驱逐现有 Pod 并触发重调度；Mission Control 对健康检测失败的节点自动进入 Remediation，修复完成后重新加入调度。", "cordon blocks new pods; drain evicts pods and triggers rescheduling; Mission Control auto-remediates unhealthy nodes and returns them to scheduling.")}</div>`,
    `</div>`,
  ].join("");
}

// ============ 资源配额 ============
function quotaTab(quotas) {
  const bar = (used, limit, unit) => {
    const p = Math.min(100, pct(used, limit));
    const color = p >= 92 ? "#d64545" : p >= 75 ? "#e0873a" : "#ff6000";
    return `<div class="alloc"><div class="alloc-track"><i style="width:${p}%;background:${color}"></i></div><span>${used}/${limit}${unit || ""}</span></div>`;
  };
  return [
    `<div class="card card-pad mb16">${section(b("命名空间配额 · ResourceQuota", "Namespace quotas · ResourceQuota"), `<span class="small muted">nvidia.com/gpu ${b("为 GPU 核心配额单位", "is the GPU quota unit")}</span>`)}`,
    `<div class="table-wrap"><table class="dense"><thead><tr>`,
    `<th>Namespace</th><th>${b("团队", "Team")}</th><th>${b("优先级", "Priority")}</th><th>${b("GPU 配额", "GPU quota")}</th><th>CPU</th><th>${b("内存", "Memory")}</th><th>Pod</th><th>${b("操作", "Actions")}</th>`,
    `</tr></thead><tbody>`,
    quotas.map((q) => `<tr>
      <td>${mono(q.ns)}</td>
      <td>${esc(L(q.team))}</td>
      <td>${q.priority === "Critical" ? `<span class="pill red sm"><i class="dot"></i>Critical</span>` : q.priority === "High" ? `<span class="pill amber sm"><i class="dot"></i>High</span>` : `<span class="pill gray sm"><i class="dot"></i>BestEffort</span>`}</td>
      <td>${bar(q.gpuUsed, q.gpuLimit)}</td>
      <td>${bar(q.cpuUsed, q.cpuLimit)}</td>
      <td>${bar(q.memUsed, q.memLimit)}</td>
      <td>${bar(q.podUsed, q.podLimit)}</td>
      <td>${btn(b("调整", "Edit"), "quota:" + q.ns, "xs")}</td>
    </tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="grid cols-2">`,
    `<div class="card card-pad">${section(b("配额分配建议", "Quota guidance"))}`,
    `<div class="callout">${b("Critical 命名空间建议保留 ≥ 20% GPU 余量用于故障转移；BestEffort 队列在集群紧张时优先被抢占，适合开发调试与批量评测。", "Keep ≥20% GPU headroom in Critical namespaces for failover; BestEffort queues are preempted first and fit dev/debug and batch evaluation.")}</div>`,
    `<div class="kv dense mt16">`,
    `<div><span>${b("集群 GPU 总量", "Cluster GPUs")}</span><b>${quotas.reduce((a, q) => a + q.gpuLimit, 0)}</b></div>`,
    `<div><span>${b("实际使用", "In use")}</span><b>${quotas.reduce((a, q) => a + q.gpuUsed, 0)}</b></div>`,
    `<div><span>${b("配额水位", "Quota level")}</span><b>${pct(quotas.reduce((a, q) => a + q.gpuUsed, 0), quotas.reduce((a, q) => a + q.gpuLimit, 0))}%</b></div>`,
    `</div></div>`,
    `<div class="card card-pad">${section(b("抢占与优先级", "Preemption & priority"))}`,
    `<div class="table-wrap"><table class="dense"><thead><tr><th>${b("优先级", "Priority")}</th><th>${b("抢占策略", "Preemption")}</th><th>${b("适用场景", "Use case")}</th></tr></thead><tbody>`,
    `<tr><td><span class="pill red sm"><i class="dot"></i>Critical</span></td><td>${b("不被抢占", "Never preempted")}</td><td class="small">${b("生产训练 / 在线推理", "Production training / online inference")}</td></tr>`,
    `<tr><td><span class="pill amber sm"><i class="dot"></i>High</span></td><td>${b("可抢占 BestEffort", "Can preempt BestEffort")}</td><td class="small">${b("评测 / 数据处理", "Evaluation / data processing")}</td></tr>`,
    `<tr><td><span class="pill gray sm"><i class="dot"></i>BestEffort</span></td><td>${b("优先被抢占", "Preempted first")}</td><td class="small">${b("开发沙箱 / 批处理", "Dev sandbox / batch")}</td></tr>`,
    `</tbody></table></div></div>`,
    `</div>`,
  ].join("");
}

// ============ 调度队列 ============
function schedulerTab(sch, S) {
  const pend = sch.pending || [];
  return [
    `<div class="grid cols-4 mb16">`,
    metric(b("待调度任务", "Pending jobs"), pend.length, `${pend.reduce((a, p) => a + p.gpuCount, 0)} GPU`, "⏳", ""),
    metric(b("最长等待", "Longest wait"), pend.length ? Math.max(...pend.map((p) => {
      // age 可能是 "42 分钟" / {zh:"42 分钟",en:"42m"} 等形态，统一提取数字（分钟）
      const raw = String(L(p.age) || "");
      const num = parseInt(raw.replace(/[^0-9]/g, ""), 10);
      return Number.isFinite(num) ? num : 0;
    })) + b(" 分钟", "m") : "0m", b("队首任务", "Head of queue"), "<i class='bi bi-clock-history'></i>", ""),
    metric(b("累计调度", "Scheduled"), sch.scheduled, b("本次会话", "This session"), "<i class='bi bi-check2-circle'></i>", ""),
    metric(b("抢占次数", "Preemptions"), sch.preempted, b("低优先级被抢占", "Low priority preempted"), "<i class='bi bi-arrow-left-right'></i>", ""),
    `</div>`,
    `<div class="card card-pad mb16">${section(b("调度队列 · Pending", "Scheduler queue · pending"), btn("<i class='bi bi-lightning-charge-fill'></i> " + b("触发调度", "Dispatch"), "k8s-dispatch", "primary"))}`,
    pend.length
      ? `<div class="table-wrap"><table class="dense"><thead><tr><th>${b("任务", "Job")}</th><th>Namespace</th><th>${b("类型", "Kind")}</th><th>GPU</th><th>${b("拓扑约束", "Topology")}</th><th>${b("优先级", "Priority")}</th><th>${b("等待", "Wait")}</th><th>${b("阻塞原因", "Blocked reason")}</th><th>${b("操作", "Actions")}</th></tr></thead><tbody>${pend.map((p) => `<tr>
      <td>${mono(p.name)}</td>
      <td class="small">${mono(p.ns)}</td>
      <td class="small">${esc(p.kind)}</td>
      <td><b>${p.gpuCount}</b> <span class="small muted">${esc(p.gpu)}</span></td>
      <td class="small">${esc(L(p.topology) || b("无约束", "None"))}${p.gang > 1 ? ` · gang ${p.gang}` : ""}</td>
      <td>${p.priority === "Critical" ? `<span class="pill red sm"><i class="dot"></i>Critical</span>` : `<span class="pill ${p.priority === "High" ? "amber" : "gray"} sm"><i class="dot"></i>${esc(p.priority)}</span>`}</td>
      <td class="small">${esc(p.age)}</td>
      <td class="small warn">${esc(p.reason || "—")}</td>
      <td>${btn(b("抢占", "Preempt"), "pod-preempt:" + p.id, "xs")}${btn(b("删除", "Delete"), "pod-delete:" + p.id, "xs")}</td>
    </tr>`).join("")}</tbody></table></div>`
      : `<div class="card empty">${b("队列为空，所有任务已调度", "Queue is empty — all jobs scheduled")}</div>`,
    `<div class="callout mt16">${b("调度器按「GPU 需求降序 + 拓扑域内收敛 + 温度最低」选择节点；Gang 任务要求同时拿到全部 GPU，否则整体等待，避免部分启动造成的死锁。", "The scheduler orders by GPU demand, converges inside a topology domain and prefers cooler nodes; gang jobs need all GPUs at once to avoid partial-start deadlocks.")}</div>`,
    `</div>`,
    `<div class="card card-pad">${section(b("调度策略 · SUNK Topology-Aware", "Scheduling policy · SUNK topology-aware"))}`,
    `<div class="kv dense">`,
    `<div><span>${b("调度算法", "Algorithm")}</span><b>Gang + ${b("拓扑感知", "topology-aware")} + ${b("反碎片", "anti-fragmentation")}</b></div>`,
    `<div><span>${b("NVLink 域优先", "NVLink domain first")}</span><b>${b("启用", "Enabled")}</b></div>`,
    `<div><span>${b("抢占", "Preemption")}</span><b>${b("仅 BestEffort / High 可被抢占", "Only BestEffort / High can be preempted")}</b></div>`,
    `<div><span>${b("训练 / 推理混部", "Train / infer colocation")}</span><b>${b("启用", "Enabled")}</b></div>`,
    `</div></div>`,
  ].join("");
}

// ============ 工作负载 ============
function workloadsTab(pods, ns, S) {
  const list = S.k8sNs && S.k8sNs !== "all" ? pods.filter((p) => p.ns === S.k8sNs) : pods;
  return [
    `<div class="card filterbar mb16">`,
    `<select data-set="k8sNs">${opt([["all", b("全部命名空间", "All namespaces")], ...ns.map((n) => [n, n])], S.k8sNs)}</select>`,
    `<select data-set="k8sPhase">${opt([["all", b("全部状态", "All phases")], ["running", "Running"], ["pending", "Pending"], ["failed", "Failed"], ["succeeded", "Succeeded"]], S.k8sPhase)}</select>`,
    `<span class="small muted">${list.length} ${b("个工作负载", "workloads")}</span>`,
    `</div>`,
    `<div class="card card-pad">${section(b("工作负载 · Pods / Jobs / Deployments", "Workloads · pods / jobs / deployments"))}`,
    `<div class="table-wrap"><table class="dense"><thead><tr>`,
    `<th>${b("名称", "Name")}</th><th>Namespace</th><th>${b("类型", "Kind")}</th><th>${b("阶段", "Phase")}</th><th>GPU</th><th>${b("节点", "Node")}</th><th>${b("利用率", "Util")}</th><th>${b("重启", "Restarts")}</th><th>${b("运行时长", "Age")}</th><th>${b("负责人", "Owner")}</th><th>${b("说明", "Note")}</th><th>${b("操作", "Actions")}</th>`,
    `</tr></thead><tbody>`,
    list.map((p) => `<tr>
      <td>${mono(p.name)}</td>
      <td class="small">${mono(p.ns)}</td>
      <td class="small">${esc(p.kind)}</td>
      <td>${phase(p.phase)}</td>
      <td><b>${p.gpuCount}</b> <span class="small muted">${esc(p.gpu)}</span></td>
      <td class="small">${p.node ? mono(p.node) : `<span class="muted">${b("未分配", "Unassigned")}</span>`}</td>
      <td>${p.gpuUtil > 0 ? allocBar(Math.round(p.gpuUtil / 10), 10) : `<span class="muted">—</span>`}</td>
      <td>${p.restarts}</td>
      <td class="small">${esc(p.age)}</td>
      <td class="small">${esc(p.owner)}</td>
      <td class="small muted">${esc(p.reason || p.note || "—")}</td>
      <td><div class="table-actions">
        ${btn(b("详情", "Detail"), "pod:" + p.id, "xs")}
        ${p.phase === "running" ? btn(b("重启", "Restart"), "pod-restart:" + p.id, "xs") : ""}
        ${btn(b("删除", "Delete"), "pod-delete:" + p.id, "xs")}
      </div></td>
    </tr>`).join(""),
    `</tbody></table></div></div>`,
  ].join("");
}

export default async function kubernetesPage(S) {
  const tab = S.k8sTab;
  const sum = await api.k8sSummary();
  const m = await api.k8sMetrics(tab === "scheduler" ? "scheduler" : "gpu", S.k8sRange);
  S.k8sMetrics = m;
  S.k8sSummary = sum;

  let body = "";
  if (tab === "nodes") {
    const r = await api.k8sNodes(S.k8sPool, S.k8sStatus);
    S.k8sNodes = r.nodes;
    body = nodesTab(r.nodes, r.pools, S);
  } else if (tab === "quotas") {
    const r = await api.k8sQuotas();
    body = quotaTab(r.quotas);
  } else if (tab === "scheduler") {
    const r = await api.k8sScheduler();
    body = schedulerTab(r, S);
  } else if (tab === "workloads") {
    const r = await api.k8sWorkloads(S.k8sNs, S.k8sPhase);
    body = workloadsTab(r.pods, r.namespaces, S);
  } else {
    const topo = await api.k8sTopology();
    const nr = await api.k8sNodes("all", "all");
    S.k8sNodes = nr.nodes;
    body = overviewTab(sum, topo.cabinets, S);
  }

  const ev = await api.k8sEvents();
  return [
    header(
      b("GPU 集群 · Kubernetes", "GPU Cluster · Kubernetes"),
      `${esc(sum.cluster.name)} · ${esc(sum.cluster.version)} · ${esc(sum.cluster.scheduler)} — ${b("节点、配额、调度与机架级可观测性", "nodes, quotas, scheduling and rack-level observability")}`,
      btn("<i class='bi bi-lightning-charge-fill'></i> " + b("触发调度", "Dispatch"), "k8s-dispatch", "primary") + btn("↻ " + b("刷新", "Refresh"), "refresh", "sm")
    ),
    tabs([["overview", "k8s.tab.overview"], ["nodes", "k8s.tab.nodes"], ["quotas", "k8s.tab.quotas"], ["scheduler", "k8s.tab.scheduler"], ["workloads", "k8s.tab.workloads"]], tab, "k8sTab"),
    `<div class="card filterbar mb16">`,
    `<span class="mono small">${esc(sum.cluster.name)}</span>`,
    `<span class="pill blue sm"><i class="dot"></i>${sum.cluster.readyNodes}/${sum.cluster.totalNodes} Ready</span>`,
    `<span class="small muted">GPU ${sum.cluster.allocatedGpus}/${sum.cluster.totalGpus} · ${b("可调度", "schedulable")} ${sum.cluster.schedulableGpus} · ${b("待调度", "pending")} ${sum.pendingCount}</span>`,
    `<span class="top-spacer"></span>`,
    `<select data-set="k8sRange">${opt([["1h", b("1 小时", "1 hour")], ["24h", b("24 小时", "24 hours")], ["7d", b("7 天", "7 days")]], S.k8sRange)}</select>`,
    `</div>`,
    body,
    `<div class="card card-pad mt16">${section(b("集群事件 · kubectl get events", "Cluster events · kubectl get events"))}`,
    `<div class="table-wrap"><table class="dense"><thead><tr><th>${b("类型", "Type")}</th><th>Reason</th><th>${b("对象", "Object")}</th><th>${b("消息", "Message")}</th><th>${b("次数", "Count")}</th><th>${b("最近", "Last")}</th></tr></thead><tbody>`,
    ev.events.map((e) => `<tr><td>${e.type === "Warning" ? `<span class="pill amber sm"><i class="dot"></i>Warning</span>` : `<span class="pill green sm"><i class="dot"></i>Normal</span>`}</td><td class="small">${esc(e.reason)}</td><td class="small">${mono(e.object)}</td><td>${esc(e.message)}</td><td>${e.count}</td><td class="small">${esc(e.lastSeen)}</td></tr>`).join(""),
    `</tbody></table></div></div>`,
  ].join("");
}

// ============ 供 app.js 调用的交互处理 ============
export function nodeDetail(node, pods) {
  modal(
    b("节点详情", "Node detail") + " · " + node.id,
    `<div class="kv dense">
      <div><span>${b("状态", "Status")}</span><b>${nodeStatus(node.status)}</b></div>
      <div><span>${b("节点池", "Pool")}</span><b>${mono(node.poolName)}</b></div>
      <div><span>GPU</span><b>${esc(node.gpu)} × ${node.gpus}（${node.vramPerGpu}GB/卡）</b></div>
      <div><span>${b("GPU 分配", "GPU allocation")}</span><b>${node.allocated} / ${node.gpus}</b></div>
      <div><span>CPU / ${b("内存", "RAM")}</span><b>${node.cpuUsed}/${node.cpu} · ${node.ramUsed}/${node.ram} Gi</b></div>
      <div><span>${b("NVLink 域", "NVLink domain")}</span><b>${mono(node.domain)}</b></div>
      <div><span>${b("机架 / 机柜", "Rack / cabinet")}</span><b>${mono(node.rack)} / ${mono(node.cabinet)}</b></div>
      <div><span>${b("温度 / 功耗", "Temp / power")}</span><b>${node.temp}℃ · ${node.power}W</b></div>
      <div><span>${b("健康", "Health")}</span><b>${esc(node.health)}${node.straggler ? " · straggler" : ""}</b></div>
      <div><span>Taints</span><b>${node.taints.length ? mono(node.taints.join(", ")) : b("无", "None")}</b></div>
      <div><span>${b("运行时长", "Uptime")}</span><b>${esc(node.uptime)} · ${b("最近检查", "last check")} ${esc(node.lastCheck)}</b></div>
    </div>
    <div class="mt16">${section(b("节点上的 Pod", "Pods on node") + "（" + pods.length + "）")}</div>
    ${pods.length ? `<div class="table-wrap"><table class="dense"><thead><tr><th>Pod</th><th>${b("阶段", "Phase")}</th><th>GPU</th><th>${b("利用率", "Util")}</th></tr></thead><tbody>${pods.map((p) => `<tr><td>${mono(p.name)}</td><td>${phase(p.phase)}</td><td>${p.gpuCount}</td><td>${p.gpuUtil}%</td></tr>`).join("")}</tbody></table></div>` : `<div class="small muted">${b("该节点当前没有 Pod", "No pods on this node")}</div>`}`,
    btn(b("封锁节点", "Cordon node"), "node-cordon:" + node.id, "sm") + btn(b("排空", "Drain"), "node-drain:" + node.id, "sm") + btn(t("common.close"), "close-modal")
  );
}

export function podDetail(pod) {
  modal(
    b("工作负载详情", "Workload detail") + " · " + pod.name,
    `<div class="kv dense">
      <div><span>Namespace</span><b>${mono(pod.ns)}</b></div>
      <div><span>${b("类型", "Kind")}</span><b>${esc(pod.kind)}</b></div>
      <div><span>${b("阶段", "Phase")}</span><b>${phase(pod.phase)}</b></div>
      <div><span>${b("GPU 申请", "GPU request")}</span><b>${pod.gpuCount} × ${esc(pod.gpu)}（nvidia.com/gpu: ${pod.gpuCount}）</b></div>
      <div><span>${b("调度节点", "Scheduled node")}</span><b>${pod.node ? mono(pod.node) : b("未分配", "Unassigned")}</b></div>
      <div><span>${b("拓扑约束", "Topology")}</span><b>${esc(L(pod.topology) || b("无约束", "None"))}</b></div>
      <div><span>${b("优先级", "Priority")}</span><b>${esc(pod.priority)}</b></div>
      <div><span>${b("镜像", "Image")}</span><b>${mono(pod.image)}</b></div>
      <div><span>${b("重启次数", "Restarts")}</span><b>${pod.restarts}</b></div>
      <div><span>${b("负责人", "Owner")}</span><b>${esc(pod.owner)}</b></div>
    </div>
    ${pod.reason ? `<div class="callout warn mt16">${esc(pod.reason)}</div>` : ""}
    <div class="callout mt16">YAML：<div class="code mt12">resources:\n  limits:\n    nvidia.com/gpu: ${pod.gpuCount}</div></div>`,
    btn(b("重启", "Restart"), "pod-restart:" + pod.id, "sm") + btn(b("删除", "Delete"), "pod-delete:" + pod.id, "sm danger") + btn(t("common.close"), "close-modal")
  );
}

export function quotaModal(q) {
  modal(
    b("调整配额", "Edit quota") + " · " + q.ns,
    `<p class="small muted mb16">${b("团队", "Team")}：${esc(L(q.team))} · ${b("优先级", "Priority")} ${esc(q.priority)}。${b("调整后立即对调度器生效", "Changes apply to the scheduler immediately")}</p>
     <div class="form-grid">
       <div class="field"><label>GPU ${b("上限", "limit")}（nvidia.com/gpu）</label><input id="q-gpu" type="number" value="${q.gpuLimit}" data-set="quotaGpu"></div>
       <div class="field"><label>CPU ${b("上限", "limit")}</label><input id="q-cpu" type="number" value="${q.cpuLimit}" data-set="quotaCpu"></div>
       <div class="field"><label>${b("内存上限", "Memory limit")}（Gi）</label><input id="q-mem" type="number" value="${q.memLimit}" data-set="quotaMem"></div>
       <div class="field"><label>Pod ${b("上限", "limit")}</label><input id="q-pod" type="number" value="${q.podLimit}" data-set="quotaPod"></div>
     </div>
     <div class="small muted mt12">${b("当前使用", "Current usage")}：GPU ${q.gpuUsed} · CPU ${q.cpuUsed} · ${b("内存", "RAM")} ${q.memUsed}Gi · Pod ${q.podUsed}</div>`,
    btn(t("common.cancel"), "close-modal") + btn(b("保存 GPU 配额", "Save GPU quota"), "quota-save:" + q.ns, "primary")
  );
}
