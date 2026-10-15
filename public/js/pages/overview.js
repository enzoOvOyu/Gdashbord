// 万卡级机队总览：机队 KPI → 运营状态条 → 区域容量 / 型号构成 / 集群健康 → 趋势与成本 → 负载与事件
// 所有机队数据来自 /api/overview 的 fleet（由 state.clusters 实算），口径与部署/推理/训练一致
import { api } from "../api.js";
import { header, metric, section, btn, chart, status, money, moneyShort, esc, segmented, timeAxis, t, L } from "../ui.js";

const B = (zh, en) => ({ zh, en });
const BAR = (pct, color) => `<div class="progress"><span style="width:${Math.min(100, Math.max(2, Math.round(pct)))}%;${color ? "background:" + color : ""}"></span></div>`;

export default async function overview(S) {
  const range = S.overviewRange === "30d" ? "7d" : "24h";
  const [ov, m] = await Promise.all([api.overview(), api.metrics("gpu", range)]);
  const f = ov.fleet || {};
  const M = ov.metrics || {};
  const monthCost = M.monthCost;
  const billColors = ["#ff6000", "#f9a825", "#34383b", "#ffcc32"];

  const total = f.total || 0;
  const online = f.online || 0;
  const free = f.free || 0;
  const allocated = f.allocated || 0;
  const util = f.utilization || 0;
  const H = f.health || {};
  const zoneTotal = (f.byZone || []).length;
  const regionTotal = (f.byRegion || []).length;
  const onlinePct = total ? Math.round((online / total) * 100) : 0;
  const healthyPct = f.clusters ? Math.round(((H.healthy || 0) / f.clusters) * 100) : 0;

  // 区域 → 名称 / 可用区计数 / 容量行
  const zonesOf = {};
  (f.byZone || []).forEach((z) => { zonesOf[z.region] = (zonesOf[z.region] || 0) + 1; });
  const regionRows = (f.byRegion || []).map((r) => {
    const reg = (S.REGIONS || []).find((x) => x.id === r.region) || {};
    const u = r.total ? Math.round((r.allocated / r.total) * 100) : 0;
    return `<tr>
      <td><strong>${esc(L(reg.name || r.region))}</strong><small>${esc(r.region)} · ${zonesOf[r.region] || 0} AZ · ${esc(String(reg.fabric || "—"))}</small></td>
      <td><b>${r.total.toLocaleString()}</b></td>
      <td>${r.allocated.toLocaleString()}</td>
      <td><b style="color:#0e9e85">${r.free.toLocaleString()}</b></td>
      <td style="min-width:120px">${BAR(u)}<small>${u}% ${esc(B("已分配", "allocated"))}</small></td>
    </tr>`;
  }).join("");

  // 型号构成（占比条 + 占用率）
  const modelRows = (f.byModel || []).map((mm) => {
    const g = (S.GPU || []).find((x) => x.id === mm.gpu) || {};
    const pct = total ? Math.round((mm.total / total) * 100) : 0;
    const u = mm.total ? Math.round((mm.allocated / mm.total) * 100) : 0;
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0">
      <span style="min-width:56px"><b>${esc(mm.gpu)}</b></span>
      <span class="muted" style="min-width:56px">${esc(String(g.vram || "—"))} GB</span>
      <div style="flex:1">${BAR(pct)}</div>
      <b style="min-width:48px;text-align:right">${mm.total.toLocaleString()}</b>
      <span class="muted" style="min-width:56px;text-align:right">${u}% ${esc(B("占用", "used"))}</span>
    </div>`;
  }).join("");

  // 集群健康分布
  const healthRows = ["healthy", "degraded", "provisioning", "maintenance"]
    .map((st) => `<div class="between" style="padding:8px 0;border-bottom:1px solid #edf1f7">${status(st)}<b>${H[st] || 0}</b></div>`).join("");

  return [
    header("ov.title", "ov.sub", btn("ov.cta.create", "go-create", "primary") + btn("ov.cta.guide", "about")),

    // 运营横幅：万卡规模宣言（素材包 hero 模式：装饰图形 + 双 CTA）
    `<div class="banner mb16"><div><div style="font-size:10px;letter-spacing:1.8px;opacity:.8;margin-bottom:7px">${esc(t("ov.banner.eyebrow"))}</div><h2>${esc(t("ov.banner.title"))}</h2><p>${t("ov.banner.body")}</p><div class="flex" style="gap:8px;margin-top:14px">${btn({ html: "<i class='bi bi-rocket-takeoff'></i> ", label: t("ov.cta.create") }, "go-create", "primary")}${btn(t("ov.banner.cta") + " <i class='bi bi-arrow-right'></i>", "go-endpoint")}</div></div><div class="hero-art"><div class="hero-orbit"></div><div class="hero-orbit two"></div><div class="hero-chip"><i class="bi bi-gpu-card"></i></div></div></div>`,

    // 机队级 KPI（4 张，含 sparkline 趋势）
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric(B("GPU 机队总规模", "Total GPU fleet"), total.toLocaleString(),
      B(`在线 ${online.toLocaleString()} · 利用率 ${util}%`, `Online ${online.toLocaleString()} · ${util}% utilized`),
      "<i class='bi bi-cpu'></i>", `↗ ${regionTotal} ${esc(t("common.region"))}`, "hero"),
    metric(B("机队利用率", "Fleet utilization"), util + "%",
      B(`已分配 ${allocated.toLocaleString()} · 可分配 ${free.toLocaleString()}`, `Allocated ${allocated.toLocaleString()} · free ${free.toLocaleString()}`),
      "<i class='bi bi-speedometer2'></i>", "↗ 2.1%", ""),
    metric(B("集群 / 节点池", "Clusters"), f.clusters || 0,
      B(`${regionTotal} 区域 · ${zoneTotal} 可用区 · ${H.healthy || 0} 健康`, `${regionTotal} regions · ${zoneTotal} zones · ${H.healthy || 0} healthy`),
      "<i class='bi bi-diagram-3'></i>", `${healthyPct}%`, ""),
    metric(B("月度经常性收入", "MRR"), moneyShort(M.mrr || 0),
      B(`${M.tenants || 0} 活跃租户 · ${M.users || 0} 用户`, `${M.tenants || 0} tenants · ${M.users || 0} users`),
      "<i class='bi bi-graph-up-arrow'></i>", "↗ 6.4%", ""),
    `</div>`,

    // 运营状态条：服务水位 / 在线 / 可分配 / 作业 / 调度 / 消费
    `<div class="status-strip mb16">`,
    `<div><span>${esc(t("ov.strip.availability"))}</span><b>99.95% <span class="pill green sm"><i class="dot"></i>${esc(t("ov.strip.normal"))}</span></b></div>`,
    `<div><span>${esc(B("在线 GPU", "Online GPUs"))}</span><b>${online.toLocaleString()} <small>(${onlinePct}%)</small></b></div>`,
    `<div><span>${esc(B("可分配 GPU", "Free GPUs"))}</span><b>${free.toLocaleString()}</b></div>`,
    `<div><span>${esc(B("训练作业", "Training jobs"))}</span><b>${M.jobsRunning || 0} ${esc(B("运行", "run"))} / ${M.jobsQueued || 0} ${esc(B("排队", "queued"))}</b></div>`,
    // 口径说明：无终态样本时显示「— + 暂无终态样本」，不再显示误导性的 0%
    `<div><span>${esc(t("ov.strip.sched"))}</span><b>${esc(M.jobSuccessRate)}</b>${
      M.jobSuccessSample ? "" : `<small class="muted"> · ${esc(L(B("暂无终态样本", "no finished jobs")))}</small>`
    }</div>`,
    `<div><span>${esc(B("本月消费", "Month spend"))}</span><b>${moneyShort(monthCost)}</b></div>`,
    `</div>`,

    // 区域机队容量 + 型号构成 / 集群健康
    `<div class="split-65 mb16">`,
    `<div class="card card-pad">${section(B("区域机队容量", "Regional fleet capacity"), `<a data-nav="market" href="javascript:void(0)">${esc(B("查看市场 →", "Browse market →"))}</a>`)}`,
    `<div class="table-wrap"><table><thead><tr><th>${esc(t("common.region"))}</th><th>${esc(t("common.total"))}</th><th>${esc(B("已分配", "Allocated"))}</th><th>${esc(B("可分配", "Free"))}</th><th>${esc(B("使用率", "Utilization"))}</th></tr></thead><tbody>${regionRows}</tbody></table></div>`,
    `<div class="callout mt16">${esc(B(
      `容量规划：机队目标 10,000 卡，当前 ${total.toLocaleString()} 卡（在线率 ${onlinePct}%），预留负载占已分配 ${(f.reservedPct || 0)}%。${free.toLocaleString()} 卡可立即投放。`,
      `Capacity planning: fleet target 10,000 GPUs — currently ${total.toLocaleString()} online at ${onlinePct}%, with ${(f.reservedPct || 0)}% of allocated load reserved. ${free.toLocaleString()} GPUs available for immediate deployment.`
    ))}</div></div>`,
    `<div>`,
    `<div class="card card-pad mb16">${section(B("型号构成", "Model mix"))}${modelRows}</div>`,
    `<div class="card card-pad">${section(B("集群健康", "Cluster health"), `<span class="pill green sm">${healthyPct}%</span>`)}${healthRows}</div>`,
    `</div>`,
    `</div>`,

    // 快捷入口
    `<div class="grid cols-3 mb16">`,
    `<div class="card quick-card" data-nav="create" data-mode="workspace"><div class="quick-icon"><i class='bi bi-terminal'></i></div><div><h3>${esc(t("ov.quick.ws"))}</h3><p>${t("ov.quick.ws.desc")}</p></div></div>`,
    `<div class="card quick-card" data-nav="create" data-mode="job"><div class="quick-icon" style="background:#f1edff;color:#815ce9"><i class='bi bi-cpu'></i></div><div><h3>${esc(t("ov.quick.job"))}</h3><p>${t("ov.quick.job.desc")}</p></div></div>`,
    `<div class="card quick-card" data-nav="create" data-mode="endpoint"><div class="quick-icon" style="background:#e6fbf5;color:#0e9e85"><i class='bi bi-lightning-charge-fill'></i></div><div><h3>${esc(t("ov.quick.ep"))}</h3><p>${t("ov.quick.ep.desc")}</p></div></div>`,
    `</div>`,

    // 趋势 + 成本结构
    `<div class="split-65 mb16">`,
    `<div class="card card-pad">${section("ov.trend", segmented([["7d", "ov.trend.7d"], ["30d", "ov.trend.30d"]], S.overviewRange, "overviewRange"))}`,
    chart(m.primary, { second: m.secondary, height: 220, unit: "%", xLabels: timeAxis(m.primary.length, range) }),
    `<div class="flex small muted"><span class="blue">${esc(t("ov.trend.gpu"))}</span><span class="purple">${esc(t("ov.trend.ep"))}</span><span style="margin-left:auto">${esc(t("ov.trend.src"))}</span></div></div>`,
    `<div class="card card-pad">${section("ov.cost", `<a data-nav="billing" href="javascript:void(0)">${esc(t("ov.cost.link"))}</a>`)}`,
    `<div class="flex" style="gap:18px;margin-top:15px"><div class="donut"><div class="donut-inner">${money(monthCost)}<small>${esc(t("ov.cost.month"))}</small></div></div>`,
    `<div class="legend" style="flex:1">${ov.bills.map((b, i) => `<div class="legend-item"><span><i style="background:${billColors[i]}"></i>${esc(L(b.name))}</span><b>${b.pct}%</b></div>`).join("")}</div></div>`,
    `<div class="callout mt16">${esc(t("ov.cost.tip"))}</div></div>`,
    `</div>`,

    // 最近负载 + 事件
    `<div class="layout-main-side">`,
    `<div class="card card-pad">${section("ov.recent", `<a data-nav="instances" href="javascript:void(0)">${esc(t("ov.recent.link"))}</a>`)}`,
    `<div class="table-wrap"><table><thead><tr><th>${esc(t("common.name"))} / ${esc(t("common.type"))}</th><th>${esc(t("job.th.resource"))}</th><th>${esc(t("common.status"))}</th><th>${esc(t("common.region"))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>`,
    (ov.instances || []).map((x) => `<tr><td><strong>${esc(x.name)}</strong><small>${esc(L(x.kind))}</small></td><td>${esc(x.gpu)} × ${x.count}</td><td>${status(x.status)}</td><td>${esc(x.region)}</td><td>${btn("common.view", "instance:" + x.id, "sm")}</td></tr>`).join(""),
    (ov.endpoints || []).map((x) => `<tr><td><strong>${esc(x.name)}</strong><small>${esc(t("ov.endpoint.kind"))}</small></td><td>${esc(x.gpu)} × ${(x.gpusPerReplica || 1)} × ${x.replicas}</td><td>${status(x.status)}</td><td>${esc(x.region || "—")}</td><td>${btn("common.view", "endpoint:" + x.id, "sm")}</td></tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="card card-pad"><div class="section-head"><div><div class="card-title">${esc(t("ov.events"))}</div><div class="card-sub">${esc(L(B("工作区事件与动态", "Workspace events and updates")))}</div></div><a data-nav="monitor" href="javascript:void(0)" class="icon-btn" title="${esc(t("ov.events.link"))}"><i class="bi bi-three-dots"></i></a></div>`,
    `<div class="activity">`,
    (ov.events || []).slice(0, 6).map((e) => {
      const icon = e.level === "warning" ? "exclamation-triangle" : e.level === "error" ? "x-octagon" : e.level === "success" ? "check-circle" : "info-circle";
      return `<div class="activity-item"><div class="activity-icon"><i class="bi bi-${icon}"></i></div><div style="min-width:0"><div class="activity-title">${esc(L(e.text))}</div><div class="activity-meta">${status(e.level)} · ${esc(e.time)}</div></div></div>`;
    }).join(""),
    `</div></div></div>`,
  ].join("");
}
