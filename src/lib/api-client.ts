// API 客户端（ARCH §12.7：VITE_API_BASE_URL 消费点；Mock 关闭时指向真实网关）
// 时序指标走独立 /api/metrics/*，与业务实体接口分离（§11 / §12.8）。
const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080') as string;
const USE_MOCK = import.meta.env.VITE_ENABLE_MOCK === 'true';

/** Mock 开启时走相对路径（由 MSW 拦截）；关闭时指向真实网关 */
const base = (): string => (USE_MOCK ? '' : BASE);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) throw new ApiError(`请求失败 ${path}：${res.status}`, res.status);
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
};

// ─────────── 端点常量（避免散落字符串） ───────────
export const EP = {
  me: '/api/auth/me',
  resources: '/api/resources',
  resource: (uuid: string): string => `/api/resources/${uuid}`,
  resourceSteps: (uuid: string): string => `/api/resources/${uuid}/steps`,
  resourceEvents: (uuid: string): string => `/api/resources/${uuid}/events`,
  orders: '/api/deployment-orders',
  nodePools: '/api/node-pools',
  nodes: '/api/nodes',
  nodeEvents: '/api/node-events',
  clusterDist: '/api/cluster/state-distribution',
  clusterEfficiency: '/api/cluster/efficiency',
  statusBar: '/api/status-bar',
  metrics: (uuid: string): string => `/api/metrics/resources/${uuid}`,
  metricOne: (uuid: string, key: string): string => `/api/metrics/resources/${uuid}/${key}`,
  metricsCluster: '/api/metrics/cluster',
  models: '/api/models',
  images: '/api/images',
  appTemplates: '/api/app-templates',
  notebooks: '/api/notebooks',
  datasets: '/api/datasets',
  buckets: '/api/buckets',
  pipelines: '/api/pipelines',
  quotas: '/api/quotas',
  invoices: '/api/billing/invoices',
  transactions: '/api/billing/transactions',
  vouchers: '/api/assets/vouchers',
  reservations: '/api/assets/reservations',
  storagePacks: '/api/assets/storage-packs',
  notifications: '/api/notifications',
  tickets: '/api/tickets',
} as const;

/** 向后兼容旧引用 */
export const apiClient = { BASE_URL: BASE, get: api.get };
