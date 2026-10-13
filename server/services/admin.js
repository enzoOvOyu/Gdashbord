// 管理端业务逻辑：租户/用户、配额、价目、工单、公告（演示：仅修改状态并留审计）
import { GPU } from "../data/catalog.js";
import { pushEvent } from "../store.js";
import { fleet } from "../data/admin.js";

function nowTime() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function audit(s, actor, action, target, result = "success") {
  s.admin.audit.unshift({ time: nowTime(), actor, action, target, ip: "203.0.113.1", result });
  s.admin.audit = s.admin.audit.slice(0, 40);
}

// ===== 概览统计：由真实状态实算，保证与各业务模块一致 =====
export function adminOverview(s) {
  const f = fleet();
  const total = f.reduce((a, r) => a + r.total, 0);
  const allocated = f.reduce((a, r) => a + r.allocated, 0);
  const free = f.reduce((a, r) => a + r.free, 0);
  const tenants = s.admin.tenants;
  const activeTenants = tenants.filter((t) => t.status === "active").length;
  const users = s.admin.users;
  const mrr = tenants.reduce((a, t) => a + t.spend, 0);
  const openTickets = s.admin.tickets.filter((x) => x.status === "open").length;
  return {
    kpi: {
      tenants: activeTenants,
      tenantsTotal: tenants.length,
      users: users.length,
      usersActive: users.filter((u) => u.status === "active").length,
      fleetTotal: total,
      fleetAllocated: allocated,
      fleetFree: free,
      utilization: total ? Math.round((allocated / total) * 100) : 0,
      mrr: Number(mrr.toFixed(2)),
      openTickets,
    },
    fleet: f,
    regions: f.map((r) => ({ region: r.region, name: r.regionName, total: r.total, allocated: r.allocated, free: r.free })),
    recentAudit: s.admin.audit.slice(0, 6),
    announcements: s.admin.announcements,
    services: s.admin.services,
  };
}

// ===== 租户 =====
export function setTenantStatus(s, id, status) {
  const t = s.admin.tenants.find((x) => x.id === id);
  if (!t) return { error: "tenant not found" };
  t.status = status;
  audit(s, "Platform Admin", { zh: status === "active" ? "启用租户" : "停用租户", en: status === "active" ? "Enable tenant" : "Suspend tenant" }, t.name);
  pushEvent(status === "active" ? "success" : "warning", `租户 ${t.name} 已${status === "active" ? "启用" : "停用"}`);
  return { ok: true, tenant: t };
}

export function setTenantQuota(s, id, quota) {
  const t = s.admin.tenants.find((x) => x.id === id);
  if (!t) return { error: "tenant not found" };
  const q = Number(quota);
  if (!Number.isFinite(q) || q < 0) return { error: "配额无效" };
  t.gpuQuota = q;
  audit(s, "Platform Admin", { zh: "更新租户配额", en: "Update tenant quota" }, `${t.name} → ${q} GPU`);
  pushEvent("info", `租户 ${t.name} GPU 配额调整为 ${q}`);
  return { ok: true, tenant: t };
}

// ===== 用户与角色 =====
export function setUserRole(s, id, role) {
  const u = s.admin.users.find((x) => x.id === id);
  if (!u) return { error: "user not found" };
  if (!s.admin.roles.some((r) => r.id === role)) return { error: "unknown role" };
  u.role = role;
  audit(s, "Platform Admin", { zh: "变更成员角色", en: "Change member role" }, `${u.name} → ${role}`);
  return { ok: true, user: u };
}

export function setUserStatus(s, id, status) {
  const u = s.admin.users.find((x) => x.id === id);
  if (!u) return { error: "user not found" };
  u.status = status;
  audit(s, "Platform Admin", { zh: status === "active" ? "启用成员" : "停用成员", en: status === "active" ? "Enable member" : "Disable member" }, u.name);
  return { ok: true, user: u };
}

export function inviteUser(s, payload = {}) {
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim();
  if (!name || !email) return { error: "请填写姓名与邮箱" };
  const user = {
    id: "u-" + Date.now().toString().slice(-4),
    name, email,
    tenant: payload.tenant || s.admin.tenants[0].name,
    role: payload.role || "developer",
    mfa: false,
    last: "刚刚",
    status: "invited",
  };
  s.admin.users.unshift(user);
  audit(s, "Platform Admin", { zh: "邀请成员", en: "Invite member" }, email);
  pushEvent("info", `已邀请 ${email} 加入 ${user.tenant}`);
  return { ok: true, user };
}

// ===== 价目表 =====
export function priceBook(s) {
  const override = s.admin.priceOverride || {};
  return GPU.map((g) => ({
    id: g.id,
    name: g.name,
    vram: g.vram,
    onDemand: override[g.id]?.price ?? g.price,
    spot: override[g.id]?.spot ?? g.spot,
    reserved: override[g.id]?.reserved ?? g.reserved,
  }));
}

export function setPrice(s, id, field, value) {
  if (!["price", "spot", "reserved"].includes(field)) return { error: "unknown price field" };
  if (!GPU.some((g) => g.id === id)) return { error: "unknown gpu" };
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0) return { error: "价格无效" };
  s.admin.priceOverride = s.admin.priceOverride || {};
  s.admin.priceOverride[id] = Object.assign({}, s.admin.priceOverride[id], { [field]: v });
  audit(s, "Platform Admin", { zh: "调整价目", en: "Update price book" }, `${id} ${field} → $${v}`);
  pushEvent("info", `${id} ${field} 价格更新为 $${v}/卡·小时`);
  return { ok: true, price: priceBook(s).find((x) => x.id === id) };
}

// ===== 工单 =====
export function resolveTicket(s, id) {
  const t = s.admin.tickets.find((x) => x.id === id);
  if (!t) return { error: "ticket not found" };
  t.status = "resolved";
  audit(s, "Platform Admin", { zh: "处理工单", en: "Resolve ticket" }, t.id);
  return { ok: true, ticket: t };
}

export function publishAnnouncement(s, payload = {}) {
  const title = String(payload.title || "").trim();
  if (!title) return { error: "请填写公告内容" };
  const d = new Date();
  const item = {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    title: { zh: title, en: title },
    level: payload.level || "info",
  };
  s.admin.announcements.unshift(item);
  audit(s, "Platform Admin", { zh: "发布公告", en: "Publish announcement" }, title);
  return { ok: true, announcement: item };
}
