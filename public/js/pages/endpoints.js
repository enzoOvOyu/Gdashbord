// 推理服务：Endpoint 工作台 + 扩充后的模型目录（按任务类型分组）
import { api } from "../api.js";
import { header, metric, section, btn, esc, status, chart, tabs, field, segmented, t, L } from "../ui.js";

function modelCatalog(S) {
  const groups = window.__MODEL_GROUPS || [];
  const g = S.modelGroup || "all";
  const list = g === "all" ? groups : groups.filter((x) => x.id === g);
  return [
    `<div class="card card-pad">${section("ep.model.group", `<span class="small muted">${esc(t("ep.model.pick"))}</span>`)}`,
    `<div class="seg wrap mb16">${[["all", "ep.model.filter.all"], ...groups.map((x) => [x.id, L(x.name)])]
      .map((x) => `<button data-set="modelGroup" data-value="${esc(x[0])}" class="${String(x[0]) === String(g) ? "active" : ""}">${esc(L(x[1]))}</button>`).join("")}</div>`,
    list.map((grp) => [
      `<div class="subhead mb12"><i class='bi bi-collection'></i> ${esc(L(grp.name))} <span class="small muted">· ${grp.models.length}</span></div>`,
      `<div class="table-wrap mb16"><table><thead><tr><th>${esc(t("common.name"))}</th><th>${esc(t("ep.model.vendor"))}</th><th>${esc(t("ep.model.params"))}</th><th>${esc(t("ep.model.ctx"))}</th><th>${esc(t("ep.model.license"))}</th><th>${esc(t("ep.model.vram"))}</th><th>${esc(t("ep.model.engine"))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>`,
      grp.models.map((m) => `<tr><td><strong>${esc(m.name)}</strong><small>${esc(m.id)}</small></td><td>${esc(m.vendor)}</td><td>${esc(m.params)}</td><td>${esc(m.ctx)}</td><td>${esc(m.license)}</td><td>${m.vram ? m.vram + " GB" : "—"}</td><td>${esc(m.engines.join(" / "))}</td><td>${btn("ep.model.deploy", "deploy-model:" + m.id, "sm primary")}</td></tr>`).join(""),
      `</tbody></table></div>`,
    ].join("")).join(""),
    `</div>`,
  ].join("");
}

