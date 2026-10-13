// 对齐原型 overview()
import { api } from "../api.js";
import { header, metric, section, btn, chart, status, money, esc, segmented } from "../ui.js";

export default async function overview(S) {
  const range = S.overviewRange === "30d" ? "7d" : "24h";
  const [ov, m] = await Promise.all([api.overview(), api.metrics("gpu", range)]);
  const monthCost = ov.metrics.monthCost;
  const runningGpus = (S.instances || []).filter((x) => x.status === "running").reduce((a, x) => a + (x.count || 1), 0);
  const gpuUtil = Math.round(m.primary[m.primary.length - 1] || 0);
  const billColors = ["#ff6000", "#f9a825", "#34383b", "#ffcc32"];

  return [
    header("云上 AI 工作台", "从 GPU 开发到训练与推理：统一查看工作负载、服务健康、资源消耗与成本。",
      btn("＋ 创建工作负载", "go-create", "primary") + btn("查看使用指南", "about")),
    `<div class="banner mb16"><div><div style="font-size:10px;letter-spacing:1.8px;opacity:.8;margin-bottom:7px">RUNSUN CLOUD · THE GPU CLOUD</div><h2>为 AI 工作负载量身定制的 NVIDIA GPU 算力</h2><p>选择开发工作空间、训练任务或推理 Endpoint，按工作负载弹性分配算力。<br>支持模型与数据复用、自动伸缩、服务级监控及成本归因。</p></div>${btn("<i class='bi bi-lightning-charge-fill'></i> 部署模型服务", "go-endpoint", "primary")}</div>`,
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric("本月云资源消费", money(monthCost), "预算使用率 " + Math.round((monthCost / (ov.budget || 10000)) * 100) + "%", "<i class='bi bi-cash-stack'></i>", "↓ 8.6%", "hero"),
    metric("活跃工作空间", ov.metrics.workspaces, "GPU Pod / Workspace", "<i class='bi bi-hdd-stack'></i>", "↗ 12%"),
    metric("在线推理服务", ov.metrics.endpoints, "可用 Endpoint / " + (S.endpoints || []).length, "<i class='bi bi-lightning-charge-fill'></i>", "99.95% 可用"),
    metric("训练任务成功率", ov.metrics.jobSuccessRate, "近 7 天 · 128 个任务", "<i class='bi bi-terminal'></i>", "↗ 2.4%"),
    `</div>`,
    `<div class="status-strip mb16">`,
    `<div><span>服务可用性</span><b>99.95% <span class="pill green sm"><i class="dot"></i>正常</span></b></div>`,
    `<div><span>GPU 平均利用率</span><b>${gpuUtil}%</b></div>`,
    `<div><span>运行中 GPU 卡</span><b>${runningGpus} 张</b></div>`,
    `<div><span>调度成功率</span><b>${ov.metrics.jobSuccessRate}</b></div>`,
    `<div><span>账户余额</span><b>${money(ov.balance || 0)}</b></div>`,
    `</div>`,
    `<div class="grid cols-3 mb16">`,
    `<div class="card quick-card" data-nav="create" data-mode="workspace"><div class="quick-icon"><i class='bi bi-terminal'></i></div><div><h3>GPU 开发工作空间 →</h3><p>PyTorch / Jupyter / VS Code / SSH<br>持久化数据卷，按需启动与自动关机</p></div></div>`,
    `<div class="card quick-card" data-nav="create" data-mode="job"><div class="quick-icon" style="background:#f1edff;color:#815ce9"><i class='bi bi-cpu'></i></div><div><h3>提交训练 / 批处理任务 →</h3><p>任务队列、断点续训、分布式集群<br>数据集挂载与产物管理</p></div></div>`,
    `<div class="card quick-card" data-nav="create" data-mode="endpoint"><div class="quick-icon" style="background:#e6fbf5;color:#0e9e85"><i class='bi bi-lightning-charge-fill'></i></div><div><h3>部署模型推理 Endpoint →</h3><p>vLLM / SGLang · OpenAI 兼容 API<br>自动扩缩容、请求监控与版本管理</p></div></div>`,
    `</div>`,
    `<div class="split-65 mb16">`,
    `<div class="card card-pad">${section("云资源与调用趋势", segmented([["7d", "近7天"], ["30d", "近30天"]], S.overviewRange, "overviewRange"))}`,
    chart(m.primary, { second: m.secondary, height: 220, startText: "起始", endText: "现在" }),
    `<div class="flex small muted"><span class="blue">● GPU 使用率</span><span class="purple">● Endpoint 请求量（归一化）</span><span style="margin-left:auto">数据来自 /api/monitor/metrics</span></div></div>`,
    `<div class="card card-pad">${section("成本结构", `<a data-nav="billing" href="javascript:void(0)">查看费用 →</a>`)}`,
    `<div class="flex" style="gap:18px;margin-top:15px"><div class="donut"><div class="donut-inner">${money(monthCost)}<small>本月消费</small></div></div>`,
    `<div class="legend" style="flex:1">${ov.bills.map((b, i) => `<div class="legend-item"><span><i style="background:${billColors[i]}"></i>${esc(b.name)}</span><b>${b.pct}%</b></div>`).join("")}</div></div>`,
    `<div class="callout mt16">成本优化建议：低频推理服务启用 Scale-to-Zero，空闲开发工作空间开启自动关机。</div></div>`,
    `</div>`,
    `<div class="layout-main-side">`,
    `<div class="card card-pad">${section("最近工作负载", `<a data-nav="instances" href="javascript:void(0)">全部资源 →</a>`)}`,
    `<div class="table-wrap"><table><thead><tr><th>名称 / 类型</th><th>资源配置</th><th>状态</th><th>运行区域</th><th>操作</th></tr></thead><tbody>`,
    ov.instances.map((x) => `<tr><td><strong>${esc(x.name)}</strong><small>${esc(x.kind)}</small></td><td>${esc(x.gpu)} × ${x.count}</td><td>${status(x.status)}</td><td>${esc(x.region)}</td><td>${btn("查看", "instance:" + x.id, "sm")}</td></tr>`).join(""),
    ov.endpoints.map((x) => `<tr><td><strong>${esc(x.name)}</strong><small>推理 Endpoint</small></td><td>${esc(x.model)}</td><td>${status(x.status)}</td><td>多区域</td><td>${btn("查看", "endpoint:" + x.id, "sm")}</td></tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="card card-pad">${section("运行事件与告警", `<a data-nav="monitor" href="javascript:void(0)">查看监控 →</a>`)}`,
    ov.events.map((e) => `<div style="padding:11px 0;border-bottom:1px solid #edf1f7"><div class="between">${status(e.level)}<span class="right-muted">${esc(e.time)}</span></div><div class="small" style="margin-top:8px;line-height:1.5">${esc(e.text)}</div></div>`).join(""),
    `</div></div>`,
  ].join("");
}
