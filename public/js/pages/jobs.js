// 训练中心（万卡级）：作业队列 + 集群机队 + 集群规格
// 作业含进度 / ETA / 吞吐 / checkpoint / goodput / 租户；集群含调度器 / 网络 / NVL72 拓扑 / 节点健康 / 电力
import { api } from "../api.js";
import { header, metric, section, btn, esc, status, tabs, money, moneyShort, gpu, t, L } from "../ui.js";

const B = (zh, en) => ({ zh, en });
const BAR = (pct, color) => `<div class="progress"><span style="width:${Math.min(100, Math.max(2, Math.round(pct)))}%;${color ? "background:" + color : ""}"></span></div>`;

function jobsView(S, res) {
  const jobs = res.jobs || [];
  const running = jobs.filter((j) => j.status === "running");
  const gpuNow = running.reduce((a, j) => a + Number(j.count || 0), 0);
  const avgGoodput = running.length ? Math.round(running.reduce((a, j) => a + (j.goodput || 0), 0) / running.length) : 0;
  const spend = jobs.reduce((a, j) => a + Number(j.cost || 0), 0);
  const hourly = running.reduce((a, j) => a + gpu(j.gpu).price * Number(j.count || 0), 0);

  // Instant Clusters 式任务卡：拓扑小图（节点方块）+ 3 列规格 + 指标条 + 操作排
  const jobCard = (j) => {
    const isActive = j.status === "running";
    const nodes = Math.min(Number(j.nodes) || 1, 6);
    const nodeIcons = Array.from({ length: nodes }, (_, i) =>
      `${i ? '<span class="cluster-connector"></span>' : ""}<span class="cluster-node"><i class="bi bi-hdd-network"></i></span>`).join("");
    const ckpt = j.checkpoint ? L(j.checkpoint) : "—";
    const eta = j.status === "running" && j.eta ? L(j.eta) : "—";
    return `
    <div class="card job-card">
      <div class="cluster-top">
        <div>
          <div class="row gap8"><strong style="font-size:14px">${esc(j.name)}</strong>${status(j.status)}</div>
          <div class="pod-id mono spec-ellipsis" style="margin-top:8px" title="${esc(j.id)} · ${esc(L(j.type))} · ${esc(j.template || "PyTorch")} · ${esc(L(j.priority || B("普通", "Normal")))}">${esc(j.id)} · ${esc(L(j.type))} · ${esc(j.template || "PyTorch")}</div>
        </div>
        <div class="pod-gpu">
          <div class="pod-gpu-name">${esc(j.gpu)} × ${Number(j.count || 0).toLocaleString()}</div>
          <div class="pod-price">${money(gpu(j.gpu).price * Number(j.count || 0))}/hr${esc(j.region ? " · " + j.region : "")}</div>
        </div>
      </div>
      <div class="cluster-graphic">${nodeIcons}${Number(j.nodes) > 6 ? `<span class="tiny-text" style="margin-left:6px">+${j.nodes - 6}</span>` : ""}</div>
      <div class="cluster-spec">
        <div><small>GPUS</small><strong>${Number(j.count || 0).toLocaleString()}</strong></div>
        <div><small>NODES</small><strong>${j.nodes || 1} × ${esc(j.gpu)}</strong></div>
        <div><small>TENANT</small><strong class="spec-ellipsis" title="${esc(j.tenant || "—")}">${esc(j.tenant || "—")}</strong></div>
      </div>
      <div class="pod-middle pod-middle-2col">
        <div><div class="metric-name"><span>Progress</span><b>${j.progress || 0}%</b></div><div class="progress"><span style="width:${j.progress || 0}%"></span></div></div>
        <div><div class="metric-name"><span>Goodput</span><b>${j.goodput || 0}%</b></div><div class="progress green"><span style="width:${j.goodput || 0}%"></span></div></div>
        <div><div class="metric-name"><span>Checkpoint</span><b class="spec-ellipsis" title="${esc(ckpt)}">${esc(ckpt)}</b></div><div class="progress"><span style="width:${j.progress || 0}%;background:#f9a825"></span></div></div>
        <div><div class="metric-name"><span>ETA</span><b>${esc(eta)}</b></div><div class="progress${isActive ? "" : " orange"}"><span style="width:${isActive ? Math.min(100, (j.progress || 0)) : 100}%"></span></div></div>
      </div>
      <div class="pod-footer">
        <span class="tiny-text">${esc(L(j.duration || B("—", "—")))} · ${money(j.cost || 0)} ${esc(B("累计", "spent"))}</span>
        <div class="row gap8">
          ${btn("job.btn.detail", "job:" + j.id, "sm")}
          ${btn("job.btn.logs", "job-logs:" + j.id, "sm")}
          ${j.status === "failed" ? btn("job.btn.retry", "retry-job:" + j.id, "sm primary") : ""}
        </div>
      </div>
    </div>`;
  };

  return [
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric("job.kpi.running", running.length, B(gpuNow.toLocaleString() + " GPU 调度中", gpuNow.toLocaleString() + " GPUs scheduled"), "<i class='bi bi-play-circle'></i>", "", "hero"),
    metric("job.kpi.queued", jobs.filter((x) => x.status === "queued").length, "job.kpi.queued.desc", "<i class='bi bi-clock-history'></i>", "", ""),
    metric("job.kpi.goodput", avgGoodput + "%", "job.kpi.goodput.desc", "<i class='bi bi-speedometer2'></i>", "↗ 1.8%", ""),
    metric(B("运行成本", "Run cost"), moneyShort(spend), money(hourly) + " / " + t("common.perHour"), "<i class='bi bi-cash-stack'></i>", "", ""),
    `</div>`,

    // 任务运行链路（横向流程）
    `<div class="notice mb16"><i class="bi bi-info-circle"></i> ${esc(t("job.chain.tip"))}</div>`,

    // 任务卡片流（双列）
    `<div class="cluster-grid">${jobs.map(jobCard).join("")}</div>`,
  ].join("");
}

