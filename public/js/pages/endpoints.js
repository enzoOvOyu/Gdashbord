// 推理服务（万卡级）：模型目录（按任务分组）+ Endpoint 机队工作台
// KPI 含吞吐 / 延迟 / tokens / 错误率 / 成本；详情面板含副本弹性、区域可用区、租户归属
import { api } from "../api.js";
import { header, metric, section, btn, esc, status, chart, tabs, field, segmented, money, moneyShort, timeAxis, t, L } from "../ui.js";

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
    <td><div class="endpoint-name"><div class="endpoint-icon"><i class="bi bi-lightning-charge-fill"></i></div><div><strong>${esc(e.name)}</strong><small class="mono">${esc(e.id)} · ${esc(e.model)}</small></div></div></td>
    <td>${status(e.status)}</td>
    <td>${esc(e.gpu)} × ${e.gpusPerReplica || 1}</td>
    <td>${e.replicas || 0} / ${e.max || 0}</td>
    <td>${e.qps || 0}</td>
    <td><b>${(e.tokensPerSec || 0).toLocaleString()}</b></td>
    <td>${e.p50 || "—"} / <b>${e.p95 || "—"}</b> ms</td>
    <td>${e.errorRate != null ? e.errorRate + "%" : "—"}</td>
    <td>${e.gpuUtil != null ? e.gpuUtil + "%" : "—"}</td>
    <td>${esc(e.region || "—")}${e.zone ? "<small>" + esc(e.zone) + "</small>" : ""}</td>
    <td>${money(e.dailyCost || 0)}</td>
    <td><div class="table-action">${btn("common.view", "endpoint:" + e.id, "sm")}${btn(`<i class="bi bi-${e.status === "healthy" ? "pause" : "play"}"></i>`, "scale:" + e.id, "sm ghost")}</div></td>
  </tr>`).join("");

  return [
    header("ep.title", "ep.sub", btn("ep.cta", "go-endpoint", "primary")),

    // 机队级 KPI（4 张，含 sparkline）
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric("ep.kpi.requests", (totalReq / 1_000_000).toFixed(2) + "M", "ep.kpi.requests.desc", "<i class='bi bi-arrow-left-right'></i>", "↗ 18.6%", "hero"),
    metric(B("推理端点机队", "Endpoint fleet"), list.length, B("在线 GPU " + activeGpus.toLocaleString() + " · " + Object.keys(groups).length + " 类模型分组", activeGpus.toLocaleString() + " GPUs · " + Object.keys(groups).length + " model groups"), "<i class='bi bi-lightning-charge-fill'></i>", `${list.filter((e) => e.status === "healthy").length}/${list.length}`, ""),
    metric(B("吞吐 Tokens", "Tokens throughput"), totalTokens.toLocaleString() + "/s", B("全端点合计 · 平均错误率 " + avgErr + "%", "All endpoints · avg error " + avgErr + "%"), "<i class='bi bi-cpu'></i>", "↗ 24.2%", ""),
    metric(B("日推理成本", "Daily inference cost"), moneyShort(dailyCost), B("平均 P95 " + avgP95 + " ms · 可用性 99.95%", "Avg P95 " + avgP95 + " ms · 99.95% uptime"), "<i class='bi bi-cash-stack'></i>", "↓ 3.1%", ""),
    `</div>`,

    // Endpoint 机队表格（全量 + table-footer + Auto-scaling 徽标）
    `<div class="card mb16"><div class="section-head" style="padding:20px 20px 0"><div><div class="card-title">${esc(B("端点机队", "Your endpoints"))}</div><div class="card-sub">${esc(B("管理推理端点与 Worker 自动伸缩", "Manage inference endpoints and worker autoscaling"))}</div></div><span class="pill purple"><i class="bi bi-lightning-charge-fill"></i> ${esc(B("自动伸缩已启用", "Auto-scaling enabled"))}</span></div>`,
    `<div class="table-wrap"><table><thead><tr>`,
    `<th>${esc(t("common.name"))} / ${esc(B("模型 · 引擎", "Model · engine"))}</th>`,
    `<th>${esc(t("common.status"))}</th><th>GPU</th><th>${esc(B("WORKERS", "WORKERS"))}</th><th>QPS</th>`,
    `<th>${esc(B("Tokens/s", "Tokens/s"))}</th>`,
    `<th>p50 / p95</th><th>${esc(B("错误率", "Error"))}</th><th>${esc(B("GPU 利用率", "GPU util"))}</th>`,
    `<th>${esc(t("common.region"))}</th><th>${esc(B("日成本", "Daily cost"))}</th><th></th>`,
    `</tr></thead><tbody>${rows}</tbody></table>
    <div class="table-footer"><span>${list.length} ${esc(B("端点 · 模拟指标", "endpoints · simulated metrics"))}</span><span>${esc(B("显示全部端点", "Showing all endpoints"))}</span></div></div></div>`,

    // Serverless 架构流（素材包 activity 模式）+ 推理请求趋势
    `<div class="split-65 mb16">`,
    `<div class="card chart-panel"><div class="section-head"><div><div class="card-title">${esc(B("推理请求量", "Inference requests"))}</div><div class="card-sub">${esc(B("活跃端点请求合计", "Requests across active endpoints"))}</div></div><span class="pill gray">${esc(B("近 24 小时", "Last 24 hours"))}</span></div>`,
    `<div class="billing-total">${(totalReq / 1_000_000).toFixed(2)}M <span class="pill green">↗ 18.6%</span></div>`,
    chart(m.primary, { color: "#17a76f", height: 205, xLabels: timeAxis(m.primary.length, "1h") }),
    `<div class="row between tiny-text"><span>${esc(B("起始", "Period start"))}</span><span>${esc(B("当前", "Period end"))}</span></div></div>`,
    `<div class="card card-pad"><div class="section-head"><div><div class="card-title">${esc(B("Serverless 架构", "Serverless architecture"))}</div><div class="card-sub">${esc(B("自动伸缩工作负载运行机制", "How auto-scaling workloads behave"))}</div></div><i class="bi bi-layers"></i></div>`,
    `<div class="activity">`,
    [[B("请求队列", "Request queue"), B("接收并分发推理请求", "Accept and distribute incoming inference requests"), "lightning-charge-fill"],
     [B("GPU Workers", "GPU workers"), B("按 min–max 副本自动伸缩", "Scale from min to max worker count"), "hdd-stack"],
     [B("遥测", "Telemetry"), B("跟踪队列延迟、执行时长与错误", "Track queue delay, execution time and errors"), "activity"],
     [B("按量计费", "Usage-based billing"), B("成本取决于 GPU Worker 与执行时长", "Cost depends on GPU workers and execution"), "wallet2"]]
      .map((a) => `<div class="activity-item"><div class="activity-icon"><i class="bi bi-${a[2]}"></i></div><div><div class="activity-title">${esc(L(a[0]))}</div><div class="activity-meta">${esc(L(a[1]))}</div></div></div>`).join(""),
    `</div></div>`,
    `</div>`,

    // 选定端点工作台
    x
      ? [
          `<div class="layout-wide-side">`,
          `<div class="card card-pad">${section(L(x.name) + " · " + t("ep.workbench"), tabs([["overview", "ep.tab.overview"], ["playground", "ep.tab.playground"], ["versions", "ep.tab.versions"], ["models", "ep.tab.models"]], S.endpointTab, "endpointTab"))}`,
          S.endpointTab === "overview"
            ? [
                chart(m.primary, { second: m.secondary, height: 215, unit: "%", xLabels: timeAxis(m.primary.length, "1h") }),
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
