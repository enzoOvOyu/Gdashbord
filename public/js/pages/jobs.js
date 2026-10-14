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
  const totalThroughput = running.reduce((a, j) => a + (j.throughput || 0), 0);

  return [
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric("job.kpi.running", running.length, B(gpuNow.toLocaleString() + " GPU 调度中", gpuNow.toLocaleString() + " GPUs scheduled"), "<i class='bi bi-play-circle'></i>", "", "hero"),
    metric("job.kpi.queued", res.queued || 0, "job.kpi.queued.desc", "<i class='bi bi-clock-history'></i>", ""),
    metric("job.kpi.goodput", avgGoodput + "%", "job.kpi.goodput.desc", "<i class='bi bi-speedometer2'></i>", "↗ 1.8%"),
    metric(B("运行成本", "Run cost"), moneyShort(spend), money(hourly) + " / " + t("common.perHour"), "<i class='bi bi-cash-stack'></i>", ""),
    `</div>`,
    `<div class="layout-wide-side">`,
    `<div class="card"><div class="table-wrap"><table><thead><tr>
      <th>${esc(t("job.th.name"))}</th><th>${esc(t("job.th.resource"))}</th><th>${esc(t("job.th.nodes"))}</th><th>${esc(t("common.region"))}</th>
      <th>${esc(B("吞吐", "Throughput"))}</th><th>${esc(B("Checkpoint", "Checkpoint"))}</th><th>${esc(B("ETA", "ETA"))}</th>
      <th>${esc(t("common.status"))}</th><th>${esc(t("job.th.progress"))}</th><th>${esc(B("租户", "Tenant"))}</th><th>${esc(t("job.th.cost"))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>`,
    jobs.map((j) => `<tr>
      <td><a href="javascript:void(0)" data-act="job:${j.id}"><strong>${esc(j.name)}</strong></a><small>${esc(L(j.type))} · ${esc(j.id)} · ${esc(L(j.priority || B("普通", "Normal")))}</small></td>
      <td>${esc(j.gpu)} × ${j.count}<small>${esc(j.template || "")}</small></td>
      <td>${j.nodes || 1}</td>
      <td>${esc(j.region)}</td>
      <td>${j.throughput ? (j.throughput >= 1000 ? (j.throughput / 1000).toFixed(1) + "K tok/s" : j.throughput + " tok/s") : "—"}</td>
      <td><small>${esc(L(j.checkpoint || B("—", "—")))}</small></td>
      <td>${j.status === "running" ? `<small>${esc(L(j.eta || B("—", "—")))}</small>` : "—"}</td>
      <td>${status(j.status)}</td>
      <td style="min-width:120px">${BAR(j.progress || 0)}<small>${j.progress || 0}%</small></td>
      <td><small>${esc(j.tenant || "—")}</small></td>
      <td>${money(j.cost || 0)}<small>${money(gpu(j.gpu).price * Number(j.count || 0))}/h</small></td>
      <td><div class="table-actions">${btn("job.btn.detail", "job:" + j.id, "sm")}${btn("job.btn.logs", "job-logs:" + j.id, "sm")}${btn("job.btn.retry", "retry-job:" + j.id, "sm")}</div></td></tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="card card-pad">${section("job.chain.title")}<div class="grid" style="gap:9px">`,
    [["1", "job.chain.1", "job.chain.1.d"], ["2", "job.chain.2", "job.chain.2.d"], ["3", "job.chain.3", "job.chain.3.d"], ["4", "job.chain.4", "job.chain.4.d"], ["5", "job.chain.5", "job.chain.5.d"]]
      .map((x) => `<div class="chain-step"><span class="step-num">${x[0]}</span><div><b>${esc(t(x[1]))}</b><div class="small muted" style="margin-top:3px">${esc(t(x[2]))}</div></div></div>`).join(""),
    `</div><div class="callout mt16">${esc(t("job.chain.tip"))}</div></div></div>`,
  ].join("");
}

