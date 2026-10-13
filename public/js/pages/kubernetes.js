// Kubernetes GPU 资源管理控制台
// 覆盖：集群概览 / GPU 节点 / 资源配额 / 调度队列 / 工作负载
// 设计参考 CoreWeave CKS + SUNK + Mission Control：节点池、cordon/drain、straggler、拓扑感知调度、goodput、机架拓扑
import { api } from "../api.js";
import { header, metric, section, btn, esc, status, chart, tabs, select, opt, input, modal, closeModal, toast, copy } from "../ui.js";

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
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

// GPU 分配条：紧凑可视化
function allocBar(used, total) {
  const p = Math.min(100, pct(used, total));
  const color = p >= 90 ? "#d64545" : p >= 70 ? "#e0873a" : "#2f6df6";
  return `<div class="alloc"><div class="alloc-track"><i style="width:${p}%;background:${color}"></i></div><span>${used}/${total}</span></div>`;
}

function tempPill(t) {
  const c = t >= 82 ? "red" : t >= 72 ? "amber" : "green";
  return `<span class="pill ${c}"><i class="dot"></i>${t}℃</span>`;
}

// ============ 集群概览 ============
function overviewTab(sum, cabinets, S) {
  const c = sum.cluster;
  const m = S.k8sMetrics || {};
  const vals = m.values || ["88% 利用率", "94.6% Goodput", "87.8h MTTF", "3 Straggler"];
  return [
    `<div class="grid cols-4 mb16">`,
    metric("GPU 分配率", c.allocPct + "%", `${c.allocatedGpus} / ${c.totalGpus} 张已分配`, "▦", `可调度 ${c.schedulableGpus}`),
    metric("Goodput", c.goodput + "%", "有效算力时间占比", "◈", "目标 ≥ 93%"),
    metric("健康 GPU", c.healthyGpus, `${c.stragglers} 个 straggler · ${c.remediation} 个修复中`, "✓", ""),
    metric("MTTF", c.mttfHours + "h", `任务重启 ~${c.jobRestartSec}s`, "⏱", ""),
    `</div>`,

    `<div class="grid cols-2 mb16">`,
    `<div class="card card-pad">${section("集群概览", `<span class="pill blue">${esc(c.product)}</span>`)}`,
    `<div class="kv dense">`,
    `<div><span>集群</span><b>${mono(c.name)}</b></div>`,
    `<div><span>K8s 版本</span><b>${mono(c.version)}</b></div>`,
    `<div><span>地域</span><b>${esc(c.region)}</b></div>`,
    `<div><span>控制面</span><b>${esc(c.controlPlane)}</b></div>`,
    `<div><span>网络</span><b>${esc(c.network)}</b></div>`,
    `<div><span>调度器</span><b>${esc(c.scheduler)}</b></div>`,
    `<div><span>节点</span><b>${c.readyNodes} / ${c.totalNodes} Ready</b></div>`,
    `<div><span>待调度</span><b>${sum.pendingCount} 个任务 · ${sum.pendingGpus} GPU</b></div>`,
    `</div>`,
    `<div class="callout mt16">拓扑感知调度把 Gang 任务尽量收敛在同一 NVLink 域内，减少跨机架通信；当队列阻塞时，低优先级任务可被抢占。</div>`,
    `</div>`,

    `<div class="card card-pad">${section("GPU 利用率 / 分配趋势", `<span class="pill blue">LIVE</span>`)}`,
    chart(m.primary || [40, 60, 55, 70, 65, 80], { second: m.secondary, color2: "#815ce9", height: 214 }),
    `<div class="statline">`,
    `<div><span>利用率</span><b>${vals[0]}</b></div><div><span>Goodput</span><b>${vals[1]}</b></div><div><span>MTTF</span><b>${vals[2]}</b></div><div><span>Straggler</span><b>${vals[3]}</b></div>`,
    `</div></div>`,
    `</div>`,

    // 节点池
    `<div class="card card-pad mb16">${section("节点池 · Node Pools", btn("＋ 扩容节点池", "pools-scale", "sm"))}`,
    `<div class="table-wrap"><table class="dense"><thead><tr>`,
    `<th>节点池</th><th>GPU 型号</th><th>单节点</th><th>节点数</th><th>总 GPU</th><th>已用</th><th>可调度</th><th>分配</th><th>互联</th><th>用途</th>`,
    `</tr></thead><tbody>`,
    sum.pools.map((p) => `<tr><td>${mono(p.name)}</td><td>${esc(p.gpu)}</td><td>${p.gpus} 卡 / ${p.vram}GB</td><td>${p.ready}/${p.actualNodes}</td><td>${p.total}</td><td>${p.used}</td><td>${p.free}</td><td>${allocBar(p.used, p.total)}</td><td class="small">${esc(p.fabric)}</td><td class="small">${esc(p.purpose)}</td></tr>`).join(""),
    `</tbody></table></div></div>`,

    // 机架拓扑
    `<div class="card card-pad">${section("机架拓扑 · Cabinet", `<span class="small muted">每格代表一台 GPU 节点，颜色为 GPU 温度</span>`)}`,
    `<div class="racks">`,
    cabinets.map((cb) => {
      const nodes = S.k8sNodes ? S.k8sNodes.filter((n) => n.cabinet === cb.cabinet) : [];
      return `<div class="rack"><div class="rack-head"><b>${mono(cb.cabinet)}</b><span class="small muted">${cb.used}/${cb.gpus} GPU · ${cb.unhealthy ? cb.unhealthy + " 异常" : "正常"}</span></div><div class="rack-grid">${
        nodes.map((n) => {
          const t = n.temp;
          const bg = n.status !== "ready" ? "#d64545" : t >= 82 ? "#e0873a" : t >= 72 ? "#f0b429" : "#3aa76d";
          return `<i class="slot" title="${esc(n.id)} · ${esc(n.gpu)} ×${n.gpus} · ${n.temp}℃ · ${n.allocated}/${n.gpus} 已用" style="background:${bg}" data-act="node:${n.id}"></i>`;
        }).join("")
      }</div></div>`;
    }).join(""),
    `</div>`,
    `<div class="flex small muted mt12"><span><i class="swatch" style="background:#3aa76d"></i> &lt;72℃</span><span><i class="swatch" style="background:#f0b429"></i> 72–81℃</span><span><i class="swatch" style="background:#e0873a"></i> ≥82℃</span><span><i class="swatch" style="background:#d64545"></i> 节点异常</span></div>`,
    `</div>`,
  ].join("");
}

