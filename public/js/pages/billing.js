// 费用中心：USD 计价，成本由各模块真实状态实算
import { api } from "../api.js";
import { header, metric, section, btn, esc, money, chart, tabs, segmented, field, input, status, t, L } from "../ui.js";

const S = (zh, en) => ({ zh, en });
const colors = ["#ff6000", "#f9a825", "#34383b", "#ffcc32"];

export default async function billingPage(S0) {
  const b = await api.billing();
  const tab = S0.billingTab;
  const p = Math.min(100, (b.monthCost / (b.budget || 30000)) * 100);
  const m = await api.metrics("gpu", S0.billingRange === "7d" ? "24h" : "7d");

  return [
    header(S("费用中心与 FinOps", "Billing & FinOps"), S("按项目、工作负载和 GPU 规格分析成本，管理预算、用量配额与费用优化。", "Analyze cost by project, workload and GPU SKU; manage budget, quotas and optimization."),
      `<a class="btn" href="/api/billing/export">${esc(t("common.copy"))} CSV</a>` + btn(S("＋ 账户充值", "＋ Add credits"), "recharge", "primary")),
    tabs([["overview", S("费用概览", "Overview")], ["details", S("成本明细", "Line items")], ["budgets", S("预算与告警", "Budget & alerts")]], tab, "billingTab"),
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric(S("账户余额", "Balance"), money(b.balance), S("模拟账户 · USD", "Demo account · USD"), "<i class='bi bi-cash-stack'></i>", "", "hero"),
    metric(S("月度预估消费", "Monthly estimate"), money(b.monthCost), `${b.hoursPerMonth || 730}h · ${b.gpuCount || 0} GPU`, "<i class='bi bi-cpu'></i>", "↓ 8.6%", ""),
    metric(S("当前小时费率", "Current hourly rate"), money(b.hourlyCost || 0), S("含存储与快照", "Incl. storage & snapshots"), "<i class='bi bi-lightning-charge-fill'></i>", "", ""),
    metric(S("预算使用率", "Budget used"), Math.round(p) + "%", L(S("月度预算", "Monthly budget")) + " " + money(b.budget), "<i class='bi bi-clock-history'></i>", "", ""),
    `</div>`,
    tab === "overview"
      ? [
          `<div class="split-65 mb16">`,
          `<div class="card card-pad">${section(S("费用趋势", "Cost over time"), segmented([["7d", S("近7天", "7d")], ["30d", S("近30天", "30d")]], S0.billingRange, "billingRange"))}`,
          `<div class="billing-total">${money(b.monthCost)} <span class="pill orange">+ 12.6%</span></div>`,
          `${chart(m.primary, { color: "#ff6000", height: 205 })}<div class="row between tiny-text"><span>${esc(L(S("期初", "Period start")))}</span><span>${esc(L(S("期末", "Period end")))}</span></div><div class="small muted mt12">${esc(t("common.demo"))} · USD</div></div>`,
          `<div class="card card-pad">${section(S("按工作负载分摊", "Cost breakdown"))}`,
          `<div class="stacked">${b.bills.map((x, i) => `<i style="width:${x.pct}%;background:${colors[i]}"></i>`).join("")}</div>`,
          `<div class="bill-breakdown">${b.bills.map((x, i) => `<div class="bill-row"><span class="bill-mark" style="background:${colors[i]}"></span><span class="bill-name">${esc(L(x.name))} <span class="tiny-text">${x.pct}%</span></span><span class="bill-val">${money(x.cost)}</span></div>`).join("")}</div>`,
          `<div class="separator"></div>`,
          `<div class="notice"><i class="bi bi-info-circle"></i> ${esc(L(S("成本按工作负载实算（集群容量不计入独立行，避免与运行负载重复）。", "Costs computed from live workloads (cluster capacity excluded to avoid double counting).")))} </div></div>`,
          `</div>`,
          `<div class="layout-main-side">`,
          `<div class="card card-pad">${section(S("费用构成与资源归因", "Cost breakdown"), `<a href="javascript:void(0)" data-set="billingTab" data-value="details">${esc(L(S("查看明细 →", "View details →")))}</a>`)}`,
          b.bills.map((x, i) => `<div style="padding:11px 0"><div class="between"><div><b>${esc(L(x.name))}</b><div class="small muted" style="margin-top:4px">${esc(L(x.sub))}</div></div><b>${money(x.cost)}</b></div><div class="progress mt12"><span style="width:${x.pct}%;background:${colors[i]}"></span></div></div>`).join(""),
          `</div>`,
          `<div class="card card-pad">${section(S("成本优化建议", "Optimization tips"))}<div class="callout mb12"><i class='bi bi-lightning-charge-fill'></i> ${esc(L(S("将低频 Endpoint 的最小副本设置为 0，降低空闲 GPU 成本。", "Set min replicas to 0 for low-traffic endpoints to cut idle GPU cost.")))}</div><div class="callout mb12"><i class='bi bi-clock-history'></i> ${esc(L(S("开发工作空间开启 2 小时空闲自动关机。", "Enable 2-hour idle auto-shutdown for dev workspaces.")))}</div><div class="callout"><i class='bi bi-box-seam'></i> ${esc(L(S("大型训练任务可评估预留资源与可中断计算，结合 Checkpoint 降低风险。", "For large training, evaluate reserved and interruptible capacity with checkpointing.")))}</div></div></div>`,
        ].join("")
      : tab === "details"
      ? `<div class="card card-pad">${section(S("资源级账单明细", "Resource-level line items"), `<span class="small muted">USD · ${b.hoursPerMonth || 730}h</span>`)}<div class="table-wrap"><table><thead><tr><th>${esc(L(S("资源名称", "Resource")))}</th><th>${esc(L(S("费用类型", "Category")))}</th><th>${esc(t("common.gpu"))}</th><th>${esc(t("common.region"))}</th><th>${esc(t("common.status"))}</th><th>${esc(L(S("小时费率", "Hourly")))}</th><th>USD / ${b.hoursPerMonth || 730}h</th></tr></thead><tbody>${b.details.map((x) => `<tr><td><strong>${esc(x.name)}</strong><small>${esc(x.id)}</small></td><td>${esc(L(x.kindLabel))}</td><td>${esc(x.gpu)} × ${x.count}</td><td>${esc(x.region)}</td><td>${status(x.status)}</td><td>${money(x.hourly)}</td><td><strong>${money(x.monthly)}</strong></td></tr>`).join("")}</tbody></table></div></div>`
      : [
          `<div class="layout-main-side">`,
          `<div class="card card-pad">${section(S("月度预算与阈值", "Monthly budget & thresholds"))}<div class="form-grid">`,
          field(S("月度预算（USD）", "Monthly budget (USD)"), `<input id="budget-input" type="number" min="100" step="100" value="${b.budget}"/>`),
          field(S("通知阈值", "Alert threshold"), `<select><option>80%</option><option>50%</option><option>95%</option></select>`),
          `</div><div class="between mt16"><b>${esc(L(S("已使用", "Used")))} ${money(b.monthCost)}</b><b>${p.toFixed(1)}%</b></div><div class="progress mt12"><span style="width:${p}%"></span></div>`,
          `<div class="callout mt16">${esc(L(S("预算不等于硬性消费上限。真实系统应结合项目配额、服务副本上限、实例自动关机与告警通知。", "A budget is not a hard cap. Production systems combine quotas, replica limits, auto-shutdown and alerts.")))}</div>`,
          btn(S("保存预算设置", "Save budget"), "save-budget", "primary mt16"),
          `</div>`,
          `<div class="card card-pad">${section(S("成本治理", "Cost governance"))}<div class="grid" style="gap:12px">`,
          [[S("项目成本中心", "Project cost center"), S("按项目 / 标签聚合 GPU 消费", "Aggregate GPU spend by project / tag")],
           [S("用量配额", "Usage quotas"), S("GPU 卡数、Endpoint 副本、存储限额", "GPU count, endpoint replicas, storage caps")],
           [S("异常消费检测", "Anomaly detection"), S("费用突增、空闲 GPU、低利用率", "Spend spikes, idle GPUs, low utilization")],
           [S("资源生命周期", "Resource lifecycle"), S("自动关机、Scale-to-Zero、过期释放", "Auto-shutdown, scale-to-zero, expiry")]]
            .map((x) => `<div class="flex"><span class="pill blue"><i class='bi bi-check2-circle'></i></span><div><b>${esc(L(x[0]))}</b><div class="small muted" style="margin-top:4px">${esc(L(x[1]))}</div></div></div>`).join(""),
          `</div></div></div>`,
        ].join(""),
  ].join("");
}
