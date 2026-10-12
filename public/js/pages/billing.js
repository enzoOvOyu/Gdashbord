// 对齐原型 billingPage() / billingOverview() / billingDetails() / billingBudgets()
import { api } from "../api.js";
import { header, metric, section, btn, esc, money, chart, tabs, segmented, field, input } from "../ui.js";

export default async function billingPage(S) {
  const b = await api.billing();
  const t = S.billingTab;
  const colors = ["#2866f6", "#10b9b0", "#8c6ef0", "#f6a24b"];
  const p = Math.min(100, (b.monthCost / (b.budget || 10000)) * 100);
  const m = await api.metrics("gpu", S.billingRange === "7d" ? "24h" : "7d");

  return [
    header("费用中心与 FinOps", "按项目、工作负载和 GPU 规格分析成本，管理预算、用量配额与费用优化。",
      `<a class="btn" href="/api/billing/export">下载 CSV 账单</a>` + btn("＋ 充值演示", "recharge", "primary")),
    tabs([["overview", "费用概览"], ["details", "成本明细"], ["budgets", "预算与告警"]], t, "billingTab"),
    `<div class="grid cols-4 mb16">`,
    metric("账户余额", money(b.balance), "模拟账户 · 不涉及真实支付", "◉", ""),
    metric("本月累计消费", money(b.monthCost), "按资源 / 项目归因", "▦", "↓ 8.6%"),
    metric("推理调用成本", money((b.bills[1] || {}).cost || 0), "Serverless / Dedicated", "⚡", ""),
    metric("预算使用率", Math.round(p) + "%", "预算 " + money(b.budget), "◷", ""),
    `</div>`,
    t === "overview"
      ? [
          `<div class="split-65 mb16">`,
          `<div class="card card-pad">${section("费用趋势", segmented([["7d", "近7天"], ["30d", "近30天"]], S.billingRange, "billingRange"))}${chart(m.primary, { color: "#2866f6", height: 230 })}<div class="small muted">费用统计按 GPU 计算、存储、服务副本与网络拆分 · 示例数据</div></div>`,
          `<div class="card card-pad">${section("按工作负载分摊")}<div class="flex" style="gap:20px"><div class="donut"><div class="donut-inner">100%<small>成本分布</small></div></div><div class="legend" style="flex:1">${b.bills.map((x, i) => `<div class="legend-item"><span><i style="background:${colors[i]}"></i>${esc(x.name)}</span><b>${x.pct}%</b></div>`).join("")}</div></div></div>`,
          `</div>`,
          `<div class="layout-main-side">`,
          `<div class="card card-pad">${section("费用构成与资源归因", `<a href="javascript:void(0)" data-set="billingTab" data-value="details">查看明细 →</a>`)}`,
          b.bills.map((x, i) => `<div style="padding:11px 0"><div class="between"><div><b>${esc(x.name)}</b><div class="small muted" style="margin-top:4px">${esc(x.sub)}</div></div><b>${money(x.cost)}</b></div><div class="progress mt12"><span style="width:${x.pct}%;background:${colors[i]}"></span></div></div>`).join(""),
          `</div>`,
          `<div class="card card-pad">${section("成本优化建议")}<div class="callout mb12">⚡ 将低频 Endpoint 的最小副本设置为 0，降低空闲 GPU 成本。</div><div class="callout mb12">◷ 开发工作空间开启 2 小时空闲自动关机。</div><div class="callout">◈ 大型训练任务可评估预留资源与可中断计算，结合 Checkpoint 降低风险。</div></div></div>`,
        ].join("")
      : t === "details"
      ? `<div class="card card-pad">${section("资源级账单明细", `<span class="small muted">示例账单 · 非真实计费</span>`)}<div class="table-wrap"><table><thead><tr><th>资源名称</th><th>费用类型</th><th>GPU 规格</th><th>用量</th><th>示例单价</th><th>金额</th></tr></thead><tbody>${b.details.map((x) => `<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.type)}</td><td>${esc(x.gpu)}</td><td>${x.h} GPU小时(示例)</td><td>${money(x.price)}/h</td><td><strong>${money(x.amount)}</strong></td></tr>`).join("")}</tbody></table></div></div>`
      : [
          `<div class="layout-main-side">`,
          `<div class="card card-pad">${section("月度预算与阈值")}<div class="form-grid">`,
          field("月度预算（元）", `<input id="budget-input" type="number" min="100" step="100" value="${b.budget}"/>`),
          field("通知阈值", `<select><option>达到 80% 时提醒</option><option>达到 50% 时提醒</option><option>达到 95% 时提醒</option></select>`),
          `</div><div class="between mt16"><b>已使用 ${money(b.monthCost)}</b><b>${p.toFixed(1)}%</b></div><div class="progress mt12"><span style="width:${p}%"></span></div>`,
          `<div class="callout mt16">预算不等于硬性消费上限。真实系统应结合项目配额、服务副本上限、实例自动关机与告警通知。</div>`,
          btn("保存预算设置", "save-budget", "primary mt16"),
          `</div>`,
          `<div class="card card-pad">${section("成本治理")}<div class="grid" style="gap:12px">`,
          [["项目成本中心", "按项目 / 标签聚合 GPU 消费"], ["用量配额", "GPU 卡数、Endpoint 副本、存储限额"], ["异常消费检测", "费用突增、空闲 GPU、低利用率"], ["资源生命周期", "自动关机、Scale-to-Zero、过期释放"]]
            .map((x) => `<div class="flex"><span class="pill blue">✓</span><div><b>${x[0]}</b><div class="small muted" style="margin-top:4px">${x[1]}</div></div></div>`).join(""),
          `</div></div></div>`,
        ].join(""),
  ].join("");
}
