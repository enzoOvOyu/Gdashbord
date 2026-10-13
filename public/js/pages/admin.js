// 平台管理后台：总览 / 租户与用户 / 资源与配额 / 计费与价格 / 运维与审计
import { api } from "../api.js";
import { header, metric, section, btn, esc, status, tabs, money, moneyShort, t, L } from "../ui.js";

const ROLE_KEY = { owner: "ad.role.owner", admin: "ad.role.admin", developer: "ad.role.developer", viewer: "ad.role.viewer", billing: "ad.role.billing" };
const ROLE_PILL = { owner: "purple", admin: "blue", developer: "green", viewer: "gray", billing: "amber" };

function roleTag(role) {
  return `<span class="pill ${ROLE_PILL[role] || "gray"}"><i class="dot"></i>${esc(t(ROLE_KEY[role] || "ad.role.viewer"))}</span>`;
}

// ===== 1) 平台总览 =====
function overviewView(ov, cost, platform, admin) {
  const k = ov.kpi;
  return [
    `<div class="grid cols-3 mb16 kpi-row">`,
    metric("ad.kpi.tenants", `${k.tenants} / ${k.tenantsTotal}`, "ad.kpi.tenants.desc", "<i class='bi bi-buildings'></i>", "", "hero"),
    metric("ad.kpi.users", k.users, `${k.usersActive} ${esc(t("ad.kpi.users.desc"))}`, "<i class='bi bi-people'></i>", ""),
    metric("ad.kpi.fleet", k.fleetTotal, "ad.kpi.fleet.desc", "<i class='bi bi-gpu-card'></i>", ""),
    `</div>`,
    `<div class="grid cols-3 mb16 kpi-row">`,
    metric("ad.kpi.util", k.utilization + "%", `${k.fleetAllocated} / ${k.fleetTotal}`, "<i class='bi bi-speedometer2'></i>", ""),
    metric("ad.kpi.mrr", moneyShort(k.mrr), "ad.kpi.mrr.desc", "<i class='bi bi-cash-coin'></i>", ""),
    metric("ad.kpi.tickets", k.openTickets, "ad.kpi.tickets.desc", "<i class='bi bi-life-preserver'></i>", ""),
    `</div>`,
    `<div class="split-65 mb16">`,
    `<div class="card card-pad">${section("ad.cap.region")}<div class="table-wrap"><table><thead><tr><th>${esc(t("common.region"))}</th><th>${esc(t("ad.cap.total"))}</th><th>${esc(t("ad.cap.allocated"))}</th><th>${esc(t("ad.cap.free"))}</th><th>${esc(t("ad.cap.util"))}</th></tr></thead><tbody>`,
    ov.regions.map((r) => {
      const pct = r.total ? Math.round((r.allocated / r.total) * 100) : 0;
      return `<tr><td><strong>${esc(L(r.name))}</strong></td><td>${r.total}</td><td>${r.allocated}</td><td>${r.free}</td><td style="min-width:120px"><div class="progress sm"><span style="width:${pct}%"></span></div><small>${pct}%</small></td></tr>`;
    }).join(""),
    `</tbody></table></div></div>`,
    `<div class="card card-pad">${section("ad.ops.health")}`,
    (ov.services || []).map((s) => `<div class="between" style="padding:9px 0;border-bottom:1px solid #edf1f7"><div><b class="small">${esc(L(s.name))}</b><div class="small muted">${esc(t("ad.ops.latency"))} ${esc(s.p95)} · ${esc(t("ad.ops.uptime"))} ${esc(s.uptime)}</div></div>${status(s.status)}</div>`).join(""),
    `</div></div>`,
    `<div class="layout-main-side">`,
    `<div class="card card-pad">${section("ad.audit.title")}<div class="table-wrap"><table><thead><tr><th>${esc(t("ad.audit.time"))}</th><th>${esc(t("ad.audit.actor"))}</th><th>${esc(t("ad.audit.action"))}</th><th>${esc(t("ad.audit.target"))}</th><th>${esc(t("ad.audit.result"))}</th></tr></thead><tbody>`,
    (ov.recentAudit || []).map((a) => `<tr><td>${esc(a.time)}</td><td>${esc(a.actor)}</td><td>${esc(L(a.action))}</td><td>${esc(a.target)}</td><td>${status(a.result)}</td></tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="card card-pad">${section("ad.ticket.title")}`,
    (ov.announcements || []).map((a) => `<div style="padding:10px 0;border-bottom:1px solid #edf1f7">${status(a.level)}<div class="small" style="margin-top:7px;line-height:1.5">${esc(L(a.title))}</div><div class="small muted">${esc(a.date)}</div></div>`).join(""),
    `<div class="mt16">${btn("ad.btn.publish", "admin-announce", "sm block")}</div>`,
    `<div class="callout mt16">${esc(t("ad.demo"))}</div></div></div>`,
  ].join("");
}

// ===== 2) 租户与用户 =====
function tenantsView(data, S) {
  const tenants = data.tenants || [];
  const users = data.users || [];
  const rows = S.adminTenant === "all" ? users : users.filter((u) => u.tenant === S.adminTenant);
  return [
    `<div class="card card-pad mb16">${section("ad.tenant.th", btn("ad.btn.newTenant", "admin-new-tenant", "sm"))}<div class="table-wrap"><table>
      <thead><tr><th>${esc(t("ad.tenant.th"))}</th><th>${esc(t("ad.tenant.plan"))}</th><th>${esc(t("ad.tenant.region"))}</th><th>${esc(t("ad.tenant.quota"))}</th><th>${esc(t("ad.tenant.users"))}</th><th>${esc(t("ad.tenant.spend"))}</th><th>${esc(t("ad.tenant.status"))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>`,
    tenants.map((x) => `<tr>
      <td><strong>${esc(x.name)}</strong><small>${esc(x.id)} · ${esc(x.contact)}</small></td>
      <td><span class="tag">${esc(x.plan)}</span></td>
      <td>${esc(x.region)}</td>
      <td>${x.gpuUsed} / ${x.gpuQuota}<div class="progress sm"><span style="width:${Math.round((x.gpuUsed / x.gpuQuota) * 100)}%"></span></div></td>
      <td>${x.members}</td>
      <td>${money(x.spend)}</td>
      <td>${status(x.status)}</td>
      <td><div class="table-actions">${btn("ad.btn.edit", "admin-quota:" + x.id, "sm")}${x.status === "active" ? btn("ad.btn.suspend", "admin-tenant-status:" + x.id + ":suspended", "sm danger") : btn("ad.btn.enable", "admin-tenant-status:" + x.id + ":active", "sm")}</div></td>
    </tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="card card-pad mb16">${section("ad.user.th", btn("ad.btn.invite", "admin-invite", "sm primary"))}`,
    `<div class="filterbar mb16"><select data-set="adminTenant">${[["all", t("common.all")], ...tenants.map((x) => [x.name, x.name])].map((o) => `<option value="${esc(o[0])}" ${String(o[0]) === String(S.adminTenant) ? "selected" : ""}>${esc(L(o[1]))}</option>`).join("")}</select></div>`,
    `<div class="table-wrap"><table><thead><tr><th>${esc(t("ad.user.th"))}</th><th>${esc(t("ad.user.email"))}</th><th>${esc(t("ad.user.tenant"))}</th><th>${esc(t("ad.user.role"))}</th><th>${esc(t("ad.user.mfa"))}</th><th>${esc(t("ad.user.last"))}</th><th>${esc(t("common.status"))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>`,
    rows.map((u) => `<tr>
      <td><strong>${esc(u.name)}</strong><small>${esc(u.id)}</small></td>
      <td>${esc(u.email)}</td>
      <td>${esc(u.tenant)}</td>
      <td><select data-admin-role="${esc(u.id)}" aria-label="role">${Object.keys(ROLE_KEY).map((r) => `<option value="${r}" ${u.role === r ? "selected" : ""}>${esc(t(ROLE_KEY[r]))}</option>`).join("")}</select></td>
      <td>${u.mfa ? `<span class="pill green"><i class="dot"></i>${esc(t("common.enabled"))}</span>` : `<span class="pill gray"><i class="dot"></i>${esc(t("common.disabled"))}</span>`}</td>
      <td>${esc(u.last)}</td>
      <td>${status(u.status)}</td>
      <td><div class="table-actions">${u.status === "active" ? btn("ad.btn.suspend", "admin-user-status:" + u.id + ":suspended", "sm danger") : btn("ad.btn.enable", "admin-user-status:" + u.id + ":active", "sm")}</div></td>
    </tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="card card-pad">${section("ad.matrix.title")}<div class="table-wrap"><table><thead><tr><th>${esc(t("ad.matrix.perm"))}</th>${Object.keys(ROLE_KEY).map((r) => `<th>${esc(t(ROLE_KEY[r]))}</th>`).join("")}</tr></thead><tbody>`,
    (data.matrix || []).map((m) => `<tr><td>${esc(L(m.perm))}</td>${Object.keys(ROLE_KEY).map((r) => `<td>${m[r] ? `<span class="pill green sm"><i class="dot"></i>${esc(t("common.yes"))}</span>` : `<span class="pill gray sm"><i class="dot"></i>${esc(t("common.no"))}</span>`}</td>`).join("")}</tr>`).join(""),
    `</tbody></table></div></div>`,
  ].join("");
}

// ===== 3) 资源与配额 =====
function capacityView(cap) {
  const fleet = cap.fleet || [];
  return [
    `<div class="card card-pad mb16">${section("ad.cap.region")}<div class="table-wrap"><table><thead><tr><th>${esc(t("common.region"))}</th>${(fleet[0]?.models || []).map((m) => `<th>${esc(m.id)}</th>`).join("")}<th>${esc(t("common.total"))}</th><th>${esc(t("ad.cap.util"))}</th></tr></thead><tbody>`,
    fleet.map((r) => {
      const pct = r.total ? Math.round((r.allocated / r.total) * 100) : 0;
      return `<tr><td><strong>${esc(L(r.regionName))}</strong><small>${esc(r.region)}</small></td>` +
        r.models.map((m) => `<td>${m.free}<small class="muted">/${m.total}</small></td>`).join("") +
        `<td>${r.free} / ${r.total}</td><td style="min-width:110px"><div class="progress sm"><span style="width:${pct}%"></span></div><small>${pct}%</small></td></tr>`;
    }).join(""),
    `</tbody></table></div><div class="small muted mt12">${esc(t("common.demo"))} · ${esc(t("ad.demo"))}</div></div>`,
    `<div class="split-65">`,
    `<div class="card card-pad">${section("ad.quota.title")}<div class="table-wrap"><table><thead><tr><th>${esc(t("ad.quota.plan"))}</th><th>${esc(t("ad.quota.gpu"))}</th><th>${esc(t("ad.quota.nodes"))}</th><th>${esc(t("ad.quota.storage"))}</th><th>${esc(t("ad.quota.price"))}</th></tr></thead><tbody>`,
    (cap.plans || []).map((p) => `<tr><td><strong>${esc(p.id)}</strong></td><td>${p.gpuLimit} GPU</td><td>${p.maxNodes}</td><td>${esc(p.storage)}</td><td>${money(p.fee)}</td></tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="card card-pad">${section("k8s.tab.quotas")}<div class="table-wrap"><table><thead><tr><th>Namespace</th><th>${esc(t("ad.cap.allocated"))}</th><th>${esc(t("ad.cap.total"))}</th><th>${esc(t("ad.cap.util"))}</th></tr></thead><tbody>`,
    (cap.quotas || []).map((q) => `<tr><td><strong>${esc(q.ns)}</strong><small>${esc(q.priority)}</small></td><td>${q.gpuUsed}</td><td>${q.gpuLimit}</td><td style="min-width:100px"><div class="progress sm"><span style="width:${Math.round((q.gpuUsed / q.gpuLimit) * 100)}%"></span></div></td></tr>`).join(""),
    `</tbody></table></div></div></div>`,
  ].join("");
}

// ===== 4) 计费与价格 =====
function billingView(data) {
  const pb = data.priceBook || [];
  const cost = data.cost || {};
  return [
    `<div class="card card-pad mb16">${section("ad.price.title")}<div class="table-wrap"><table><thead><tr><th>${esc(t("ad.price.model"))}</th><th>VRAM</th><th>${esc(t("ad.price.ondemand"))}</th><th>${esc(t("ad.price.spot"))}</th><th>${esc(t("ad.price.reserved"))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>`,
    pb.map((p) => `<tr>
      <td><strong>${esc(p.id)}</strong><small>${esc(p.name)}</small></td>
      <td>${p.vram} GB</td>
      <td><input class="price-input" data-price="${esc(p.id)}:price" value="${p.onDemand}" type="number" step="0.01" min="0"></td>
      <td><input class="price-input" data-price="${esc(p.id)}:spot" value="${p.spot}" type="number" step="0.01" min="0"></td>
      <td><input class="price-input" data-price="${esc(p.id)}:reserved" value="${p.reserved}" type="number" step="0.01" min="0"></td>
      <td>${btn("common.save", "admin-price:" + p.id, "sm primary")}</td></tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="split-65">`,
    `<div class="card card-pad">${section("ad.invoice.title")}<div class="table-wrap"><table><thead><tr><th>${esc(t("ad.invoice.th"))}</th><th>${esc(t("ad.invoice.tenant"))}</th><th>${esc(t("ad.invoice.amount"))}</th><th>${esc(t("ad.invoice.period"))}</th><th>${esc(t("ad.invoice.status"))}</th></tr></thead><tbody>`,
    (data.invoices || []).map((x) => `<tr><td><strong>${esc(x.id)}</strong><small>${esc(x.issued)}</small></td><td>${esc(x.tenant)}</td><td>${money(x.amount)}</td><td>${esc(x.period)}</td><td>${status(x.status === "paid" ? "completed" : x.status === "unpaid" ? "pending" : "failed")}</td></tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="card card-pad">${section("ov.cost")}<div class="donut"><div class="donut-inner">${money(cost.monthly || 0)}<small>${esc(t("ov.cost.month"))}</small></div></div>`,
    `<div class="legend mt16">${(cost.bills || []).map((b, i) => `<div class="legend-item"><span><i style="background:${["#ff6000", "#f9a825", "#34383b", "#ffcc32"][i]}"></i>${esc(L(b.name))}</span><b>${b.pct}%</b></div>`).join("")}</div>`,
    `<div class="callout mt16">${esc(t("common.perHour"))} ${money(cost.hourly || 0)} · ${(cost.gpuCount || 0)} GPU</div></div></div>`,
  ].join("");
}

// ===== 5) 运维与审计 =====
function opsView(data) {
  return [
    `<div class="card card-pad mb16">${section("ad.ops.health")}<div class="table-wrap"><table><thead><tr><th>${esc(t("ad.ops.service"))}</th><th>${esc(t("common.status"))}</th><th>${esc(t("ad.ops.latency"))}</th><th>${esc(t("ad.ops.uptime"))}</th></tr></thead><tbody>`,
    (data.services || []).map((s) => `<tr><td><strong>${esc(L(s.name))}</strong></td><td>${status(s.status)}</td><td>${esc(s.p95)}</td><td>${esc(s.uptime)}</td></tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="split-65 mb16">`,
    `<div class="card card-pad">${section("ad.ticket.title")}<div class="table-wrap"><table><thead><tr><th>${esc(t("ad.ticket.th"))}</th><th>${esc(t("ad.ticket.priority"))}</th><th>${esc(t("ad.ticket.assignee"))}</th><th>${esc(t("ad.ticket.age"))}</th><th>${esc(t("common.status"))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>`,
    (data.tickets || []).map((x) => `<tr><td><strong>${esc(x.id)}</strong><small>${esc(L(x.title))} · ${esc(x.tenant)}</small></td><td><span class="pill ${x.priority === "high" ? "red" : x.priority === "medium" ? "amber" : "gray"}"><i class="dot"></i>${esc(x.priority)}</span></td><td>${esc(x.assignee)}</td><td>${esc(x.age)}</td><td>${status(x.status)}</td><td>${x.status === "open" ? btn("ad.btn.resolve", "admin-resolve:" + x.id, "sm") : "—"}</td></tr>`).join(""),
    `</tbody></table></div></div>`,
    `<div class="card card-pad">${section("ad.ticket.title")}<div class="subhead mb12">${esc(t("ad.demo"))}</div>`,
    (data.announcements || []).map((a) => `<div class="between" style="padding:9px 0;border-bottom:1px solid #edf1f7"><div><b class="small">${esc(L(a.title))}</b><div class="small muted">${esc(a.date)}</div></div>${status(a.level)}</div>`).join(""),
    `<div class="mt16">${btn("ad.btn.publish", "admin-announce", "sm block")}</div></div></div>`,
    `<div class="card card-pad">${section("ad.audit.title")}<div class="table-wrap"><table><thead><tr><th>${esc(t("ad.audit.time"))}</th><th>${esc(t("ad.audit.actor"))}</th><th>${esc(t("ad.audit.action"))}</th><th>${esc(t("ad.audit.target"))}</th><th>${esc(t("ad.audit.ip"))}</th><th>${esc(t("ad.audit.result"))}</th></tr></thead><tbody>`,
    (data.audit || []).map((a) => `<tr><td>${esc(a.time)}</td><td>${esc(a.actor)}</td><td>${esc(L(a.action))}</td><td>${esc(a.target)}</td><td>${esc(a.ip)}</td><td>${status(a.result)}</td></tr>`).join(""),
    `</tbody></table></div></div>`,
  ].join("");
}

export default async function adminPage(S) {
  const tab = S.adminTab || "overview";
  const [ovRes, tnRes, capRes, bilRes, opsRes] = await Promise.all([
    api.adminOverview(), api.adminTenants(), api.adminCapacity(), api.adminBilling(), api.adminOps(),
  ]);

  return [
    header("ad.title", "ad.sub", `<span class="pill gray sm"><i class="dot"></i>${esc(L(ovRes.platform.controlPlane))}</span>`),
    tabs([["overview", "ad.tab.overview"], ["tenants", "ad.tab.tenants"], ["capacity", "ad.tab.capacity"], ["billing", "ad.tab.billing"], ["ops", "ad.tab.ops"]], tab, "adminTab"),
    tab === "overview" ? overviewView(ovRes.overview, ovRes.cost, ovRes.platform)
      : tab === "tenants" ? tenantsView(tnRes, S)
      : tab === "capacity" ? capacityView(capRes)
      : tab === "billing" ? billingView(bilRes)
      : opsView(opsRes),
  ].join("");
}
