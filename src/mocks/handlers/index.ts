// MSW 拦截器（ARCH §6：拦截 /api/*；§11/§12.8：时序指标走独立 /api/metrics/*，不混入业务实体）
// §8.5：列表 120–320ms、详情 200–500ms、写操作 400–900ms 人为延迟；分页返回 X-Total-Count。
import { http, HttpResponse, delay } from 'msw';
import type {
  DeploymentOrder,
  NodePoolCode,
  RegionCode,
  ResourceKind,
} from '../../types/domain';
import {
  ORDERS,
  RESOURCES,
  createResourceFromOrder,
  eventsOf,
  orderOf,
  placementOf,
  resourceByUuid,
  stepsOf,
} from '../fixtures/resources';
import { GPU_NODES, NODE_EVENTS, NODE_POOLS, nodeStateDistribution, poolSupply } from '../fixtures/nodes';
import { MODELS, modelWeightsGb } from '../fixtures/models';
import { IMAGES } from '../fixtures/images';
import { CURRENT_USER, ORG, PLANS, PROJECTS, QUOTAS } from '../fixtures/users-orgs';
import {
  APP_TEMPLATES,
  BUCKETS,
  DATASETS,
  INVOICES,
  NOTEBOOKS,
  NOTIFICATIONS,
  PIPELINES,
  RESERVATIONS,
  STORAGE_PACKS,
  TICKETS,
  TRANSACTIONS,
  VOUCHERS,
} from '../fixtures/content';
import { resourceMetrics, clusterEfficiency } from '../metrics';
import { deriveCost } from '../lib/derive';
import { effectiveRatePerGpuHour } from '../fixtures/pricing';
import { POOL_REGIONS } from '../fixtures/regions-pools';
import { KIND_META } from '../../lib/ids';
import { NODE_PLATFORM } from '../fixtures/gpu-specs';
import type { RangeKey } from '../lib/timeseries';
import { occupiesQuota } from '../fixtures/users-orgs';

const listDelay = () => delay(120 + Math.random() * 200);
const detailDelay = () => delay(200 + Math.random() * 300);
const writeDelay = () => delay(400 + Math.random() * 500);

/** 列表分页（§8.5：默认 20 条，返回 X-Total-Count） */
function paginate<T>(items: T[], url: URL): { data: T[]; headers: Record<string, string> } {
  const page = Number(url.searchParams.get('page') ?? 1);
  const size = Number(url.searchParams.get('size') ?? 20);
  const start = (page - 1) * size;
  return {
    data: items.slice(start, start + size),
    headers: { 'X-Total-Count': String(items.length) },
  };
}

