// 总览 Dashboard：KPI 分层 + 服务状态条 + 成本结构（USD，由后端实算）
import { api } from "../api.js";
import { header, metric, section, btn, chart, status, money, esc, segmented, t, L } from "../ui.js";

export default async function overview(S) {
  const range = S.overviewRange === "30d" ? "7d" : "24h";
  const [ov, m] = await Promise.all([api.overview(), api.metrics("gpu", range)]);
  const monthCost = ov.metrics.monthCost;
  const gpuUtil = Math.round(m.primary[m.primary.length - 1] || 0);
  const billColors = ["#ff6000", "#f9a825", "#34383b", "#ffcc32"];

  return [
    header("ov.title", "ov.sub", btn("ov.cta.create", "go-create", "primary") + btn("ov.cta.guide", "about")),
    `<div class="banner mb16"><div><div style="font-size:10px;letter-spacing:1.8px;opacity:.8;margin-bottom:7px">${esc(t("ov.banner.eyebrow"))}</div><h2>${esc(t("ov.banner.title"))}</h2><p>${t("ov.banner.body")}</p></div>${btn("<i class='bi bi-lightning-charge-fill'></i> " + t("ov.banner.cta"), "go-endpoint", "primary")}</div>`,
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric("ov.kpi.spend", money(monthCost), t("ov.kpi.spend.desc") + " " + Math.round((monthCost / (ov.budget || 30000)) * 100) + "%", "<i class='bi bi-cash-stack'></i>", "↓ 8.6%", "hero"),
    metric("ov.kpi.ws", ov.metrics.workspaces, "ov.kpi.ws.desc", "<i class='bi bi-hdd-stack'></i>", "↗ 12%"),
    metric("ov.kpi.ep", ov.metrics.endpoints, t("ov.kpi.ep.desc") + " / " + (S.endpoints || []).length, "<i class='bi bi-lightning-charge-fill'></i>", "99.95%"),
    metric("ov.kpi.job", ov.metrics.jobSuccessRate, "ov.kpi.job.desc", "<i class='bi bi-terminal'></i>", "↗ 2.4%"),
    `</div>`,
    `<div class="status-strip mb16">`,
    `<div><span>${esc(t("ov.strip.availability"))}</span><b>99.95% <span class="pill green sm"><i class="dot"></i>${esc(t("ov.strip.normal"))}</span></b></div>`,
    `<div><span>${esc(t("ov.strip.util"))}</span><b>${gpuUtil}%</b></div>`,
    `<div><span>${esc(t("ov.strip.gpus"))}</span><b>${ov.metrics.runningGpus} ${esc(t("mk.card.stock"))}</b></div>`,
    `<div><span>${esc(t("ov.strip.sched"))}</span><b>${ov.metrics.jobSuccessRate}</b></div>`,
    `<div><span>${esc(t("ov.strip.balance"))}</span><b>${money(ov.balance || 0)}</b></div>`,
    `</div>`,
    `<div class="grid cols-3 mb16">`,
    `<div class="card quick-card" data-nav="create" data-mode="workspace"><div class="quick-icon"><i class='bi bi-terminal'></i></div><div><h3>${esc(t("ov.quick.ws"))}</h3><p>${t("ov.quick.ws.desc")}</p></div></div>`,
    `<div class="card quick-card" data-nav="create" data-mode="job"><div class="quick-icon" style="background:#f1edff;color:#815ce9"><i class='bi bi-cpu'></i></div><div><h3>${esc(t("ov.quick.job"))}</h3><p>${t("ov.quick.job.desc")}</p></div></div>`,
    `<div class="card quick-card" data-nav="create" data-mode="endpoint"><div class="quick-icon" style="background:#e6fbf5;color:#0e9e85"><i class='bi bi-lightning-charge-fill'></i></div><div><h3>${esc(t("ov.quick.ep"))}</h3><p>${t("ov.quick.ep.desc")}</p></div></div>`,
    `</div>`,
    `<div class="split-65 mb16">`,
    `<div class="card card-pad">${section("ov.trend", segmented([["7d", "ov.trend.7d"], ["30d", "ov.trend.30d"]], S.overviewRange, "overviewRange"))}`,
    chart(m.primary, { second: m.secondary, height: 220, startText: t("ep.chart.start"), endText: t("ep.chart.end") }),
    `<div class="flex small muted"><span class="blue">${esc(t("ov.trend.gpu"))}</span><span class="purple">${esc(t("ov.trend.ep"))}</span><span style="margin-left:auto">${esc(t("ov.trend.src"))}</span></div></div>`,
    `<div class="card card-pad">${section("ov.cost", `<a data-nav="billing" href="javascript:void(0)">${esc(t("ov.cost.link"))}</a>`)}`,
    `<div class="flex" style="gap:18px;margin-top:15px"><div class="donut"><div class="donut-inner">${money(monthCost)}<small>${esc(t("ov.cost.month"))}</small></div></div>`,
    `<div class="legend" style="flex:1">${ov.bills.map((b, i) => `<div class="legend-item"><span><i style="background:${billColors[i]}"></i>${esc(L(b.name))}</span><b>${b.pct}%</b></div>`).join("")}</div></div>`,
    `<div class="callout mt16">${esc(t("ov.cost.tip"))}</div></div>`,
    `</div>`,
    `<div class="layout-main-side">`,
    `<div class="card card-pad">${section("ov.recent", `<a data-nav="instances" href="javascript:void(0)">${esc(t("ov.recent.link"))}</a>`)}`,
    `<div class="table-wrap"><table><thead><tr><th>${esc(t("common.name"))} / ${esc(t("common.type"))}</th><th>${esc(t("job.th.resource"))}</th><th>${esc(t("common.status"))}</th><th>${esc(t("common.region"))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>`,
    ov.instances.map((x) => `<tr><td><strong>${esc(x.name)}</strong><small>${esc(L(x.kind))}</small></td><td>${esc(x.gpu)} × ${x.count}</td><td>${status(x.status)}</td><td>${esc(x.region)}</td><td>${btn("common.view", "instance:" + x.id, "sm")}</td></tr>`).join(""),
    ov.endpoints.map((x) => `<tr><td><strong>${esc(x.name)}</strong><small>${esc(t("ov.endpoint.kind"))}</small></td><td>${esc(x.gpu)} × ${(x.gpusPerReplica || 1)} × ${x.replicas}</td><td>${status(x.status)}</td><td>${esc(x.region || "—")}</td><td>${btn("common.view", "endpoint:" + x.id, "sm")}</td></tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="card card-pad">${section("ov.events", `<a data-nav="monitor" href="javascript:void(0)">${esc(t("ov.events.link"))}</a>`)}`,
    ov.events.map((e, i) => `<div style="padding:11px 0;border-bottom:1px solid #edf1f7"><div class="between">${status(e.level)}<span class="right-muted">${esc(e.time)}</span></div><div class="small" style="margin-top:8px;line-height:1.5">${esc(L(e.text))}</div></div>`).join(""),
    `</div></div>`,
  ].join("");
}