// 集群机队：Instant Clusters 式集群卡网格（拓扑图形 + 3 列规格 + 可展开 Pod 列表）
function clustersView(S, clusters) {
  const totalGpus = clusters.reduce((a, c) => a + Number(c.count || 0), 0);
  const onlineGpus = clusters.filter((c) => c.status === "running" || c.status === "degraded").reduce((a, c) => a + Number(c.count || 0), 0);
  const util = totalGpus ? Math.round(clusters.reduce((a, c) => a + (c.status === "running" ? c.count * (c.liveUtil ?? c.util) : 0), 0) / totalGpus) : 0;
  const totalPower = clusters.reduce((a, c) => a + Number(c.powerKw || 0), 0);
  const totalJobs = clusters.reduce((a, c) => a + Number(c.jobs || 0), 0);
  const running = clusters.filter((c) => c.status === "running").length;
  const openId = S.clusterOpen || "";
  // 展开某集群时展示其节点（Pod）列表
  const clusterNodes = (c) => Array.from({ length: Math.min(Number(c.nodes) || 1, 8) }, (_, i) => `
    <div class="cluster-pod-row">
      <span class="endpoint-icon sm"><i class="bi bi-hdd-network"></i></span>
      <div style="flex:1"><b>${esc(c.name)}-pod-${i}</b><small>${esc(c.gpu)} × ${c.gpusPerNode} · ${esc(c.cpuPerNode || "—")} vCPU · ${esc(c.ramPerNode || "—")} GB · rank ${i}${i === 0 ? " (primary)" : ""}</small></div>
      <span class="pill ${i === 0 ? "green" : c.status === "running" ? "green" : "gray"} sm"><i class="dot"></i>${i === 0 ? esc(L(B("主节点", "primary"))) : esc(L(B("就绪", "ready")))}</span>
    </div>`).join("") + (Number(c.nodes) > 8 ? `<div class="small muted" style="padding:8px 0 2px 42px">… ${c.nodes - 8} ${esc(L(B("更多节点", "more nodes")))}</div>` : "");

  const clusterCards = clusters.map((c) => {
    const nh = c.nodeHealth || {};
    const isOpen = openId === c.id;
    const nodeIcons = Array.from({ length: Math.min(Number(c.nodes) || 1, 6) }, (_, i) =>
      `${i ? '<span class="cluster-connector"></span>' : ""}<span class="cluster-node"><i class="bi bi-hdd-network"></i></span>`).join("");
    return `
    <div class="card cluster-card">
      <div class="cluster-top">
        <div>
          <div class="row gap8"><strong style="font-size:14px">${esc(c.name)}</strong>${status(c.status)}</div>
          <div class="pod-id mono spec-ellipsis" style="margin-top:8px" title="${esc(c.id)} · ${esc(c.scheduler)} · ${esc(c.tenantName || c.tenant || "—")}">${esc(c.id)} · ${esc(c.scheduler)} · ${esc(c.tenantName || c.tenant || "—")}</div>
        </div>
        <button class="icon-btn" data-act="${isOpen ? "cluster-close" : "cluster-open:" + c.id}"><i class="bi bi-${isOpen ? "chevron-up" : "three-dots"}"></i></button>
      </div>
      <div class="cluster-graphic">${nodeIcons}</div>
      <div class="cluster-spec">
        <div><small>GPU COMPUTE</small><strong>${Number(c.count || 0).toLocaleString()} × ${esc(c.gpu)}</strong></div>
        <div><small>NETWORK</small><strong class="spec-ellipsis" title="${esc(c.network)}">${esc(c.network)}</strong></div>
        <div><small>REGION</small><strong>${esc(c.region)}</strong></div>
      </div>
      <div class="pod-middle">
        <div><div class="metric-name"><span>Utilization</span><b>${c.liveUtil ?? c.util ?? 0}%</b></div><div class="progress"><span style="width:${c.liveUtil ?? c.util ?? 0}%"></span></div></div>
        <div><div class="metric-name"><span>Nodes</span><b>${nh.healthy ?? c.nodes}/${c.nodes}</b></div><div class="progress green"><span style="width:${Math.round(((nh.healthy ?? c.nodes) / Math.max(1, c.nodes)) * 100)}%"></span></div></div>
        <div><div class="metric-name"><span>Power</span><b>${Math.round(c.powerKw || 0).toLocaleString()} kW</b></div><div class="progress"><span style="width:${Math.min(100, Math.round(((c.powerKw || 0) / Math.max(1, c.count)) / 14 * 100))}%"></span></div></div>
        <div><div class="metric-name"><span>Temp</span><b>${c.tempC || "—"}°C</b></div><div class="progress${(c.tempC || 0) > 55 ? " orange" : ""}"><span style="width:${Math.min(100, Math.max(2, ((c.tempC || 30) - 20) * 1.6))}%"></span></div></div>
      </div>
      <div class="pod-footer">
        <span class="tiny-text spec-ellipsis">${esc(L(B("上线", "Up")))} ${c.uptimeDays || "—"}${esc(L(B("天", "d")))} · ${c.jobs || 0} ${esc(L(B("个作业", "jobs")))} · ${money(c.priceEff || c.price || 0)}/hr</span>
        <div class="row gap8">
          ${btn(esc(L(B("查看详情", "View details"))), "cluster-detail:" + c.id, "sm")}
          ${btn(esc(L(B("拓扑", "Topology"))), "cluster:" + c.id, "sm ghost")}
        </div>
      </div>
      ${isOpen ? `<div class="cluster-expand"><div class="subhead" style="margin:6px 0 10px">PODS · ${c.nodes} ${esc(t("job.cl.nodes"))}</div>${clusterNodes(c)}
        <div class="callout mt12">${esc(L(B("分布式环境变量自动注入：MASTER_ADDR / NUM_NODES / NUM_TRAINERS / NODE_RANK / WORLD_SIZE；NCCL_SOCKET_IFNAME=ens1-8 高速内网互联。", "Distributed env auto-injected: MASTER_ADDR / NUM_NODES / NUM_TRAINERS / NODE_RANK / WORLD_SIZE; NCCL over high-speed ens1-ens8 interfaces.")))}</div></div>` : ""}
    </div>`;
  }).join("");

  return [
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric(B("训练集群", "Clusters"), clusters.length, B(`运行中 ${running} · Slurm/K8s 混合调度`, `Running ${running} · Slurm/K8s mixed scheduling`), "<i class='bi bi-hdd-rack'></i>", "", "hero"),
    metric(B("机队 GPU", "Fleet GPUs"), totalGpus.toLocaleString(), B(`在线 ${onlineGpus.toLocaleString()} · 利用率 ${util}%`, `Online ${onlineGpus.toLocaleString()} · ${util}% utilized`), "<i class='bi bi-cpu'></i>", "", ""),
    metric(B("总功耗", "Total power"), Math.round(totalPower).toLocaleString() + " kW", B(`运行中作业 ${totalJobs} · 碳排按区域因子`, `${totalJobs} active jobs · regional carbon factors`), "<i class='bi bi-lightning-charge'></i>", "", ""),
    metric(B("NVL72 GPUs", "NVL72 GPUs"), clusters.filter((c) => c.topo === "NVL72").reduce((a, c) => a + Number(c.count || 0), 0).toLocaleString(), B(`GB300 机架级 NVLink · 800–3200 Gbps · ${clusters.filter((c) => c.topo === "NVL72").length} ${L(B("机架", "racks"))}`, `GB300 rack-scale NVLink · 800–3200 Gbps · ${clusters.filter((c) => c.topo === "NVL72").length} racks`), "<i class='bi bi-diagram-3'></i>", "", ""),
    `</div>`,

    `<div class="notice mb16"><i class="bi bi-info-circle"></i> ${esc(L(B(
      "Instant Clusters：多机多卡训练集群，适用于分布式 PyTorch 与 Slurm 工作负载。点击集群卡片右上角展开 Pod 列表。",
      "Instant Clusters: multi-node GPU clusters for distributed PyTorch and Slurm workloads. Click the cluster's top-right icon to expand its pod list."
    )))}</div>`,

    `<div class="cluster-grid">${clusterCards}</div>`,

    // 参考架构条（素材包 Distributed training reference architecture）
    `<div class="card card-pad mt16"><div class="section-head"><div><div class="card-title">${esc(L(B("分布式训练参考架构", "Distributed training reference architecture")))}</div><div class="card-sub">${esc(L(B("示意：数据 → 调度 → GPU 集群 → Checkpoints", "Data → Scheduler → GPU cluster → Checkpoints")))}</div></div></div>
    <div class="grid cols-4">
      ${[["database", B("数据集与存储", "Dataset & storage"), B("共享训练数据与模型权重", "Shared training data & weights")],
         ["layers", B("调度器", "Scheduler"), B("Slurm / PyTorch distributed", "Slurm / PyTorch distributed")],
         ["cpu", B("GPU 节点", "GPU nodes"), B("高速互联多机多卡计算", "Multi-node compute, high-speed fabric")],
         ["device-hdd", B("Checkpoints", "Checkpoints"), B("持久化保存训练状态", "Persist training state")]]
        .map((x, i) => `<div class="quick-action" style="cursor:default"><span class="quick-icon"><i class="bi bi-${x[0]}"></i></span><span><strong>${esc(L(x[1]))}</strong><small>${esc(L(x[2]))}</small></span>${i < 3 ? '<i class="bi bi-arrow-right"></i>' : ""}</div>`).join("")}
    </div></div>`,
  ].join("");
}

