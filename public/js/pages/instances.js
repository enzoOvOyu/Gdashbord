// GPU Pods（工作空间与实例）— 按素材包 Pods 页重构：
// stat KPI → 筛选 tabs(带计数)+搜索 → pod-card 卡片流（ident/meta/4 项利用率/操作排）→ 停止态 Storage billed 语义
import { api } from "../api.js";
import { save } from "../store.js";
import { header, metric, section, btn, esc, money, status, gpu, pager, t, L } from "../ui.js";

const B = (zh, en) => ({ zh, en });

// 分页大小：一次性渲染上千张卡片会产生两万多个 DOM 节点，
// 首屏渲染与每次输入都会被拖慢，这里按页切片渲染。
const PAGE_SIZE = 24;

// pod-card：素材包卡片结构（pod-top / pod-meta / pod-middle 4 进度 / pod-footer）
function podCard(x, selected) {
  const g = gpu(x.gpu);
  const running = x.status === "running";
  const hourly = g.price * Number(x.count || 1);
  const vram = g.vram * Number(x.count || 1);
  const vol = 100; // 持久卷容量
  // 利用率（确定性：由 id 派生，运行中才有值）
  const seed = (x.id || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const u = (base, spread) => running ? (seed + base) % spread : 0;
  const gpuUse = 40 + u(0, 55);
  const cpuUse = 25 + u(7, 60);
  const memUse = 30 + u(13, 55);
  const diskUse = 20 + u(3, 65);
  return `
  <div class="card pod-card${selected ? " selected" : ""}">
    <div class="pod-top">
      <div class="pod-ident">
        <div class="pod-emoji"><i class="bi bi-cpu"></i></div>
        <div>
          <div class="row gap8"><div class="pod-name">${esc(x.name)}</div>${status(x.status)}</div>
          <div class="pod-id mono">ID: ${esc(x.id)} · ${esc(x.image)} · ${esc(L(x.kind))}</div>
        </div>
      </div>
      <div class="pod-gpu">
        <div class="pod-gpu-name">${x.count} × ${esc(x.gpu)}</div>
        <div class="pod-price">${money(hourly)}/hr · ${vram} GB VRAM</div>
      </div>
    </div>
    <div class="pod-meta">
      <span><i class="bi bi-globe"></i> ${esc(x.region)}${x.tenant ? " · " + esc(x.tenant) : ""}</span>
      <span><i class="bi bi-device-hdd"></i> ${x.disk} GB disk · ${vol} GB volume</span>
      <span><i class="bi bi-clock"></i> ${esc(L(x.age))}</span>
    </div>
    <div class="pod-middle">
      ${[["GPU utilization", gpuUse], ["CPU utilization", cpuUse], ["Memory", memUse], ["Disk usage", diskUse]].map(([k, v], i) => `
      <div>
        <div class="metric-name"><span>${esc(L(B(k, k)))}</span><b>${running ? v : 0}%</b></div>
        <div class="progress${i === 2 ? " green" : ""}"><span style="width:${running ? v : 0}%"></span></div>
      </div>`).join("")}
    </div>
    <div class="pod-footer">
      <div class="pod-actions">
        ${btn(`<i class="bi bi-terminal"></i> ${esc(t("ins.connect"))}`, "connect:" + x.id, "sm", running ? "" : "disabled")}
        ${btn(`<i class="bi bi-journal-code"></i> Jupyter`, "jupyter:" + x.id, "sm", x.jupyter && running ? "" : "disabled")}
        ${btn(`<i class="bi bi-activity"></i> ${esc(t("job.btn.logs"))}`, "logs:" + x.id, "sm")}
        ${btn(`<i class="bi bi-${running ? "pause" : "play"}"></i> ${running ? esc(L(B("停止", "Stop"))) : esc(L(B("启动", "Start")))}`, "toggle-instance:" + x.id, "sm")}
        ${btn(`<i class="bi bi-sliders"></i> ${esc(t("job.btn.detail"))}`, "instance:" + x.id, "sm ghost")}
      </div>
      <div class="pod-up">${running ? esc(L(B("On-Demand · Running", "On-Demand · Running"))) : esc(L(B("Stopped · Storage billed", "Stopped · Storage billed")))}</div>
    </div>
  </div>`;
}

export default async function instancesPage(S) {
  const res = await api.workloads();
  const all = res.instances || [];
  const running = all.filter((x) => x.status === "running");
  const stopped = all.filter((x) => x.status !== "running");
  const spend = running.reduce((a, x) => a + gpu(x.gpu).price * Number(x.count || 1), 0);

  const f = S.instanceFilter === "running" ? "running" : S.instanceFilter === "stopped" ? "stopped" : "all";
  const q = (S.instanceQuery || "").toLowerCase();
  const filtered = all.filter((x) => (f === "all" || x.status === f) && (!q || (x.name + " " + x.gpu + " " + x.id).toLowerCase().includes(q)));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(S.instancePage) || 1), totalPages);
  if (page !== Number(S.instancePage)) { S.instancePage = page; save(); }
  const list = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return [
    header("ins.title", "ins.sub",
      btn(`<i class="bi bi-arrow-clockwise"></i> ${esc(L(B("刷新", "Refresh")))}`, "refresh")
      + btn(`<i class="bi bi-plus-lg"></i> ${esc(L(B("部署 GPU Pod", "Deploy GPU Pod")))}`, "create-workspace", "primary")),

    // KPI
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric(B("Pods 总数", "Total Pods"), all.length, B("全部环境", "All environments"), "<i class='bi bi-cube'></i>", "", "hero"),
    metric(B("运行中", "Running"), running.length, B("当前活跃计算", "Currently active"), "<i class='bi bi-activity'></i>", "", ""),
    metric(B("已停止", "Stopped"), stopped.length, B("不占用算力 · 仅计存储", "Not using compute · storage billed"), "<i class='bi bi-pause-circle'></i>", "", ""),
    metric(B("当前 GPU 成本", "Current GPU cost"), money(spend) + "/h", B("运行中 Pod 实时估算", "Live estimate of running Pods"), "<i class='bi bi-wallet2'></i>", "", ""),
    `</div>`,

    // 筛选工具条（tabs 带计数 + 搜索）
    `<div class="toolbar">`,
    `<div class="tabs">
      ${[["all", B("全部", "All"), all.length], ["running", B("运行中", "Running"), running.length], ["stopped", B("已停止", "Stopped"), stopped.length]].map((x) => `
      <button class="tab ${f === x[0] ? "active" : ""}" data-set="instanceFilter" data-value="${x[0]}">${esc(L(x[1]))} · ${x[2]}</button>`).join("")}
    </div>`,
    `<label class="search-field"><i class="bi bi-search"></i><input value="${esc(S.instanceQuery || "")}" data-set="instanceQuery" placeholder="${esc(L(B("搜索 Pods...", "Search Pods...")))}"/></label>`,
    `</div>`,

    // Pod 卡片流（分页 + 响应式多列网格）
    list.length
      ? `<div class="pod-list pod-grid">${list.map((x) => podCard(x, S.selectedInstance === x.id)).join("")}</div>`
        + pager(page, totalPages, "page", filtered.length, PAGE_SIZE)
      : `<div class="empty-state"><div class="empty-icon"><i class="bi bi-search"></i></div><h3>${esc(L(B("没有匹配的 Pods", "No matching Pods")))}</h3><p>${esc(L(B("试试调整筛选条件，或部署一个新的 GPU Pod。", "Adjust filters, or deploy a new GPU Pod.")))}</p>${btn(`<i class="bi bi-plus-lg"></i> ${esc(L(B("部署 Pod", "Deploy Pod")))}`, "create-workspace", "primary")}</div>`,

    `<div class="notice mt16"><i class="bi bi-shield-check"></i> ${esc(L(B(
      "停止的 Pod 仍会产生少量存储费用（$0.20/GB·月）；如无需保留数据请彻底终止。",
      "Stopped Pods still incur storage fees ($0.20/GB·mo); terminate fully if data retention isn't needed."
    )))}</div>`,
  ].join("");
}