// 集群机队：万卡级表格视图（103 集群）+ 顶部汇总 KPI
function clustersView(S, clusters) {
  const totalGpus = clusters.reduce((a, c) => a + Number(c.count || 0), 0);
  const onlineGpus = clusters.filter((c) => c.status === "running" || c.status === "degraded").reduce((a, c) => a + Number(c.count || 0), 0);
  const util = totalGpus ? Math.round(clusters.reduce((a, c) => a + (c.status === "running" ? c.count * c.util : 0), 0) / totalGpus) : 0;
  const totalPower = clusters.reduce((a, c) => a + Number(c.powerKw || 0), 0);
  const totalJobs = clusters.reduce((a, c) => a + Number(c.jobs || 0), 0);
  const schedulers = {};
  clusters.forEach((c) => { schedulers[c.scheduler] = (schedulers[c.scheduler] || 0) + 1; });

  const rows = clusters.map((c) => {
    const nh = c.nodeHealth || {};
    const health = c.status === "running"
      ? `<span class="pill green"><i class="dot"></i>${esc(B("健康", "Healthy"))} ${nh.healthy ?? c.nodes}/${c.nodes}</span>`
      : c.status === "degraded"
      ? `<span class="pill amber"><i class="dot"></i>${esc(B("告警", "Warn"))} ${nh.warn || 1}${nh.fault ? " · " + esc(B("故障", "fault")) + " " + nh.fault : ""}</span>`
      : status(c.status);
    return `<tr>
      <td><a href="javascript:void(0)" data-act="cluster-detail:${c.id}"><strong>${esc(c.name)}</strong></a><small>${esc(c.id)} · ${esc(c.tenantName || c.tenant || "—")}</small></td>
      <td>${esc(c.gpu)}</td>
      <td>${c.nodes}<small>${esc(String(c.gpusPerNode))} GPU/节点</small></td>
      <td><b>${c.count.toLocaleString()}</b></td>
      <td>${esc(c.scheduler)}</td>
      <td><small>${esc(c.network)}</small></td>
      <td>${esc(c.region)}<small>${esc(c.zone || "")}</small></td>
      <td>${c.util || 0}%${BAR(c.util || 0)}</td>
      <td>${health}</td>
      <td>${esc(c.billing === "reserved" ? t("common.reserved") : c.billing === "spot" ? t("common.spot") : t("common.onDemand"))}</td>
      <td>${money(c.priceEff || c.price || 0)}<small>${money(c.price || 0)}/h ${esc(B("目录价", "list"))}</small></td>
      <td>${c.powerKw || 0} kW<small>${c.tempC || "—"}°C</small></td>
      <td>${c.jobs || 0}</td>
      <td><div class="table-actions">${btn("job.cl.topology", "cluster:" + c.id, "sm")}${btn("job.cl.detail", "cluster-detail:" + c.id, "sm ghost")}</div></td>
    </tr>`;
  }).join("");

  return [
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric("job.cl.kpi.count", clusters.length, B("Slurm " + (schedulers.Slurm || 0) + " · K8s " + (schedulers.Kubernetes || 0), "Slurm " + (schedulers.Slurm || 0) + " · K8s " + (schedulers.Kubernetes || 0)), "<i class='bi bi-hdd-rack'></i>", ""),
    metric("job.cl.kpi.gpus", totalGpus.toLocaleString(), B("在线 " + onlineGpus.toLocaleString() + " · 利用率 " + util + "%", "Online " + onlineGpus.toLocaleString() + " · " + util + "%"), "<i class='bi bi-cpu'></i>", "", "hero"),
    metric(B("总功耗", "Total power"), Math.round(totalPower).toLocaleString() + " kW", B("运行中作业 " + totalJobs + " · 碳排按区域因子", totalJobs + " active jobs · regional carbon factors"), "<i class='bi bi-lightning-charge'></i>", ""),
    metric(B("NVL72 机架", "NVL72 racks"), clusters.filter((c) => c.topo === "NVL72").length, B("GB300 机架级 NVLink 域", "GB300 rack-scale NVLink domains"), "<i class='bi bi-diagram-3'></i>", ""),
    `</div>`,
    `<div class="card card-pad">${section("job.tab.clusters" + " · " + clusters.length, `<span class="small muted">${esc(B("点击行内操作查看拓扑与详情", "Click row actions for topology & details"))}</span>`)}`,
    `<div class="table-wrap"><table><thead><tr>
      <th>${esc(B("集群", "Cluster"))} / ${esc(B("租户", "Tenant"))}</th>
      <th>GPU</th><th>${esc(t("job.th.nodes"))}</th><th>${esc(B("卡数", "GPUs"))}</th>
      <th>${esc(B("调度器", "Scheduler"))}</th><th>${esc(B("互联", "Fabric"))}</th>
      <th>${esc(t("common.region"))}</th><th>${esc(B("利用率", "Util"))}</th>
      <th>${esc(B("节点健康", "Node health"))}</th><th>${esc(B("计费", "Billing"))}</th>
      <th>${esc(B("有效时价", "Effective $/h"))}</th><th>${esc(B("功耗", "Power"))}</th>
      <th>${esc(B("作业", "Jobs"))}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`,
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
      <td>${esc(s.gpu)} × ${s.gpusPerNode} · ${s.cpu} vCPU · ${s.ram} GB · ${esc(L(s.storage))}</td>
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
