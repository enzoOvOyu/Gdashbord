// 可观测性：GPU / 推理 / 训练 / 告警（USD 无关，统一图表配色与状态语义）
import { api } from "../api.js";
import { header, metric, section, btn, esc, status, chart, tabs, segmented, t, L } from "../ui.js";

const S2 = (zh, en) => ({ zh, en });

function eventsTable(events) {
  return `<div class="table-wrap"><table><thead><tr><th>${esc(L(S2("级别", "Level")))}</th><th>${esc(L(S2("时间", "Time")))}</th><th>${esc(L(S2("资源", "Resource")))}</th><th>${esc(L(S2("事件描述", "Description")))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>${events.map((e, i) => `<tr><td>${status(e.level)}</td><td>${esc(e.time)}</td><td>${i % 2 ? esc(L(S2("训练任务", "Training job"))) : esc(L(S2("推理服务", "Inference")))}</td><td>${esc(L(e.text))}</td><td>${btn("common.detail", "event:" + i, "sm")}</td></tr>`).join("")}</tbody></table></div>`;
}

export default async function monitorPage(S) {
  const tab = S.monitorTab;
  const evRes = await api.events();
  const events = evRes.events || [];
  const m = await api.metrics(tab === "alerts" ? "gpu" : tab, S.monitorRange);
  const v = ((m.values && m.values.length ? m.values : ["—", "—", "—", "—"]).map((x) => L(x))).slice(0, 4);
  while (v.length < 4) v.push("—");

  return [
    header("mon.title", S2("从 GPU 设备指标深入到模型吞吐、推理延迟、训练进度和服务 SLO。", "From GPU device metrics to model throughput, inference latency, training progress and service SLOs."), btn(S2("＋ 创建告警规则", "＋ New alert rule"), "new-alert", "primary")),
    tabs([["gpu", S2("GPU 与容器", "GPU & containers")], ["inference", S2("推理服务", "Inference")], ["jobs", S2("训练任务", "Training")], ["alerts", S2("告警事件", "Alerts")]], tab, "monitorTab"),
    `<div class="card filterbar mb16">`,
    `<select data-set="monitorTarget">${[...(S.instances || []).map((x) => [x.id, "Workspace · " + x.name]), ...(S.endpoints || []).map((x) => [x.id, "Endpoint · " + x.name]), ...(S.jobs || []).map((x) => [x.id, "Job · " + x.name])].map((it) => `<option value="${it[0]}" ${S.monitorTarget === it[0] ? "selected" : ""}>${esc(it[1])}</option>`).join("")}</select>`,
    segmented([["1h", S2("1小时", "1h")], ["24h", S2("24小时", "24h")], ["7d", S2("7天", "7d")]], S.monitorRange, "monitorRange"),
    btn(S2("↻ 刷新指标", "↻ Refresh"), "refresh", "sm"),
    `<span class="small muted">/api/monitor/metrics</span>`,
    `</div>`,
    tab === "alerts"
      ? [
          `<div class="grid cols-3 mb16">`,
          metric(S2("活跃告警", "Active alerts"), events.filter((e) => e.level === "warning").length, S2("等待处理", "Pending"), "<i class='bi bi-exclamation-triangle'></i>", ""),
          metric(S2("已配置规则", "Rules"), 8, "GPU / API / Job", "<i class='bi bi-hdd-stack'></i>", ""),
          metric(S2("SLO 达标率", "SLO compliance"), "99.95%", S2("近 30 天", "Last 30 days"), "<i class='bi bi-check2-circle'></i>", ""),
          `</div>`,
          `<div class="card card-pad">${section(S2("告警与事件流", "Alert & event stream"), btn(S2("新增告警规则", "New rule"), "new-alert", "sm primary"))}`,
          eventsTable(events),
          `<div class="callout mt16">${esc(L(S2("推荐阈值：GPU 温度 > 85℃、GPU 显存 > 90%、Endpoint p95 延迟 > 500ms、推理错误率 > 1%、训练任务连续失败。", "Recommended thresholds: GPU temp > 85℃, GPU memory > 90%, endpoint p95 > 500ms, error rate > 1%, repeated job failures.")))}</div></div>`,
        ].join("")
      : [
          `<div class="grid cols-4 mb16">`,
          metric(tab === "inference" ? S2("请求吞吐", "Request throughput") : S2("机队利用率", "Fleet utilization"), v[0], S2("实时趋势", "Live trend"), "<i class='bi bi-cpu'></i>", "↗ 8.2%"),
          metric(tab === "inference" ? S2("p95 延迟", "p95 latency") : tab === "jobs" ? S2("训练 Loss", "Training loss") : S2("机队均温", "Fleet temp"), v[1], S2("窗口内平均", "Window average"), "<i class='bi bi-box-seam'></i>", ""),
          metric(tab === "inference" ? S2("错误率", "Error rate") : tab === "jobs" ? S2("已分配 GPU", "GPUs allocated") : S2("机队功耗", "Fleet power"), v[2], S2("监控采样", "Sampling"), "<i class='bi bi-terminal'></i>", ""),
          metric(tab === "inference" ? S2("活跃副本", "Active replicas") : tab === "jobs" ? S2("运行时长", "Runtime") : S2("机队集群", "Fleet clusters"), v[3], S2("当前状态", "Current"), "<i class='bi bi-hdd-rack'></i>", ""),
          `</div>`,
          (m.fleet && tab === "gpu")
            ? `<div class="status-strip mb16">
                <div><span>${esc(L(S2("在线 GPU", "Online GPUs")))}</span><b>${(m.fleet.online || 0).toLocaleString()}</b></div>
                <div><span>${esc(L(S2("已分配", "Allocated")))}</span><b>${(m.fleet.allocated || 0).toLocaleString()}</b></div>
                <div><span>${esc(L(S2("可分配", "Free")))}</span><b>${(m.fleet.free || 0).toLocaleString()}</b></div>
                <div><span>${esc(L(S2("降级集群", "Degraded")))}</span><b>${m.fleet.degraded || 0}</b></div>
                <div><span>${esc(L(S2("维护集群", "Maintenance")))}</span><b>${m.fleet.maintenance || 0}</b></div>
                <div><span>${esc(L(S2("碳排", "Carbon")))}</span><b>${(m.fleet.totalCarbon || 0).toLocaleString()} kg/h</b></div>
                <div><span>${esc(L(S2("功耗", "Power")))}</span><b>${Math.round(m.fleet.totalPower || 0).toLocaleString()} kW</b></div>
              </div>`
            : "",
          `<div class="grid cols-2 mb16">`,
          `<div class="card card-pad">${section(tab === "inference" ? S2("QPS / 请求量", "QPS / requests") : tab === "jobs" ? S2("训练 Loss 曲线", "Training loss") : S2("GPU 利用率", "GPU utilization"), `<span class="pill blue">LIVE</span>`)}${chart(m.primary, { height: 225 })}</div>`,
          `<div class="card card-pad">${section(tab === "inference" ? S2("p50 / p95 延迟", "p50 / p95 latency") : tab === "jobs" ? S2("GPU 利用率与梯度", "Utilization & gradients") : S2("显存 / CPU 占用", "Memory / CPU"))}${chart(m.primary, { second: m.secondary, color2: "#34383b", height: 225 })}<div class="flex small muted"><span style="color:#ff6000">● ${esc(L(S2("主指标", "Primary")))}</span><span style="color:#34383b">● ${esc(L(S2("对比指标", "Secondary")))}</span></div></div>`,
          `<div class="card card-pad">${section(tab === "inference" ? S2("自动伸缩 / 活跃容器", "Autoscaling / containers") : tab === "jobs" ? S2("Checkpoint / 任务进度", "Checkpoints / progress") : S2("网络入站 / 出站", "Network in / out"))}${chart(m.secondary, { color: "#f9a825", second: m.primary, color2: "#ff6000", height: 225 })}</div>`,
          `<div class="card card-pad">${section(tab === "inference" ? S2("TTFT / Token 生成速度", "TTFT / tokens per second") : tab === "jobs" ? S2("GPU 温度与功耗", "GPU temp & power") : S2("GPU 温度 / 功耗", "GPU temp / power"))}${chart(m.primary, { color: "#ff6a48", second: m.secondary, color2: "#34383b", height: 225 })}</div>`,
          `</div>`,
          `<div class="card card-pad">${section(S2("最近事件与告警", "Recent events"), `<a href="javascript:void(0)" data-set="monitorTab" data-value="alerts">${esc(L(S2("全部告警 →", "All alerts →")))}</a>`)}${eventsTable(events)}</div>`,
        ].join(""),
  ].join("");
}
