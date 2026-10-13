// 训练任务与集群：参照 CoreWeave / Lambda 的信息层级（作业配置、资源规格、价格、运行状态）
import { api } from "../api.js";
import { header, metric, section, btn, esc, status, tabs, money, gpu, t, L } from "../ui.js";

const roleIcon = (p) => (p === "Critical" ? "<i class='bi bi-exclamation-octagon'></i>" : p === "High" ? "<i class='bi bi-arrow-up-circle'></i>" : "<i class='bi bi-dash-circle'></i>");

function jobsView(S, res) {
  const jobs = res.jobs || [];
  const running = jobs.filter((j) => j.status === "running");
  const gpuHours = running.reduce((a, j) => a + Number(j.count) * Number(j.nodes || 1), 0);
  const avgGoodput = running.length ? Math.round(running.reduce((a, j) => a + (j.goodput || 0), 0) / running.length) : 0;
  const spend = jobs.reduce((a, j) => a + Number(j.cost || 0), 0);
  const hourly = running.reduce((a, j) => a + gpu(j.gpu).price * Number(j.count) * Number(j.nodes || 1), 0);

  return [
    `<div class="grid cols-3 mb16 kpi-row">`,
    metric("job.kpi.running", running.length, "job.kpi.running.desc", "<i class='bi bi-play-circle'></i>", "", "hero"),
    metric("job.kpi.queued", res.queued || 0, "job.kpi.queued.desc", "<i class='bi bi-clock-history'></i>", ""),
    metric("job.kpi.success", "96.8%", "job.kpi.success.desc", "<i class='bi bi-check2-circle'></i>", "↗ 2.4%"),
    `</div>`,
    `<div class="grid cols-3 mb16 kpi-row">`,
    metric("job.kpi.goodput", avgGoodput + "%", "job.kpi.goodput.desc", "<i class='bi bi-speedometer2'></i>", ""),
    metric("job.kpi.gpuhours", gpuHours + " × h", "job.kpi.gpuhours.desc", "<i class='bi bi-cpu'></i>", ""),
    metric("job.kpi.spend", money(spend), money(hourly) + " " + t("common.perHour"), "<i class='bi bi-cash-stack'></i>", ""),
    `</div>`,
    `<div class="layout-wide-side">`,
    `<div class="card"><div class="table-wrap"><table><thead><tr>
      <th>${esc(t("job.th.name"))}</th><th>${esc(t("job.th.resource"))}</th><th>${esc(t("job.th.nodes"))}</th><th>${esc(t("job.th.region"))}</th>
      <th>${esc(t("job.th.dataset"))}</th><th>${esc(t("common.status"))}</th><th>${esc(t("job.th.progress"))}</th><th>${esc(t("job.th.duration"))}</th>
      <th>${esc(t("job.th.goodput"))}</th><th>${esc(t("job.th.cost"))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>`,
    jobs.map((j) => `<tr>
      <td><a href="javascript:void(0)" data-act="job:${j.id}"><strong>${esc(j.name)}</strong></a><small>${esc(L(j.type))} · ${esc(j.id)} · ${roleIcon(j.priority)} ${esc(j.priority || "Normal")}</small></td>
      <td>${esc(j.gpu)} × ${j.count}<small>${esc(j.template || "")}</small></td>
      <td>${j.nodes || 1}</td>
      <td>${esc(j.region)}</td>
      <td>${esc(j.dataset)}</td>
      <td>${status(j.status)}</td>
      <td style="min-width:120px"><div class="progress"><span style="width:${j.progress}%"></span></div><small>${j.progress}%</small></td>
      <td>${esc(j.duration)}</td>
      <td>${j.goodput ? j.goodput + "%" : "—"}</td>
      <td>${money(j.cost || 0)}<small>${money(gpu(j.gpu).price * j.count * (j.nodes || 1))}/h</small></td>
      <td><div class="table-actions">${btn("job.btn.detail", "job:" + j.id, "sm")}${btn("job.btn.logs", "job-logs:" + j.id, "sm")}${btn("job.btn.retry", "retry-job:" + j.id, "sm")}</div></td></tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="card card-pad">${section("job.chain.title")}<div class="grid" style="gap:9px">`,
    [["1", "job.chain.1", "job.chain.1.d"], ["2", "job.chain.2", "job.chain.2.d"], ["3", "job.chain.3", "job.chain.3.d"], ["4", "job.chain.4", "job.chain.4.d"], ["5", "job.chain.5", "job.chain.5.d"]]
      .map((x) => `<div class="chain-step"><span class="step-num">${x[0]}</span><div><b>${esc(t(x[1]))}</b><div class="small muted" style="margin-top:3px">${esc(t(x[2]))}</div></div></div>`).join(""),
    `</div><div class="callout mt16">${esc(t("job.chain.tip"))}</div></div></div>`,
  ].join("");
}

function clustersView(S, clusters) {
  return [
    `<div class="grid cols-3 mb16 kpi-row">`,
    metric("job.cl.kpi.count", clusters.length, "job.cl.kpi.count.desc", "<i class='bi bi-hdd-rack'></i>", ""),
    metric("job.cl.kpi.gpus", clusters.reduce((a, c) => a + Number(c.count || 0), 0), "job.cl.kpi.gpus.desc", "<i class='bi bi-cpu'></i>", "", "hero"),
    metric("job.cl.kpi.net", "800G IB", "job.cl.kpi.net.desc", "<i class='bi bi-arrow-left-right'></i>", ""),
    `</div>`,
    `<div class="grid cols-2">`,
    clusters.map((c) => `<div class="card card-pad">
      ${section(esc(c.name), status(c.status))}
      <div class="chiprow mb16"><span class="tag">${esc(c.scheduler)}</span><span class="tag">${esc(c.network)}</span><span class="tag">${esc(c.gpu)} × ${c.count}</span><span class="tag">${esc(c.region)}</span></div>
      <div class="grid cols-3 mb12">
        <div class="stat"><span>${esc(t("job.cl.nodes"))}</span><b>${c.nodes}</b></div>
        <div class="stat"><span>${esc(t("job.cl.gpus"))}</span><b>${c.count}</b></div>
        <div class="stat"><span>${esc(t("job.cl.util"))}</span><b>${c.util}%</b></div>
      </div>
      <div class="progress mb16"><span style="width:${c.util}%"></span></div>
      <div class="table-wrap mb12"><table><tbody>
        <tr><td class="small muted">CPU / 节点</td><td><b>${c.cpuPerNode || "—"} vCPU</b></td></tr>
        <tr><td class="small muted">内存 / 节点</td><td><b>${c.ramPerNode || "—"} GB</b></td></tr>
        <tr><td class="small muted">本地存储 / 节点</td><td><b>${esc(c.storagePerNode || "—")}</b></td></tr>
        <tr><td class="small muted">${esc(t("common.price"))}</td><td><b>${money(c.price || 0)} ${esc(t("common.perHour"))}</b></td></tr>
        <tr><td class="small muted">运行中作业</td><td><b>${c.jobs || 0}</b></td></tr>
      </tbody></table></div>
      <div class="between"><span class="small muted">${esc(t("job.cl.foot"))}</span><div class="table-actions">${btn("job.cl.topology", "cluster:" + c.id, "sm")}${btn("job.cl.detail", "cluster-detail:" + c.id, "sm ghost")}</div></div>
    </div>`).join(""),
    `</div>`,
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
      <td><strong>${esc(s.name)}</strong><small>${esc(s.id)}</small></td>
      <td>${esc(s.gpu)} × ${s.gpusPerNode} · ${s.cpu} vCPU · ${s.ram} GB · ${esc(s.storage)}</td>
      <td>${s.totalGpus}</td>
      <td>${esc(s.network)}</td>
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