export const handlers = [
  // ─────────── 身份 ───────────
  http.get('/api/auth/me', async () => {
    await listDelay();
    return HttpResponse.json({
      user: CURRENT_USER,
      org: ORG,
      plan: PLANS.find((p) => p.code === ORG.plan_code),
      projects: PROJECTS,
      plans: PLANS,
    });
  }),

  // ─────────── 资源（业务实体） ───────────
  http.get('/api/resources', async ({ request }) => {
    await listDelay();
    const url = new URL(request.url);
    const kind = url.searchParams.get('kind') as ResourceKind | null;
    const region = url.searchParams.get('region') as RegionCode | null;
    const status = url.searchParams.get('status');
    const q = url.searchParams.get('q');
    let list = RESOURCES.filter((r) => r.deleted_at === null);
    if (kind) list = list.filter((r) => r.kind === kind);
    if (region) list = list.filter((r) => r.region === region);
    if (status) list = list.filter((r) => r.status === status);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.display_id.toLowerCase().includes(s) ||
          r.resource_uuid.toLowerCase().includes(s),
      );
    }
    // 派生实时单价（G2：由 pricing 派生，不硬编码）
    const withCost = list.map((r) => ({
      ...r,
      unit_price: effectiveRatePerGpuHour(r.node_pool, r.region),
      cost_per_hour: deriveCost(
        { pool: r.node_pool, region: r.region, gpu_count: r.gpu_count, storage_gb: r.storage_gb, status: r.status },
        ORG.credit_balance,
      ).running_cost_per_hour,
    }));
    const { data, headers } = paginate(withCost, url);
    return HttpResponse.json(data, { headers });
  }),

  http.get('/api/resources/:uuid', async ({ params }) => {
    await detailDelay();
    const r = resourceByUuid(String(params.uuid));
    if (!r) return new HttpResponse(null, { status: 404 });
    const cost = deriveCost(
      { pool: r.node_pool, region: r.region, gpu_count: r.gpu_count, storage_gb: r.storage_gb, status: r.status },
      ORG.credit_balance,
    );
    return HttpResponse.json({
      ...r,
      unit_price: effectiveRatePerGpuHour(r.node_pool, r.region),
      cost,
      placement: placementOf(r.id),
      order: orderOf(r.id),
    });
  }),

  http.get('/api/resources/:uuid/steps', async ({ params }) => {
    await listDelay();
    const r = resourceByUuid(String(params.uuid));
    if (!r) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(stepsOf(r.id));
  }),

  http.get('/api/resources/:uuid/events', async ({ params }) => {
    await listDelay();
    const r = resourceByUuid(String(params.uuid));
    if (!r) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(eventsOf(r.id));
  }),

  http.get('/api/resources/:uuid/metrics', async ({ request, params }) => {
    await detailDelay();
    const r = resourceByUuid(String(params.uuid));
    if (!r) return new HttpResponse(null, { status: 404 });
    const range = (new URL(request.url).searchParams.get('range') ?? '1h') as RangeKey;
    return HttpResponse.json(resourceMetrics(r, range));
  }),

  // ─────────── 部署订单（创建入口） ───────────
  http.get('/api/deployment-orders', async ({ request }) => {
    await listDelay();
    const { data, headers } = paginate(ORDERS, new URL(request.url));
    return HttpResponse.json(data, { headers });
  }),

  // 下单：生成工作项订单（§13.1），并异步映射为资源实例（PRD §5.3 跳转详情）
  http.post('/api/deployment-orders', async ({ request }) => {
    await writeDelay();
    const body = (await request.json()) as {
      resource_kind: ResourceKind;
      region: RegionCode;
      node_pool: NodePoolCode;
      requested_spec: unknown;
      source_type?: string;
      source_ref_id?: number;
      name?: string;
    };
    const id = (ORDERS.length + 1) as DeploymentOrder['id'];
    const pool = body.node_pool as DeploymentOrder['node_pool'];
    const ts = new Date().toISOString();
    const order: DeploymentOrder = {
      id,
      order_uuid: `ord-${Date.now().toString(16)}`,
      org_id: ORG.id,
      owner_id: CURRENT_USER.id,
      project_id: PROJECTS[0].id,
      resource_kind: body.resource_kind,
      requested_spec: body.requested_spec as DeploymentOrder['requested_spec'],
      region: body.region,
      node_pool: pool,
      source_type: (body.source_type ?? 'direct') as DeploymentOrder['source_type'],
      source_ref_id: (body.source_ref_id ?? null) as DeploymentOrder['source_ref_id'],
      // §7.1：按实际所选节点池取价，非硬编码
      price_snapshot: pool
        ? effectiveRatePerGpuHour(pool as NodePoolCode, body.region)
        : null,
      status: 'provisioning',
      failure_reason: null,
      created_at: ts,
      updated_at: ts,
    };
    ORDERS.unshift(order);

    // 供给：订单 → 资源实例（requested_spec 与 spec_json 允许降级差异，§12.9）
    const name = (body.name ?? '').trim() || `${KIND_META[body.resource_kind].label}-${id}`;
    const resource = createResourceFromOrder(order, name);

    return HttpResponse.json(
      { ...order, resource_uuid: resource.resource_uuid },
      { status: 201 },
    );
  }),

  // ─────────── 供给侧（集群） ───────────
  http.get('/api/node-pools', async ({ request }) => {
    await listDelay();
    const region = new URL(request.url).searchParams.get('region') as RegionCode | null;
    const pools = NODE_POOLS.map((p) => ({
      ...p,
      available_regions: POOL_REGIONS[p.code],
      unit_price_jp: effectiveRatePerGpuHour(p.code, 'jp'),
      unit_price_us: effectiveRatePerGpuHour(p.code, 'us'),
      unit_price_sg: effectiveRatePerGpuHour(p.code, 'sg'),
      unit_price_th: effectiveRatePerGpuHour(p.code, 'th'),
      // 平台规格（向导展示机型 CPU / 本地 NVMe / 网络所需）
      platform: NODE_PLATFORM[p.code],
      supply: region ? poolSupply(region, p.code) : undefined,
    }));
    return HttpResponse.json(pools);
  }),

  http.get('/api/nodes', async ({ request }) => {
    await listDelay();
    const url = new URL(request.url);
    const region = url.searchParams.get('region') as RegionCode | null;
    const pool = url.searchParams.get('pool') as string | null;
    const state = url.searchParams.get('state');
    let list = GPU_NODES;
    if (region) list = list.filter((n) => n.region === region);
    if (pool) list = list.filter((n) => n.pool_code === pool);
    if (state) list = list.filter((n) => n.state === state);
    const { data, headers } = paginate(list, url);
    return HttpResponse.json(data, { headers });
  }),

  http.get('/api/node-events', async ({ request }) => {
    await listDelay();
    const { data, headers } = paginate(NODE_EVENTS, new URL(request.url));
    return HttpResponse.json(data, { headers });
  }),

  http.get('/api/cluster/state-distribution', async ({ request }) => {
    await listDelay();
    const region = new URL(request.url).searchParams.get('region') as RegionCode | null;
    return HttpResponse.json(nodeStateDistribution(region ?? undefined));
  }),

  http.get('/api/cluster/efficiency', async ({ request }) => {
    await listDelay();
    const region = new URL(request.url).searchParams.get('region') ?? undefined;
    return HttpResponse.json(clusterEfficiency(region));
  }),

  // ─────────── 指标（独立契约，§11） ───────────
  http.get('/api/metrics/resources/:uuid', async ({ request, params }) => {
    await detailDelay();
    const r = resourceByUuid(String(params.uuid));
    if (!r) return new HttpResponse(null, { status: 404 });
    const range = (new URL(request.url).searchParams.get('range') ?? '1h') as RangeKey;
    return HttpResponse.json(resourceMetrics(r, range));
  }),

  http.get('/api/metrics/resources/:uuid/:key', async ({ request, params }) => {
    await detailDelay();
    const r = resourceByUuid(String(params.uuid));
    if (!r) return new HttpResponse(null, { status: 404 });
    const range = (new URL(request.url).searchParams.get('range') ?? '1h') as RangeKey;
    const all = resourceMetrics(r, range);
    const found = all.find((m) => m.key === params.key);
    return found ? HttpResponse.json(found) : new HttpResponse(null, { status: 404 });
  }),

  http.get('/api/metrics/cluster', async ({ request }) => {
    await detailDelay();
    const region = new URL(request.url).searchParams.get('region') ?? undefined;
    return HttpResponse.json(clusterEfficiency(region));
  }),

  // ─────────── 顶部状态栏聚合（PRD §3.2 / §6.7） ───────────
  http.get('/api/status-bar', async ({ request }) => {
    await listDelay();
    const region = (new URL(request.url).searchParams.get('region') ?? 'jp') as RegionCode;
    const dist = nodeStateDistribution(region);
    const totalNodes = Object.values(dist).reduce((a, b) => a + b, 0);
    const healthy = dist.ready / (totalNodes || 1);
    const incidentCount = NODE_EVENTS.filter(
      (e) => e.level === 'error' && Date.now() - +new Date(e.occurredAt) < 24 * 3600_000,
    ).length;
    const supplies = NODE_POOLS.map((p) => {
      const s = poolSupply(region, p.code);
      return { code: p.code, display_name: p.display_name, ...s, tight: s.totalGpu > 0 && s.availableGpu / s.totalGpu < 0.15 };
    }).filter((s) => s.totalGpu > 0);
    const runningByKind = RESOURCES.reduce<Record<string, number>>((acc, r) => {
      if (r.status === 'running') acc[r.kind] = (acc[r.kind] ?? 0) + 1;
      return acc;
    }, {});
    return HttpResponse.json({
      region,
      service_health: healthy > 0.95 ? 'ok' : healthy > 0.9 ? 'degraded' : 'down',
      healthy_ratio: healthy,
      incident_count: incidentCount,
      supplies,
      credit_balance: ORG.credit_balance,
      low_balance_threshold: ORG.low_balance_threshold_usd,
      cost_mtd: 3284.4,
      budget: 5000,
      running_by_kind: runningByKind,
      running_total: Object.values(runningByKind).reduce((a, b) => a + b, 0),
      ping_ms: 42,
    });
  }),

  // ─────────── 内容 ───────────
  http.get('/api/models', async ({ request }) => {
    await listDelay();
    const list = MODELS.map((m) => ({ ...m, weights_gb: modelWeightsGb(m) }));
    const { data, headers } = paginate(list, new URL(request.url));
    return HttpResponse.json(data, { headers });
  }),
  http.get('/api/images', async () => {
    await listDelay();
    return HttpResponse.json(IMAGES);
  }),
  http.get('/api/app-templates', async () => {
    await listDelay();
    return HttpResponse.json(APP_TEMPLATES);
  }),
  http.get('/api/notebooks', async () => {
    await listDelay();
    return HttpResponse.json(NOTEBOOKS);
  }),
  http.get('/api/datasets', async ({ request }) => {
    await listDelay();
    const { data, headers } = paginate(DATASETS, new URL(request.url));
    return HttpResponse.json(data, { headers });
  }),
  http.get('/api/buckets', async () => {
    await listDelay();
    return HttpResponse.json(BUCKETS);
  }),
  http.get('/api/pipelines', async () => {
    await listDelay();
    return HttpResponse.json(PIPELINES);
  }),

  // ─────────── 计费与配额 ───────────
  http.get('/api/quotas', async () => {
    await listDelay();
    // used_value 为派生值（§7.3 占用口径），由「重算任务」得到，禁止业务代码直写
    const derived = QUOTAS.map((q) => {
      let used = 0;
      for (const r of RESOURCES) {
        if (r.deleted_at || !occupiesQuota(q.metric, r.status)) continue;
        if (q.metric === 'gpu') used += r.gpu_count;
        else if (q.metric === 'vcpu') used += r.gpu_count * 14;
        else if (q.metric === 'storage_gb') used += r.storage_gb;
        else if (q.metric === 'public_ip') used += 1;
      }
      return { ...q, used_value: Math.round(used * 100) / 100 };
    });
    return HttpResponse.json(derived);
  }),
  http.get('/api/billing/invoices', async () => {
    await listDelay();
    return HttpResponse.json(INVOICES);
  }),
  http.get('/api/billing/transactions', async ({ request }) => {
    await listDelay();
    const { data, headers } = paginate(TRANSACTIONS, new URL(request.url));
    return HttpResponse.json(data, { headers });
  }),
  http.get('/api/assets/vouchers', async () => {
    await listDelay();
    return HttpResponse.json(VOUCHERS);
  }),
  http.get('/api/assets/reservations', async () => {
    await listDelay();
    return HttpResponse.json(RESERVATIONS);
  }),
  http.get('/api/assets/storage-packs', async () => {
    await listDelay();
    return HttpResponse.json(STORAGE_PACKS);
  }),

  // ─────────── 通知与工单 ───────────
  http.get('/api/notifications', async () => {
    await listDelay();
    return HttpResponse.json(NOTIFICATIONS);
  }),
  http.get('/api/tickets', async ({ request }) => {
    await listDelay();
    const { data, headers } = paginate(TICKETS, new URL(request.url));
    return HttpResponse.json(data, { headers });
  }),
];
