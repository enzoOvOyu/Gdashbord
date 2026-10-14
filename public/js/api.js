// 前后端联调层：统一走 REST API
const BASE = "/api";

async function req(path, options = {}) {
  const init = { headers: { "Content-Type": "application/json" } };
  if (options.method) init.method = options.method;
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const res = await fetch(BASE + path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "请求失败 " + res.status);
  }
  return res.json();
}

const qs = (p) => Object.entries(p || {}).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");

export const api = {
  catalog: () => req("/catalog"),
  state: () => req("/state"),
  setState: (path, value) => req("/state", { method: "PATCH", body: { path, value } }),
  reset: () => req("/state/reset", { method: "POST" }),

  overview: () => req("/overview"),
  market: (params) => req("/market" + (params ? "?" + qs(params) : "")),
  stock: (gpu, region) => req("/market/stock?" + qs({ gpu, region })),
  gpu: (id) => req("/market/" + id),

  workloads: () => req("/workloads"),
  deploy: (draft) => req("/workloads/deploy", { method: "POST", body: draft }),
  instanceAction: (id, action) => req("/workloads/" + id + "/action", { method: "POST", body: { action } }),

  endpoints: () => req("/endpoints"),
  endpointAction: (id, payload) => req("/endpoints/" + id + "/action", { method: "POST", body: payload }),

  jobs: () => req("/jobs"),
  jobRetry: (id) => req("/jobs/" + id + "/retry", { method: "POST" }),
  jobLogs: (id) => req("/jobs/" + id + "/logs", { method: "POST" }),

  assets: () => req("/assets"),
  createAsset: (name, tab) => req("/assets", { method: "POST", body: { name, tab } }),

  security: () => req("/security"),
  createKey: (name) => req("/security/keys", { method: "POST", body: { name } }),
  revokeKey: (id) => req("/security/keys/" + id, { method: "DELETE" }),
  createSecret: (name) => req("/security/secrets", { method: "POST", body: { name } }),

  metrics: (tab, range) => req("/monitor/metrics?" + qs({ tab, range })),
  events: () => req("/monitor/events"),
  createAlert: (name, metric, value) => req("/monitor/alerts", { method: "POST", body: { name, metric, value } }),

  billing: () => req("/billing"),
  setBudget: (budget) => req("/billing/budget", { method: "POST", body: { budget } }),
  recharge: (amount) => req("/billing/recharge", { method: "POST", body: { amount } }),
  exportBill: () => "/api/billing/export",

  // ===== 万卡机队 =====
  fleet: () => req("/fleet"),
  fleetCapacity: () => req("/fleet/capacity"),

  // ===== 平台管理后台 =====
  adminOverview: () => req("/admin/overview"),
  adminTenants: () => req("/admin/tenants"),
  adminCapacity: () => req("/admin/capacity"),
  adminBilling: () => req("/admin/billing"),
  adminOps: () => req("/admin/ops"),
  adminClusterSkus: () => req("/admin/cluster-skus"),
  adminTenantStatus: (id, status) => req("/admin/tenants/" + id + "/status", { method: "POST", body: { status } }),
  adminTenantQuota: (id, quota) => req("/admin/tenants/" + id + "/quota", { method: "POST", body: { quota } }),
  adminInvite: (payload) => req("/admin/users", { method: "POST", body: payload }),
  adminUserRole: (id, role) => req("/admin/users/" + id + "/role", { method: "POST", body: { role } }),
  adminUserStatus: (id, status) => req("/admin/users/" + id + "/status", { method: "POST", body: { status } }),
  adminPrice: (id, field, value) => req("/admin/price", { method: "POST", body: { id, field, value } }),
  adminResolveTicket: (id) => req("/admin/tickets/" + id + "/resolve", { method: "POST" }),
  adminAnnounce: (payload) => req("/admin/announcements", { method: "POST", body: payload }),

  k8sSummary: () => req("/k8s/summary"),
  k8sNodes: (pool, status) => req("/k8s/nodes?" + qs({ pool, status })),
  k8sNode: (id) => req("/k8s/nodes/" + id),
  k8sNodeAction: (id, action) => req("/k8s/nodes/" + id + "/action", { method: "POST", body: { action } }),
  k8sQuotas: () => req("/k8s/quotas"),
  k8sQuotaSet: (ns, field, value) => req("/k8s/quotas", { method: "POST", body: { ns, field, value } }),
  k8sWorkloads: (ns, phase) => req("/k8s/workloads?" + qs({ ns, phase })),
  k8sPodAction: (id, action) => req("/k8s/workloads/" + id + "/action", { method: "POST", body: { action } }),
  k8sScheduler: () => req("/k8s/scheduler"),
  k8sDispatch: () => req("/k8s/scheduler/dispatch", { method: "POST" }),
  k8sTopology: () => req("/k8s/topology"),
  k8sMetrics: (tab, range) => req("/k8s/metrics?" + qs({ tab, range })),
  k8sEvents: () => req("/k8s/events"),
};
