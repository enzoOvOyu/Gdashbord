// 对齐原型 monitorPage() / alertsView() / eventsTable()
import { api } from "../api.js";
import { header, metric, section, btn, esc, status, chart, tabs, segmented } from "../ui.js";

function eventsTable(events) {
  return `<div class="table-wrap"><table><thead><tr><th>级别</th><th>时间</th><th>资源</th><th>事件描述</th><th>操作</th></tr></thead><tbody>${events.map((e, i) => `<tr><td>${status(e.level)}</td><td>${esc(e.time)}</td><td>${i % 2 ? "训练任务" : "推理服务"}</td><td>${esc(e.text)}</td><td>${btn("查看详情", "event:" + i, "sm")}</td></tr>`).join("")}</tbody></table></div>`;
}

export default async function monitorPage(S) {
  const t = S.monitorTab;
  const evRes = await api.events();
  const events = evRes.events || [];
  const m = await api.metrics(t === "alerts" ? "gpu" : t, S.monitorRange);
  const v = m.values || ["—", "—", "—", "—"];

  return [
    header("可观测性与告警", "从 GPU 设备指标深入到模型吞吐、推理延迟、训练进度和服务 SLO。", btn("＋ 创建告警规则", "new-alert", "primary")),
    tabs([["gpu", "GPU 与容器"], ["inference", "推理服务"], ["jobs", "训练任务"], ["alerts", "告警事件"]], t, "monitorTab"),
    `<div class="card filterbar mb16">`,
    `<select data-set="monitorTarget">${[...(S.instances || []).map((x) => [x.id, "Workspace · " + x.name]), ...(S.endpoints || []).map((x) => [x.id, "Endpoint · " + x.name]), ...(S.jobs || []).map((x) => [x.id, "Job · " + x.name])].map((it) => `<option value="${it[0]}" ${S.monitorTarget === it[0] ? "selected" : ""}>${esc(it[1])}</option>`).join("")}</select>`,
    segmented([["1h", "1小时"], ["24h", "24小时"], ["7d", "7天"]], S.monitorRange, "monitorRange"),
    btn("↻ 刷新指标", "refresh", "sm"),
    `<span class="small muted">指标来自 /api/monitor/metrics</span>`,
    `</div>`,
    t === "alerts"
      ? [
          `<div class="grid cols-3 mb16">`,
          metric("活跃告警", events.filter((e) => e.level === "warning").length, "等待处理", "!", ""),
          metric("已配置规则", "8", "GPU / API / Job", "▤", ""),
          metric("SLO 达标率", "99.95%", "近 30 天", "✓", ""),
          `</div>`,
          `<div class="card card-pad">${section("告警与事件流", btn("新增告警规则", "new-alert", "sm primary"))}`,
          eventsTable(events),
          `<div class="callout mt16">推荐阈值：GPU 温度 > 85℃、GPU 显存 > 90%、Endpoint p95 延迟 > 500ms、推理错误率 > 1%、训练任务连续失败。</div></div>`,
        ].join("")
      : [
          `<div class="grid cols-4 mb16">`,
          metric(t === "inference" ? "请求吞吐" : "GPU 利用率", v[0], "实时趋势", "▦", "↗ 8.2%"),
          metric(t === "inference" ? "p95 延迟" : t === "jobs" ? "训练 Loss" : "GPU 显存占用", v[1], "窗口内平均", "◈", ""),
          metric(t === "inference" ? "错误率" : t === "jobs" ? "已分配 GPU" : "CPU 利用率", v[2], "监控采样", "⌘", ""),
          metric(t === "inference" ? "活跃副本" : t === "jobs" ? "运行时长" : "网络吞吐", v[3], "当前状态", "⇄", ""),
          `</div>`,
          `<div class="grid cols-2 mb16">`,
          `<div class="card card-pad">${section(t === "inference" ? "QPS / 请求量" : t === "jobs" ? "训练 Loss 曲线" : "GPU 利用率", `<span class="pill blue">LIVE</span>`)}${chart(m.primary, { height: 225 })}</div>`,
          `<div class="card card-pad">${section(t === "inference" ? "p50 / p95 延迟" : t === "jobs" ? "GPU 利用率与梯度" : "显存 / CPU 占用")}${chart(m.primary, { second: m.secondary, color2: "#815ce9", height: 225 })}<div class="flex small muted"><span style="color:#2866f6">● 主指标</span><span style="color:#815ce9">● 对比指标</span></div></div>`,
          `<div class="card card-pad">${section(t === "inference" ? "自动伸缩 / 活跃容器" : t === "jobs" ? "Checkpoint / 任务进度" : "网络入站 / 出站")}${chart(m.secondary, { color: "#10b9b0", second: m.primary, color2: "#2866f6", height: 225 })}</div>`,
          `<div class="card card-pad">${section(t === "inference" ? "TTFT / Token 生成速度" : t === "jobs" ? "GPU 温度与功耗" : "GPU 温度 / 功耗")}${chart(m.primary, { color: "#ef9a3b", second: m.secondary, color2: "#815ce9", height: 225 })}</div>`,
          `</div>`,
          `<div class="card card-pad">${section("最近事件与告警", `<a href="javascript:void(0)" data-set="monitorTab" data-value="alerts">全部告警 →</a>`)}${eventsTable(events)}</div>`,
        ].join(""),
  ].join("");
}