export default async function endpointsPage(S) {
  const res = await api.endpoints();
  const list = res.endpoints || [];
  const x = list.find((e) => e.id === S.endpointSelected) || list[0];
  const m = await api.metrics("inference", "1h");

  return [
    header("ep.title", "ep.sub", btn("ep.cta", "go-endpoint", "primary")),
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric("ep.kpi.requests", ((res.totalRequests || 0) / 1000).toFixed(1) + "K", "ep.kpi.requests.desc", "<i class='bi bi-arrow-left-right'></i>", "↗ 18.6%", "hero"),
    metric("ep.kpi.active", list.length, "ep.kpi.active.desc", "<i class='bi bi-lightning-charge-fill'></i>", ""),
    metric("ep.kpi.p95", (x ? x.p95 : 0) + " ms", x ? x.name : "—", "<i class='bi bi-clock-history'></i>", "↓ 9.8%"),
    metric("ep.kpi.uptime", "99.95%", "ep.kpi.uptime.desc", "<i class='bi bi-check2-circle'></i>", t("ep.kpi.uptime.trend")),
    `</div>`,
    `<div class="grid cols-3 mb16">`,
    list.map((e) => `<div class="card endpoint-card${x && x.id === e.id ? " selected" : ""}" data-act="endpoint:${e.id}"><div class="endpoint-top"><div class="endpoint-logo">${e.engine === "ComfyUI" ? "<i class='bi bi-palette'></i>" : "<i class='bi bi-lightning-charge-fill'></i>"}</div><div style="flex:1"><div class="endpoint-name">${esc(e.name)}</div><div class="endpoint-sub">${esc(e.model)}</div></div>${status(e.status)}</div><div class="chiprow mb12"><span class="tag">${esc(e.engine)}</span><span class="tag">${esc(e.gpu)} × ${e.gpusPerReplica || 1}</span><span class="tag">${e.min}–${e.max} ${esc(t("ep.card.replicas"))}</span><span class="tag">${esc(e.region)}</span></div><div class="endpoint-stats"><div>${esc(t("ep.card.qps"))}<b>${e.qps}</b></div><div>${esc(t("ep.card.p95"))}<b>${e.p95 || "—"} ms</b></div><div>${esc(t("ep.card.active"))}<b>${e.replicas}</b></div></div><div class="between mt12"><span class="small muted">${esc(e.version)} · ${e.min === 0 ? esc(t("ep.card.scalezero")) : esc(t("ep.card.keep")) + " " + e.min + " " + esc(t("ep.card.replicas"))}</span>${btn("ep.btn.detail", "endpoint:" + e.id, "sm ghost")}</div></div>`).join(""),
    `</div>`,
    x
      ? [
          `<div class="layout-wide-side">`,
          `<div class="card card-pad">${section(L(x.name) + " · " + t("ep.workbench"), tabs([["overview", "ep.tab.overview"], ["playground", "ep.tab.playground"], ["versions", "ep.tab.versions"], ["models", "ep.tab.models"]], S.endpointTab, "endpointTab"))}`,
          S.endpointTab === "overview"
            ? [
                chart(m.primary, { second: m.secondary, height: 215, startText: t("ep.chart.start"), endText: t("ep.chart.end") }),
                `<div class="flex small muted"><span class="blue">${esc(t("ep.chart.throughput"))}</span><span class="purple">${esc(t("ep.chart.replicas"))}</span></div>`,
                `<div class="grid cols-3 mt16">${metric("ep.metric.24h", x.requests.toLocaleString(), "ep.metric.24h.desc", "<i class='bi bi-arrow-left-right'></i>", "")}${metric("ep.metric.err", "0.12%", "ep.metric.err.desc", "<i class='bi bi-exclamation-triangle'></i>", "")}${metric("ep.metric.token", "2,860 /s", "ep.metric.token.desc", "<i class='bi bi-cpu'></i>", "")}</div>`,
              ].join("")
            : S.endpointTab === "playground"
            ? [
                `<div class="callout mb16">${esc(t("ep.playground.tip"))}</div>`,
                field("ep.playground.field", `<textarea id="playground-input" placeholder="Explain GPU cloud advantages in three sentences">${esc(S.endpointPlayground)}</textarea>`),
                `<div class="flex mt12">${btn("ep.playground.send", "run-playground", "primary")}${btn("ep.playground.curl", "copy-curl", "sm")}</div>`,
                `<div id="playground-response" class="code mt16">${esc(t("ep.playground.wait"))}</div>`,
              ].join("")
            : S.endpointTab === "versions"
            ? [
                `<div class="table-wrap"><table><thead><tr><th>${esc(t("ep.version.th"))}</th><th>${esc(t("ep.version.weight"))}</th><th>${esc(t("common.status"))}</th><th>${esc(t("ep.version.time"))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody><tr><td><strong>${esc(x.version)}</strong></td><td>90%</td><td>${status("healthy")}</td><td>${esc(t("ov.recent"))}</td><td>${btn("ep.version.current", "none", "sm")}</td></tr><tr><td><strong>v1.2.9</strong></td><td>10%</td><td>${status("healthy")}</td><td>10-10</td><td>${btn("ep.version.rollback", "rollback", "sm")}</td></tr></tbody></table></div>`,
                `<div class="callout mt16">${esc(t("ep.version.tip"))}</div>`,
              ].join("")
            : modelCatalog(S),
          `</div>`,
          `<div class="detail-panel">${section("ep.detail.title", status(x.status))}`,
          `<div class="detail-header"><div><h2>${esc(x.name)}</h2><p>${esc(t("ep.detail.api"))} · ${esc(x.engine)}</p></div></div>`,
          [[t("ep.kv.model"), x.model], [t("ep.kv.gpu"), x.gpu + " × " + (x.gpusPerReplica || 1)], [t("common.region"), x.region], [t("ep.kv.replicas"), x.replicas + " / " + x.max], [t("ep.kv.range"), x.min + " – " + x.max], [t("ep.kv.version"), x.version], [t("ep.kv.auth"), "API Key"], [t("ep.kv.url"), "https://api.runsuncloud.com/v1/" + x.name]]
            .map((y) => `<div class="detail-kv"><span>${esc(y[0])}</span><b>${esc(y[1])}</b></div>`).join(""),
          `<div class="subhead mt16">${esc(t("ep.autoscale"))}</div><div class="progress"><span style="width:${(x.replicas / x.max) * 100}%"></span></div>`,
          `<div class="between mt12 small"><span class="muted">${esc(t("ep.autoscale.cur"))} ${x.replicas}</span><span class="muted">${esc(t("ep.autoscale.max"))} ${x.max}</span></div>`,
          `<div class="grid cols-2 mt16">${btn("ep.btn.scale", "scale:" + x.id, "sm")}${btn("ep.btn.curl", "copy-curl", "sm")}${btn("ep.btn.monitor", "monitor-endpoint:" + x.id, "sm")}${btn("ep.btn.logs", "endpoint-logs:" + x.id, "sm")}</div>`,
          `</div></div>`,
        ].join("")
      : "",
  ].join("");
}
