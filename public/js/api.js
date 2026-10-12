// 前后端联调层：对齐原型常量与动作，统一走 REST API
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
};
