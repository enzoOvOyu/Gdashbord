// 推理服务（万卡级）：模型目录（按任务分组）+ Endpoint 机队工作台
// KPI 含吞吐 / 延迟 / tokens / 错误率 / 成本；详情面板含副本弹性、区域可用区、租户归属
import { api } from "../api.js";
import { header, metric, section, btn, esc, status, chart, tabs, field, segmented, money, moneyShort, t, L } from "../ui.js";

const B = (zh, en) => ({ zh, en });
const BAR = (pct, color) => `<div class="progress"><span style="width:${Math.min(100, Math.max(2, Math.round(pct)))}%;${color ? "background:" + color : ""}"></span></div>`;

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

  // 机队级 KPI：总请求 / 端点数 / 吞吐 tokens / 平均延迟 / 日成本
  const totalReq = res.totalRequests || 0;
  const totalTokens = list.reduce((a, e) => a + (e.tokensPerSec || 0), 0);
  const avgP95 = list.length ? Math.round(list.reduce((a, e) => a + (e.p95 || 0), 0) / list.length) : 0;
  const avgErr = list.length ? (list.reduce((a, e) => a + (e.errorRate || 0), 0) / list.length).toFixed(2) : "0";
  const dailyCost = list.reduce((a, e) => a + (e.dailyCost || 0), 0);
  const activeGpus = list.reduce((a, e) => a + (e.replicas || 0) * (e.gpusPerReplica || 1), 0);
  const groups = {};
  list.forEach((e) => { const g = e.group || "llm"; groups[g] = (groups[g] || 0) + 1; });

  // Endpoint 机队表格行
  const rows = list.map((e) => `<tr>
    <td><strong>${esc(e.name)}</strong><small>${esc(e.model)} · ${esc(e.engine)}</small></td>
    <td>${esc(e.gpu)} × ${e.gpusPerReplica || 1} × ${e.replicas}</td>
    <td>${status(e.status)}</td>
    <td>${e.qps || 0}</td>
    <td><b>${(e.tokensPerSec || 0).toLocaleString()}</b></td>
    <td>${e.p50 || "—"} / <b>${e.p95 || "—"}</b> ms</td>
    <td>${e.errorRate != null ? e.errorRate + "%" : "—"}</td>
    <td>${e.gpuUtil != null ? e.gpuUtil + "%" : "—"}</td>
    <td>${esc(e.region || "—")}${e.zone ? "<small>" + esc(e.zone) + "</small>" : ""}</td>
    <td>${money(e.dailyCost || 0)}</td>
    <td>${btn("common.view", "endpoint:" + e.id, "sm")}</td>
  </tr>`).join("");

  return [
    header("ep.title", "ep.sub", btn("ep.cta", "go-endpoint", "primary")),

    // 机队级 KPI（4 张，含 sparkline）
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric("ep.kpi.requests", (totalReq / 1_000_000).toFixed(2) + "M", "ep.kpi.requests.desc", "<i class='bi bi-arrow-left-right'></i>", "↗ 18.6%", "hero",
      { data: [30, 38, 35, 44, 48, 52, 49, 58, 62, 68, 74, 82], color: "#ff6000" }),
    metric(B("推理端点机队", "Endpoint fleet"), list.length, B("在线 GPU " + activeGpus.toLocaleString() + " · " + Object.keys(groups).length + " 类模型分组", activeGpus.toLocaleString() + " GPUs · " + Object.keys(groups).length + " model groups"), "<i class='bi bi-lightning-charge-fill'></i>", `${list.filter((e) => e.status === "healthy").length}/${list.length}`, "",
      { data: [15, 23, 19, 28, 35, 44, 47, 49, 64, 71, 68, 83], color: "#17a76f" }),
    metric(B("吞吐 Tokens", "Tokens throughput"), totalTokens.toLocaleString() + "/s", B("全端点合计 · 平均错误率 " + avgErr + "%", "All endpoints · avg error " + avgErr + "%"), "<i class='bi bi-cpu'></i>", "↗ 24.2%", "",
      { data: [40, 45, 42, 55, 60, 58, 67, 72, 70, 78, 85, 92], color: "#f9a825" }),
    metric(B("日推理成本", "Daily inference cost"), moneyShort(dailyCost), B("平均 P95 " + avgP95 + " ms · 可用性 99.95%", "Avg P95 " + avgP95 + " ms · 99.95% uptime"), "<i class='bi bi-cash-stack'></i>", "↓ 3.1%", "",
      { data: [75, 68, 73, 65, 58, 64, 50, 45, 52, 41, 39, 33], color: "#ff6000" }),
    `</div>`,

    // Endpoint 机队表格（全量）
    `<div class="card card-pad mb16">${section(B("端点机队", "Endpoint fleet") + " · " + list.length, `<a data-nav="create" data-mode="endpoint" href="javascript:void(0)">${esc(t("ep.cta"))} →</a>`)}`,
    `<div class="table-wrap"><table><thead><tr>`,
    `<th>${esc(t("common.name"))} / ${esc(B("模型 · 引擎", "Model · engine"))}</th>`,
    `<th>GPU</th><th>${esc(t("common.status"))}</th><th>QPS</th>`,
    `<th>${esc(B("Tokens/s", "Tokens/s"))}</th>`,
    `<th>p50 / p95</th><th>${esc(B("错误率", "Error"))}</th><th>${esc(B("GPU 利用率", "GPU util"))}</th>`,
    `<th>${esc(t("common.region"))}</th><th>${esc(B("日成本", "Daily cost"))}</th><th></th>`,
    `</tr></thead><tbody>${rows}</tbody></table></div></div>`,

    // 选定端点工作台
    x
      ? [
          `<div class="layout-wide-side">`,
          `<div class="card card-pad">${section(L(x.name) + " · " + t("ep.workbench"), tabs([["overview", "ep.tab.overview"], ["playground", "ep.tab.playground"], ["versions", "ep.tab.versions"], ["models", "ep.tab.models"]], S.endpointTab, "endpointTab"))}`,
          S.endpointTab === "overview"
            ? [
                chart(m.primary, { second: m.secondary, height: 215, startText: t("ep.chart.start"), endText: t("ep.chart.end") }),
                `<div class="flex small muted"><span class="blue">${esc(t("ep.chart.throughput"))}</span><span class="purple">${esc(t("ep.chart.replicas"))}</span></div>`,
                `<div class="grid cols-3 mt16">${metric("ep.metric.24h", x.requests.toLocaleString(), "ep.metric.24h.desc", "<i class='bi bi-arrow-left-right'></i>", "")}${metric("ep.metric.err", (x.errorRate != null ? x.errorRate : "0.12") + "%", "ep.metric.err.desc", "<i class='bi bi-exclamation-triangle'></i>", "")}${metric("ep.metric.token", (x.tokensPerSec || 0).toLocaleString() + " /s", "ep.metric.token.desc", "<i class='bi bi-cpu'></i>", "")}</div>`,
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
                `<div class="table-wrap"><table><thead><tr><th>${esc(t("ep.version.th"))}</th><th>${esc(t("ep.version.weight"))}</th><th>${esc(t("common.status"))}</th><th>${esc(t("ep.version.time"))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody><tr><td><strong>${esc(x.version)}</strong></td><td>90%</td><td>${status("healthy")}</td><td>${esc(x.created || t("ov.recent"))}</td><td>${btn("ep.version.current", "none", "sm")}</td></tr><tr><td><strong>v1.2.9</strong></td><td>10%</td><td>${status("healthy")}</td><td>10-10</td><td>${btn("ep.version.rollback", "rollback", "sm")}</td></tr></tbody></table></div>`,
                `<div class="callout mt16">${esc(t("ep.version.tip"))}</div>`,
              ].join("")
            : modelCatalog(S),
          `</div>`,
          `<div class="detail-panel">${section("ep.detail.title", status(x.status))}`,
          `<div class="detail-header"><div><h2>${esc(x.name)}</h2><p>${esc(t("ep.detail.api"))} · ${esc(x.engine)}</p></div></div>`,
          [[t("ep.kv.model"), x.model], [t("ep.kv.gpu"), x.gpu + " × " + (x.gpusPerReplica || 1)], [t("common.region"), (x.region || "—") + (x.zone ? " · " + x.zone : "")], [t("ep.kv.replicas"), x.replicas + " / " + x.max], [t("ep.kv.range"), x.min + " – " + x.max], [t("ep.kv.version"), x.version], [t("ep.kv.auth"), "API Key"], [B("租户", "Tenant"), x.tenant || "—"], [B("日成本", "Daily cost"), money(x.dailyCost || 0)], [t("ep.kv.url"), "https://api.runsuncloud.com/v1/" + x.name]]
            .map((y) => `<div class="detail-kv"><span>${esc(y[0])}</span><b>${esc(y[1])}</b></div>`).join(""),
          `<div class="subhead mt16">${esc(t("ep.autoscale"))}</div><div class="progress"><span style="width:${(x.replicas / Math.max(1, x.max)) * 100}%"></span></div>`,
          `<div class="between mt12 small"><span class="muted">${esc(t("ep.autoscale.cur"))} ${x.replicas}</span><span class="muted">${esc(t("ep.autoscale.max"))} ${x.max}</span></div>`,
          `<div class="subhead mt16">${esc(B("GPU 利用率", "GPU utilization"))}</div>${BAR(x.gpuUtil || 0)}`,
          `<div class="grid cols-2 mt16">${btn("ep.btn.scale", "scale:" + x.id, "sm")}${btn("ep.btn.curl", "copy-curl", "sm")}${btn("ep.btn.monitor", "monitor-endpoint:" + x.id, "sm")}${btn("ep.btn.logs", "endpoint-logs:" + x.id, "sm")}</div>`,
          `</div></div>`,
        ].join("")
      : "",
  ].join("");
}