// ============ GPU 节点 ============
function nodesTab(nodes, pools, S) {
  return [
    `<div class="card filterbar mb16">`,
    `<select data-set="k8sPool">${opt([["all", "全部节点池"], ...pools.map((p) => [p.id, p.name])], S.k8sPool)}</select>`,
    `<select data-set="k8sStatus">${opt([["all", "全部状态"], ["ready", "Ready"], ["cordoned", "Cordoned"], ["draining", "Draining"], ["remediation", "Remediation"], ["notready", "NotReady"]], S.k8sStatus)}</select>`,
    `<span class="small muted">共 ${nodes.length} 个节点</span>`,
    `<span class="top-spacer"></span>${btn("↻ 刷新", "refresh", "sm")}`,
    `</div>`,
    `<div class="card card-pad">${section("GPU 节点 · Nodes")}`,
    `<div class="table-wrap"><table class="dense"><thead><tr>`,
    `<th>节点</th><th>状态</th><th>节点池</th><th>GPU</th><th>分配</th><th>CPU</th><th>内存</th><th>温度</th><th>功耗</th><th>机架</th><th>Pods</th><th>健康</th><th>操作</th>`,
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
        ${btn("详情", "node:" + n.id, "xs")}
        ${n.status === "ready" || n.status === "cordoned" ? btn(n.status === "cordoned" ? "取消封锁" : "封锁", (n.status === "cordoned" ? "node-uncordon:" : "node-cordon:") + n.id, "xs") : ""}
        ${btn("排空", "node-drain:" + n.id, "xs")}
        ${n.straggler ? btn("清标记", "node-clear:" + n.id, "xs") : ""}
        ${n.health !== "Pass" ? btn("修复", "node-restore:" + n.id, "xs") : ""}
      </div></td>
    </tr>`).join(""),
    `</tbody></table></div>`,
    `<div class="callout mt16">cordon 停止新 Pod 调度；drain 驱逐现有 Pod 并触发重调度；Mission Control 对健康检测失败的节点自动进入 Remediation，修复完成后重新加入调度。</div>`,
    `</div>`,
  ].join("");
}

// ============ 资源配额 ============
function quotaTab(quotas) {
  const bar = (used, limit, unit) => {
    const p = Math.min(100, pct(used, limit));
    const color = p >= 92 ? "#d64545" : p >= 75 ? "#e0873a" : "#2f6df6";
    return `<div class="alloc"><div class="alloc-track"><i style="width:${p}%;background:${color}"></i></div><span>${used}/${limit}${unit || ""}</span></div>`;
  };
  return [
    `<div class="card card-pad mb16">${section("命名空间配额 · ResourceQuota", `<span class="small muted">nvidia.com/gpu 为 GPU 核心配额单位</span>`)}`,
    `<div class="table-wrap"><table class="dense"><thead><tr>`,
    `<th>命名空间</th><th>团队</th><th>优先级</th><th>GPU 配额</th><th>CPU（核）</th><th>内存（Gi）</th><th>Pod</th><th>操作</th>`,
    `</tr></thead><tbody>`,
    quotas.map((q) => `<tr>
      <td>${mono(q.ns)}</td>
      <td>${esc(q.team)}</td>
      <td>${q.priority === "Critical" ? `<span class="pill red sm"><i class="dot"></i>Critical</span>` : q.priority === "High" ? `<span class="pill amber sm"><i class="dot"></i>High</span>` : `<span class="pill gray sm"><i class="dot"></i>BestEffort</span>`}</td>
      <td>${bar(q.gpuUsed, q.gpuLimit)}</td>
      <td>${bar(q.cpuUsed, q.cpuLimit)}</td>
      <td>${bar(q.memUsed, q.memLimit)}</td>
      <td>${bar(q.podUsed, q.podLimit)}</td>
      <td>${btn("调整", "quota:" + q.ns, "xs")}</td>
    </tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="grid cols-2">`,
    `<div class="card card-pad">${section("配额分配建议")}`,
    `<div class="callout">Critical 命名空间建议保留 ≥ 20% GPU 余量用于故障转移；BestEffort 队列在集群紧张时优先被抢占，适合开发调试与批量评测。</div>`,
    `<div class="kv dense mt16">`,
    `<div><span>集群 GPU 总量</span><b>150 张</b></div>`,
    `<div><span>已分配配额</span><b>${quotas.reduce((a, q) => a + q.gpuLimit, 0)} 张</b></div>`,
    `<div><span>实际使用</span><b>${quotas.reduce((a, q) => a + q.gpuUsed, 0)} 张</b></div>`,
    `<div><span>配额水位</span><b>${pct(quotas.reduce((a, q) => a + q.gpuUsed, 0), quotas.reduce((a, q) => a + q.gpuLimit, 0))}%</b></div>`,
    `</div></div>`,
    `<div class="card card-pad">${section("抢占与优先级")}`,
    `<div class="table-wrap"><table class="dense"><thead><tr><th>优先级</th><th>抢占策略</th><th>适用场景</th></tr></thead><tbody>`,
    `<tr><td><span class="pill red sm"><i class="dot"></i>Critical</span></td><td>不被抢占</td><td class="small">生产训练 / 在线推理</td></tr>`,
    `<tr><td><span class="pill amber sm"><i class="dot"></i>High</span></td><td>可抢占 BestEffort</td><td class="small">评测 / 数据处理</td></tr>`,
    `<tr><td><span class="pill gray sm"><i class="dot"></i>BestEffort</td><td>优先被抢占</td><td class="small">开发沙箱 / 批处理</td></tr>`,
    `</tbody></table></div></div>`,
    `</div>`,
  ].join("");
}

// ============ 调度队列 ============
function schedulerTab(sch, S) {
  const pend = sch.pending || [];
  return [
    `<div class="grid cols-4 mb16">`,
    metric("待调度任务", pend.length, `申请 ${pend.reduce((a, p) => a + p.gpuCount, 0)} GPU`, "⏳", ""),
    metric("最长等待", pend.length ? Math.max(...pend.map((p) => parseInt(p.age) || 0)) + "m" : "0m", "队首任务", "◷", ""),
    metric("累计调度", sch.scheduled, "本次会话", "✓", ""),
    metric("抢占次数", sch.preempted, "低优先级被抢占", "⇄", ""),
    `</div>`,
    `<div class="card card-pad mb16">${section("调度队列 · Pending", btn("⚡ 触发调度", "k8s-dispatch", "primary"))}`,
    pend.length
      ? `<div class="table-wrap"><table class="dense"><thead><tr><th>任务</th><th>命名空间</th><th>类型</th><th>GPU</th><th>拓扑约束</th><th>优先级</th><th>等待</th><th>阻塞原因</th><th>操作</th></tr></thead><tbody>${pend.map((p) => `<tr>
      <td>${mono(p.name)}</td>
      <td class="small">${mono(p.ns)}</td>
      <td class="small">${esc(p.kind)}</td>
      <td><b>${p.gpuCount}</b> <span class="small muted">${esc(p.gpu)}</span></td>
      <td class="small">${esc(p.topology || "无约束")}${p.gang > 1 ? ` · gang ${p.gang}` : ""}</td>
      <td>${p.priority === "Critical" ? `<span class="pill red sm"><i class="dot"></i>Critical</span>` : `<span class="pill ${p.priority === "High" ? "amber" : "gray"} sm"><i class="dot"></i>${esc(p.priority)}</span>`}</td>
      <td class="small">${esc(p.age)}</td>
      <td class="small warn">${esc(p.reason || "—")}</td>
      <td>${btn("抢占", "pod-preempt:" + p.id, "xs")}${btn("删除", "pod-delete:" + p.id, "xs")}</td>
    </tr>`).join("")}</tbody></table></div>`
      : `<div class="card empty">队列为空，所有任务已调度</div>`,
    `<div class="callout mt16">调度器按「GPU 需求降序 + 拓扑域内收敛 + 温度最低」选择节点；Gang 任务要求同时拿到全部 GPU，否则整体等待，避免部分启动造成的死锁。</div>`,
    `</div>`,
    `<div class="card card-pad">${section("调度策略 · SUNK Topology-Aware")}`,
    `<div class="kv dense">`,
    `<div><span>调度算法</span><b>Gang + 拓扑感知 + 反碎片</b></div>`,
    `<div><span>NVLink 域优先</span><b>启用</b></div>`,
    `<div><span>反碎片整理</span><b>运行中动态收敛</b></div>`,
    `<div><span>抢占</span><b>仅 BestEffort / High 可被抢占</b></div>`,
    `<div><span>训练 / 推理混部</span><b>启用（高峰互借 GPU）</b></div>`,
    `</div></div>`,
  ].join("");
}

// ============ 工作负载 ============
function workloadsTab(pods, ns, S) {
  const list = S.k8sNs && S.k8sNs !== "all" ? pods.filter((p) => p.ns === S.k8sNs) : pods;
  return [
    `<div class="card filterbar mb16">`,
    `<select data-set="k8sNs">${opt([["all", "全部命名空间"], ...ns.map((n) => [n, n])], S.k8sNs)}</select>`,
    `<select data-set="k8sPhase">${opt([["all", "全部状态"], ["running", "Running"], ["pending", "Pending"], ["failed", "Failed"], ["succeeded", "Succeeded"]], S.k8sPhase)}</select>`,
    `<span class="small muted">共 ${list.length} 个工作负载</span>`,
    `</div>`,
    `<div class="card card-pad">${section("工作负载 · Pods / Jobs / Deployments")}`,
    `<div class="table-wrap"><table class="dense"><thead><tr>`,
    `<th>名称</th><th>命名空间</th><th>类型</th><th>阶段</th><th>GPU</th><th>节点</th><th>利用率</th><th>重启</th><th>运行时长</th><th>负责人</th><th>说明</th><th>操作</th>`,
    `</tr></thead><tbody>`,
    list.map((p) => `<tr>
      <td>${mono(p.name)}</td>
      <td class="small">${mono(p.ns)}</td>
      <td class="small">${esc(p.kind)}</td>
      <td>${phase(p.phase)}</td>
      <td><b>${p.gpuCount}</b> <span class="small muted">${esc(p.gpu)}</span></td>
      <td class="small">${p.node ? mono(p.node) : `<span class="muted">未分配</span>`}</td>
      <td>${p.gpuUtil > 0 ? allocBar(Math.round(p.gpuUtil / 10), 10) : `<span class="muted">—</span>`}</td>
      <td>${p.restarts}</td>
      <td class="small">${esc(p.age)}</td>
      <td class="small">${esc(p.owner)}</td>
      <td class="small muted">${esc(p.reason || p.note || "—")}</td>
      <td><div class="table-actions">
        ${btn("详情", "pod:" + p.id, "xs")}
        ${p.phase === "running" ? btn("重启", "pod-restart:" + p.id, "xs") : ""}
        ${btn("删除", "pod-delete:" + p.id, "xs")}
      </div></td>
    </tr>`).join(""),
    `</tbody></table></div></div>`,
  ].join("");
}

export default async function kubernetesPage(S) {
  const t = S.k8sTab;
  const sum = await api.k8sSummary();
  const m = await api.k8sMetrics(t === "scheduler" ? "scheduler" : "gpu", S.k8sRange);
  S.k8sMetrics = m;
  S.k8sSummary = sum;

  let body = "";
  if (t === "nodes") {
    const r = await api.k8sNodes(S.k8sPool, S.k8sStatus);
    S.k8sNodes = r.nodes;
    body = nodesTab(r.nodes, r.pools, S);
  } else if (t === "quotas") {
    const r = await api.k8sQuotas();
    body = quotaTab(r.quotas);
  } else if (t === "scheduler") {
    const r = await api.k8sScheduler();
    body = schedulerTab(r, S);
  } else if (t === "workloads") {
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
      "GPU 集群 · Kubernetes",
      `${esc(sum.cluster.name)} · ${esc(sum.cluster.version)} · ${esc(sum.cluster.scheduler)} — 节点、配额、调度与机架级可观测性。`,
      btn("⚡ 触发调度", "k8s-dispatch", "primary") + btn("↻ 刷新", "refresh", "sm")
    ),
    tabs([["overview", "集群概览"], ["nodes", "GPU 节点"], ["quotas", "资源配额"], ["scheduler", "调度队列"], ["workloads", "工作负载"]], t, "k8sTab"),
    `<div class="card filterbar mb16">`,
    `<span class="mono small">${esc(sum.cluster.name)}</span>`,
    `<span class="pill blue sm"><i class="dot"></i>${sum.cluster.readyNodes}/${sum.cluster.totalNodes} Ready</span>`,
    `<span class="small muted">GPU ${sum.cluster.allocatedGpus}/${sum.cluster.totalGpus} · 可调度 ${sum.cluster.schedulableGpus} · 待调度 ${sum.pendingCount}</span>`,
    `<span class="top-spacer"></span>`,
    `<select data-set="k8sRange">${opt([["1h", "1 小时"], ["24h", "24 小时"], ["7d", "7 天"]], S.k8sRange)}</select>`,
    `</div>`,
    body,
    `<div class="card card-pad mt16">${section("集群事件 · kubectl get events")}`,
    `<div class="table-wrap"><table class="dense"><thead><tr><th>类型</th><th>Reason</th><th>对象</th><th>消息</th><th>次数</th><th>最近</th></tr></thead><tbody>`,
    ev.events.map((e) => `<tr><td>${e.type === "Warning" ? `<span class="pill amber sm"><i class="dot"></i>Warning</span>` : `<span class="pill green sm"><i class="dot"></i>Normal</span>`}</td><td class="small">${esc(e.reason)}</td><td class="small">${mono(e.object)}</td><td>${esc(e.message)}</td><td>${e.count}</td><td class="small">${esc(e.lastSeen)}</td></tr>`).join(""),
    `</tbody></table></div></div>`,
  ].join("");
}

// 供 app.js 调用的交互处理
export function nodeDetail(node, pods) {
  modal(
    "节点详情 · " + node.id,
    `<div class="kv dense">
      <div><span>状态</span><b>${nodeStatus(node.status)}</b></div>
      <div><span>节点池</span><b>${mono(node.poolName)}</b></div>
      <div><span>GPU</span><b>${esc(node.gpu)} × ${node.gpus}（${node.vramPerGpu}GB/卡）</b></div>
      <div><span>GPU 分配</span><b>${node.allocated} / ${node.gpus}</b></div>
      <div><span>CPU / 内存</span><b>${node.cpuUsed}/${node.cpu} 核 · ${node.ramUsed}/${node.ram} Gi</b></div>
      <div><span>NVLink 域</span><b>${mono(node.domain)}</b></div>
      <div><span>机架 / 机柜</span><b>${mono(node.rack)} / ${mono(node.cabinet)}</b></div>
      <div><span>温度 / 功耗</span><b>${node.temp}℃ · ${node.power}W</b></div>
      <div><span>健康</span><b>${esc(node.health)}${node.straggler ? " · straggler" : ""}</b></div>
      <div><span>Taints</span><b>${node.taints.length ? mono(node.taints.join(", ")) : "无"}</b></div>
      <div><span>运行时长</span><b>${esc(node.uptime)} · 最近检查 ${esc(node.lastCheck)}</b></div>
    </div>
    <div class="mt16">${section("节点上的 Pod（" + pods.length + "）")}</div>
    ${pods.length ? `<div class="table-wrap"><table class="dense"><thead><tr><th>Pod</th><th>阶段</th><th>GPU</th><th>利用率</th></tr></thead><tbody>${pods.map((p) => `<tr><td>${mono(p.name)}</td><td>${phase(p.phase)}</td><td>${p.gpuCount}</td><td>${p.gpuUtil}%</td></tr>`).join("")}</tbody></table></div>` : `<div class="small muted">该节点当前没有 Pod</div>`}`,
    btn("封闭节点", "node-cordon:" + node.id, "sm") + btn("排空", "node-drain:" + node.id, "sm") + btn("关闭", "close-modal")
  );
}

export function podDetail(pod) {
  modal(
    "工作负载详情 · " + pod.name,
    `<div class="kv dense">
      <div><span>命名空间</span><b>${mono(pod.ns)}</b></div>
      <div><span>类型</span><b>${esc(pod.kind)}</b></div>
      <div><span>阶段</span><b>${phase(pod.phase)}</b></div>
      <div><span>GPU 申请</span><b>${pod.gpuCount} × ${esc(pod.gpu)}（nvidia.com/gpu: ${pod.gpuCount}）</b></div>
      <div><span>调度节点</span><b>${pod.node ? mono(pod.node) : "未分配"}</b></div>
      <div><span>拓扑约束</span><b>${esc(pod.topology || "无约束")}</b></div>
      <div><span>优先级</span><b>${esc(pod.priority)}</b></div>
      <div><span>镜像</span><b>${mono(pod.image)}</b></div>
      <div><span>重启次数</span><b>${pod.restarts}</b></div>
      <div><span>负责人</span><b>${esc(pod.owner)}</b></div>
    </div>
    ${pod.reason ? `<div class="callout warn mt16">${esc(pod.reason)}</div>` : ""}
    <div class="callout mt16">YAML 片段：<div class="code mt12">resources:\n  limits:\n    nvidia.com/gpu: ${pod.gpuCount}</div></div>`,
    btn("重启", "pod-restart:" + pod.id, "sm") + btn("删除", "pod-delete:" + pod.id, "sm danger") + btn("关闭", "close-modal")
  );
}

export function quotaModal(q) {
  modal(
    "调整配额 · " + q.ns,
    `<p class="small muted mb16">团队：${esc(q.team)} · 优先级 ${esc(q.priority)}。调整后立即对调度器生效。</p>
     <div class="form-grid">
       <div class="field"><label>GPU 上限（nvidia.com/gpu）</label><input id="q-gpu" type="number" value="${q.gpuLimit}" data-set="quotaGpu"></div>
       <div class="field"><label>CPU 上限（核）</label><input id="q-cpu" type="number" value="${q.cpuLimit}" data-set="quotaCpu"></div>
       <div class="field"><label>内存上限（Gi）</label><input id="q-mem" type="number" value="${q.memLimit}" data-set="quotaMem"></div>
       <div class="field"><label>Pod 上限</label><input id="q-pod" type="number" value="${q.podLimit}" data-set="quotaPod"></div>
     </div>
     <div class="small muted mt12">当前使用：GPU ${q.gpuUsed} · CPU ${q.cpuUsed} · 内存 ${q.memUsed}Gi · Pod ${q.podUsed}</div>`,
    btn("取消", "close-modal") + btn("保存 GPU 配额", "quota-save:" + q.ns, "primary")
  );
}