function catalogView(S) {
  const skus = window.__CLUSTER_SKUS || [];
  return [
    `<div class="card card-pad">${section("job.catalog.title")}<div class="callout mb16">${esc(t("job.catalog.sub"))}</div>`,
    `<div class="table-wrap"><table><thead><tr>
      <th>${esc(t("job.catalog.th.spec"))}</th><th>${esc(t("job.catalog.th.node"))}</th><th>${esc(t("job.catalog.th.gpu"))}</th>
      <th>${esc(t("job.catalog.th.net"))}</th><th>${esc(t("job.catalog.th.price"))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>`,
    skus.map((s) => `<tr>
      <td><strong>${esc(L(s.name))}</strong><small>${esc(s.id)}</small></td>
      <td style="white-space:normal;min-width:220px">${esc(s.gpu)} × ${s.gpusPerNode} · ${s.cpu} vCPU · ${s.ram} GB · ${esc(L(s.storage))}</td>
      <td>${s.totalGpus}</td>
      <td>${esc(L(s.network))}</td>
      <td><b>${money(s.price)}</b><small>${money(s.price / s.totalGpus)} / ${esc(t("common.perGpuHour"))}</small></td>
      <td>${btn("job.catalog.cta", "create-sku:" + s.id, "sm primary")}</td></tr>`).join(""),
    `</tbody></table></div></div>`,
  ].join("");
}

export default async function jobsPage(S) {
  const res = await api.jobs();
  const clusters = res.clusters || [];

  return [
    header("job.title", "job.sub", btn("job.cta.job", "create-job", "primary") + btn("job.cta.cluster", "create-cluster")),
    tabs([["jobs", "job.tab.jobs"], ["clusters", "job.tab.clusters"], ["catalog", "job.tab.catalog"]], S.jobTab, "jobTab"),
    S.jobTab === "jobs" ? jobsView(S, res) : S.jobTab === "clusters" ? clustersView(S, clusters) : catalogView(S),
  ].join("");
}
