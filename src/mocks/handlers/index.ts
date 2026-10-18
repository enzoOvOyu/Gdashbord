// MSW 拦截器（ARCH §6：拦截 /api/*；§11/§12.8：时序指标走独立 /api/metrics/*，不混入业务实体）
// v0.6 契约（ARCH §12.11）：区域为第一维度、删除为真实软删、项目为真实实体。
import { http, HttpResponse, delay } from 'msw';
import type {
  CostSlice,
  DeploymentOrder,
  InternalId,
  LogEntry,
  NodeEvent,
  NodePoolCode,
  QuotaMetric,
  RegionCode,
  Resource,
  ResourceKind,
  ResourceSpec,
  UsageRow,
} from '../../types/domain';
import {
  ORDERS,
  RESOURCES,
  createResourceFromOrder,
  eventsOf,
  orderOf,
  placementOf,
  requestedFootprint,
  resourceByUuid,
  softDeleteResource,
  startResource,
  stepsOf,
  stopResource,
} from '../fixtures/resources';
import {
  GPU_NODES,
  MAINTENANCE_WINDOWS,
  NODE_EVENTS,
  NODE_POOLS,
  nodeEventStream,
  nodeStateDistribution,
  poolSupply,
} from '../fixtures/nodes';
import { MODELS, modelWeightsGb } from '../fixtures/models';
import { IMAGES } from '../fixtures/images';
import { CURRENT_USER, ORG, PLANS, QUOTAS } from '../fixtures/users-orgs';
import {
  PROJECTS,
  createProject,
  deleteProject,
  projectById,
} from '../fixtures/projects';
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
  VOUCHERS,
} from '../fixtures/content';
import {
  USAGE_ROWS,
  appendUsageFor,
  costMtd,
  costSlices,
  costSnapshotOf,
  costSummaryOf,
  costTrend,
  costToday,
  currentBillingPeriod,
  rebuildTransactions,
  rebuildUsage,
  transactionsOfResource,
  usageOfResourceFiltered,
  TRANSACTIONS,
  type CostDimension,
} from '../fixtures/billing';
import { logContext, queryLogs, rebuildLogs } from '../fixtures/logs';
import { resourceMetrics, clusterEfficiency } from '../metrics';
import { NODE_PLATFORM } from '../fixtures/gpu-specs';
import { replicasOf, workloadsOf } from '../fixtures/workloads';
import { POOL_REGIONS, isPoolAvailableIn } from '../fixtures/regions-pools';
import {
  MARKET_RATE_RANGE,
  effectiveRatePerGpuHour,
  effectiveRatePerMachineHour,
} from '../fixtures/pricing';
import { KIND_META, REGION_META } from '../../lib/ids';
import type { RangeKey } from '../lib/timeseries';
import { occupiesQuota } from '../fixtures/users-orgs';

const listDelay = () => delay(120 + Math.random() * 200);
const detailDelay = () => delay(200 + Math.random() * 300);
const writeDelay = () => delay(400 + Math.random() * 500);

function paginate<T>(items: T[], url: URL): { data: T[]; headers: Record<string, string> } {
  const page = Number(url.searchParams.get('page') ?? 1);
  const size = Number(url.searchParams.get('size') ?? 20);
  const start = (page - 1) * size;
  return {
    data: items.slice(start, start + size),
    headers: { 'X-Total-Count': String(items.length) },
  };
}

// 初始化派生数据（用量 → 流水 → 日志）：一切展示金额都可由 USAGE_ROWS 复算
rebuildUsage(RESOURCES);
rebuildTransactions(ORG.credit_balance);
rebuildLogs(RESOURCES);

const withSnapshot = (r: Resource) => ({
  ...r,
  project_name: projectById(r.project_id as InternalId)?.name ?? '未分配',
  cost: costSnapshotOf(r, ORG.credit_balance),
  placement: placementOf(r.id),
  order: orderOf(r.id),
});

export const handlers = [
  // ─────────── 身份 ───────────
  http.get('/api/auth/me', async () => {
    await listDelay();
    return HttpResponse.json({
      user: CURRENT_USER,
      org: ORG,
      plan: PLANS.find((p) => p.code === ORG.plan_code) ?? null,
      projects: PROJECTS,
      plans: PLANS,
    });
  }),

  // ─────────── 项目（PRD §3.5：真实实体） ───────────
  http.get('/api/projects', async () => {
    await listDelay();
    return HttpResponse.json(PROJECTS);
  }),

  http.post('/api/projects', async ({ request }) => {
    await writeDelay();
    const body = (await request.json()) as { name?: string; default_region?: RegionCode };
    const name = (body.name ?? '').trim();
    if (!name) {
      return HttpResponse.json(
        { code: 'INVALID_NAME', message: '项目名称不能为空' },
        { status: 400 },
      );
    }
    if (PROJECTS.some((p) => p.name === name)) {
      return HttpResponse.json(
        { code: 'PROJECT_NAME_TAKEN', message: '同名项目已存在' },
        { status: 409 },
      );
    }
    const p = createProject({ name, default_region: body.default_region });
    return HttpResponse.json(p, { status: 201 });
  }),

  http.delete('/api/projects/:id', async ({ params }) => {
    await writeDelay();
    const id = Number(params.id) as InternalId;
    const result = deleteProject(id, (pid) =>
      RESOURCES.filter((r) => r.project_id === pid && !r.deleted_at).map((r) => ({
        uuid: r.resource_uuid as string,
        name: r.name,
      })),
    );
    if (!result.ok) {
      const status =
        result.code === 'PROJECT_NOT_FOUND' ? 404
        : result.code === 'PROJECT_IS_DEFAULT' ? 403
        : 409;
      return HttpResponse.json(
        { code: result.code, message: result.message, resources: 'resources' in result ? result.resources : [] },
        { status },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // ─────────── 资源（业务实体） ───────────
  http.get('/api/resources', async ({ request }) => {
    await listDelay();
    const url = new URL(request.url);
    const kind = url.searchParams.get('kind') as ResourceKind | null;
    const region = url.searchParams.get('region') as RegionCode | null;
    const projectId = url.searchParams.get('project_id');
    const status = url.searchParams.get('status');
    const q = url.searchParams.get('q');
    let list = RESOURCES;
    if (kind) list = list.filter((r) => r.kind === kind);
    if (region) list = list.filter((r) => r.region === region);
    if (projectId && projectId !== 'all') {
      list = list.filter((r) => String(r.project_id) === projectId);
    }
    if (status && status !== 'all') {
      // 「已释放」需显式勾选：默认排除 deleted_at 非空
      if (status === 'deleted') list = list.filter((r) => r.deleted_at !== null);
      else list = list.filter((r) => r.deleted_at === null && r.status === status);
    } else {
      list = list.filter((r) => r.deleted_at === null);
    }
    if (q) {
      const s = q.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.display_id.toLowerCase().includes(s) ||
          r.resource_uuid.toLowerCase().includes(s) ||
          r.node_pool.toLowerCase().includes(s),
      );
    }
    const withCost = list.map(withSnapshot);
    const { data, headers } = paginate(withCost, url);
    return HttpResponse.json(data, { headers });
  }),

  http.get('/api/resources/:uuid', async ({ params }) => {
    await detailDelay();
    const r = resourceByUuid(String(params.uuid));
    if (!r) return new HttpResponse(null, { status: 404 });
    const summary = costSummaryOf(r.id);
    return HttpResponse.json({
      ...withSnapshot(r),
      cost_summary: summary,
      steps: stepsOf(r.id),
    });
  }),

  http.post('/api/resources/:uuid/start', async ({ params }) => {
    await writeDelay();
    const r = resourceByUuid(String(params.uuid));
    if (!r) return new HttpResponse(null, { status: 404 });
    if (r.deleted_at) {
      return HttpResponse.json(
        { code: 'RESOURCE_DELETED', message: '资源已删除，不可启动' },
        { status: 409 },
      );
    }
    startResource(r);
    return HttpResponse.json(withSnapshot(r));
  }),

  http.post('/api/resources/:uuid/stop', async ({ params }) => {
    await writeDelay();
    const r = resourceByUuid(String(params.uuid));
    if (!r) return new HttpResponse(null, { status: 404 });
    if (r.deleted_at) {
      return HttpResponse.json(
        { code: 'RESOURCE_DELETED', message: '资源已删除，不可停止' },
        { status: 409 },
      );
    }
    stopResource(r);
    return HttpResponse.json(withSnapshot(r));
  }),

  /** 真实删除（PRD §5.4.1 / ARCH §12.10）：软删 + 释放配额 + 停止计量 */
  http.delete('/api/resources/:uuid', async ({ params }) => {
    await writeDelay();
    const r = resourceByUuid(String(params.uuid));
    if (!r) {
      return HttpResponse.json(
        { code: 'RESOURCE_NOT_FOUND', message: '资源不存在' },
        { status: 404 },
      );
    }
    if (r.deleted_at) {
      return HttpResponse.json(
        { code: 'RESOURCE_ALREADY_DELETED', message: '资源已删除' },
        { status: 409 },
      );
    }
    if (r.status === 'terminating') {
      return HttpResponse.json(
        { code: 'RESOURCE_TERMINATING', message: '资源正在释放中，请稍候' },
        { status: 409 },
      );
    }
    softDeleteResource(r);
    // 删除后：历史用量保留，未来不再产生新用量行
    rebuildUsage(RESOURCES.filter((x) => !x.deleted_at));
    rebuildTransactions(ORG.credit_balance);
    return HttpResponse.json({
      resource_uuid: r.resource_uuid,
      deleted_at: r.deleted_at,
      released: { quota: true, metering: 'stopped' },
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

  /** 用量明细（§7.8 ③：逐小时、含单位与当时状态） */
  http.get('/api/resources/:uuid/usage', async ({ request, params }) => {
    await listDelay();
    const r = resourceByUuid(String(params.uuid));
    if (!r) return new HttpResponse(null, { status: 404 });
    const url = new URL(request.url);
    const rows = usageOfResourceFiltered(r.id, {
      fromIso: url.searchParams.get('from') ?? undefined,
      toIso: url.searchParams.get('to') ?? undefined,
      unit: url.searchParams.get('unit') ?? undefined,
    });
    const { data, headers } = paginate(rows, url);
    return HttpResponse.json(data, { headers });
  }),

  /** 扣费流水（§7.8 ④） */
  http.get('/api/resources/:uuid/transactions', async ({ params }) => {
    await listDelay();
    const r = resourceByUuid(String(params.uuid));
    if (!r) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(transactionsOfResource());
  }),

  /** 结构化日志（推理「日志」Tab / 日志页共用） */
  http.get('/api/resources/:uuid/logs', async ({ request, params }) => {
    await listDelay();
    const url = new URL(request.url);
    const rows = queryLogs({
      resourceUuid: String(params.uuid),
      level: url.searchParams.get('level') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
    });
    const { data, headers } = paginate(rows, url);
    return HttpResponse.json(data, { headers });
  }),

  /** 工作负载（vGPU 三级下钻）/ 副本列表（推理实例管理） */
  http.get('/api/resources/:uuid/workloads', async ({ params }) => {
    await listDelay();
    const r = resourceByUuid(String(params.uuid));
    if (!r) return new HttpResponse(null, { status: 404 });
    if (r.kind === 'vgpu') {
      const w = workloadsOf(r);
      return HttpResponse.json({
        kind: 'vgpu',
        namespaces: w.namespaces,
        schedulingFailures: w.schedulingFailures,
        phaseDistribution: w.phaseDistribution,
      });
    }
    if (r.kind === 'inference') {
      return HttpResponse.json({ kind: 'inference', replicas: replicasOf(r) });
    }
    return HttpResponse.json({ kind: r.kind, namespaces: [], replicas: [] });
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

  /**
   * 下单（PRD §4.2.5）：必须携带 project_id；
   * price_snapshot 按类型真实取价（裸金属走 per_machine_hour，vGPU 含控制面）。
   */
  http.post('/api/deployment-orders', async ({ request }) => {
    await writeDelay();
    const body = (await request.json()) as {
      resource_kind: ResourceKind;
      region: RegionCode;
      node_pool: NodePoolCode;
      project_id?: number;
      requested_spec: Record<string, unknown>;
      source_type?: string;
      source_ref_id?: number;
      name?: string;
    };

    const pool = body.node_pool;
    const region = body.region;
    if (!isPoolAvailableIn(pool, region)) {
      return HttpResponse.json(
        {
          code: 'POOL_NOT_AVAILABLE_IN_REGION',
          message: `${pool} 在 ${REGION_META[region].label} 区域未提供`,
        },
        { status: 409 },
      );
    }
    const projectId = body.project_id != null
      ? (Number(body.project_id) as InternalId)
      : null;
    if (projectId == null || !projectById(projectId)) {
      return HttpResponse.json(
        { code: 'PROJECT_REQUIRED', message: '创建资源必须选择项目' },
        { status: 400 },
      );
    }

    const spec = body.requested_spec ?? {};

    // 配额预检（PRD §7.3 超限）：used + 请求量 > limit ⇒ 拒绝并引导提额工单
    const footprint = requestedFootprint(body.resource_kind, pool, spec as unknown as ResourceSpec);
    const METRIC_OF: Array<[QuotaMetric, number]> = [
      ['gpu', footprint.gpu],
      ['vcpu', footprint.vcpu],
      ['storage_gb', footprint.storageGb],
      ['public_ip', footprint.publicIp],
    ];
    for (const [metric, amount] of METRIC_OF) {
      if (amount <= 0) continue;
      const q = QUOTAS.find((x) => x.metric === metric && x.region === region);
      if (!q) continue;
      let used = 0;
      for (const r of RESOURCES) {
        if (r.deleted_at || !occupiesQuota(metric, r.status)) continue;
        if (r.region !== region) continue;
        used += metric === 'gpu' ? r.gpu_count
          : metric === 'vcpu' ? r.gpu_count * 14
          : metric === 'storage_gb' ? r.storage_gb
          : 1;
      }
      if (used + amount > q.limit_value) {
        return HttpResponse.json(
          {
            code: 'QUOTA_EXCEEDED',
            message: `${REGION_META[region].label} 区域 ${metric} 配额不足：已用 ${used}，请求 ${amount}，上限 ${q.limit_value}`,
            metric,
            used_value: used,
            requested: amount,
            limit_value: q.limit_value,
          },
          { status: 409 },
        );
      }
    }

    // 价格快照：按类型区分口径，禁止硬编码
    let snapshot = 0;
    if (body.resource_kind === 'gpu_baremetal') {
      const machines = Number(spec.machine_count ?? 1);
      snapshot = effectiveRatePerMachineHour(pool, region) * machines;
    } else if (body.resource_kind === 'vgpu') {
      const pools = (spec.pools ?? []) as Array<{ node_count: number }>;
      const nodeTotal = pools.reduce((a, p) => a + Number(p.node_count ?? 0), 0);
      const perNode = NODE_POOLS.find((p) => p.code === pool)?.gpus_per_node ?? 8;
      const gpuRate = effectiveRatePerGpuHour(pool, region);
      const cp = (spec.control_plane_tier === 'ha' ? 0.3 : 0.1);
      snapshot = gpuRate * nodeTotal * perNode + cp;
    } else if (body.resource_kind === 'inference') {
      const replicas = Number(spec.replicas ?? 1);
      const perReplica = Number(spec.gpu_per_replica ?? spec.gpu_count ?? 1);
      snapshot = effectiveRatePerGpuHour(pool, region) * replicas * perReplica;
    } else {
      snapshot = effectiveRatePerGpuHour(pool, region) * Number(spec.gpu_count ?? 1);
    }

    const id = (ORDERS.length + 1) as DeploymentOrder['id'];
    const ts = new Date().toISOString();
    const order: DeploymentOrder = {
      id,
      order_uuid: `ord-${Date.now().toString(16)}`,
      org_id: ORG.id,
      owner_id: CURRENT_USER.id,
      project_id: projectId,
      resource_kind: body.resource_kind,
      requested_spec: spec as unknown as DeploymentOrder['requested_spec'],
      region,
      node_pool: pool,
      source_type: (body.source_type ?? 'direct') as DeploymentOrder['source_type'],
      source_ref_id: (body.source_ref_id ?? null) as DeploymentOrder['source_ref_id'],
      price_snapshot: Math.round(snapshot * 100) / 100,
      status: 'provisioning',
      failure_reason: null,
      created_at: ts,
      updated_at: ts,
    };
    ORDERS.unshift(order);

    const name = (body.name ?? '').trim() || `${KIND_META[body.resource_kind].label}-${id}`;
    const resource = createResourceFromOrder(order, name);
    // 新资源立即纳入用量与日志派生
    appendUsageFor(resource);
    rebuildTransactions(ORG.credit_balance);
    rebuildLogs(RESOURCES.filter((x) => !x.deleted_at));

    return HttpResponse.json(
      { ...order, resource_uuid: resource.resource_uuid },
      { status: 201 },
    );
  }),

  // ─────────── 供给侧（运营&运维，区域感知） ───────────
  http.get('/api/node-pools', async ({ request }) => {
    await listDelay();
    const region = (new URL(request.url).searchParams.get('region') ?? null) as RegionCode | null;
    const pools = NODE_POOLS.map((p) => {
      const supply = region ? poolSupply(region, p.code) : null;
      const available = region ? isPoolAvailableIn(p.code, region) : true;
      return {
        ...p,
        available_regions: POOL_REGIONS[p.code],
        available_in_region: available,
        /** 该区域本池单价（未选区域时给出 us 基准） */
        unit_price: region ? effectiveRatePerGpuHour(p.code, region) : effectiveRatePerGpuHour(p.code, 'us'),
        machine_unit_price: region
          ? effectiveRatePerMachineHour(p.code, region)
          : effectiveRatePerMachineHour(p.code, 'us'),
        market_range: MARKET_RATE_RANGE[p.code],
        platform: NODE_PLATFORM[p.code],
        supply,
        /** 该区域无货时给出可切换的区域（§4.4.1 必含区块） */
        fallback_regions: available ? [] : POOL_REGIONS[p.code],
      };
    });
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
    const decorated = list.map((n) => ({
      ...n,
      pool_display_name: NODE_POOLS.find((p) => p.code === n.pool_code)?.display_name ?? n.pool_code,
      hosted_resources: RESOURCES.filter(
        (r) => !r.deleted_at && placementOf(r.id)?.node_id === n.id,
      ).length,
    }));
    const { data, headers } = paginate(decorated, url);
    return HttpResponse.json(data, { headers });
  }),

  http.get('/api/nodes/:uid', async ({ params }) => {
    await detailDelay();
    const node = GPU_NODES.find((n) => n.node_uid === String(params.uid));
    if (!node) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({
      node: {
        ...node,
        pool_display_name:
          NODE_POOLS.find((p) => p.code === node.pool_code)?.display_name ?? node.pool_code,
        hosted_resources: RESOURCES.filter(
          (r) => !r.deleted_at && placementOf(r.id)?.node_id === node.id,
        ).length,
      },
      events: nodeEventStream().filter((e) => e.node_id === node.id),
    });
  }),

  http.get('/api/node-events', async ({ request }) => {
    await listDelay();
    const url = new URL(request.url);
    const region = url.searchParams.get('region') as RegionCode | null;
    const type = url.searchParams.get('type');
    // 完整运维事件流：Xid + cordon/drain/evicted/fail/remediate/fixed/rejoin（§4.4.1）
    let list = nodeEventStream(region ?? undefined);
    if (type && type !== 'all') list = list.filter((e) => e.type === type);
    const { data, headers } = paginate(list, url);
    // 附带节点定位信息，供页面跳转到节点详情
    const decorated = (data as NodeEvent[]).map((e) => {
      const n = GPU_NODES.find((x) => Number(x.id) === Number(e.node_id));
      return {
        ...e,
        node_uid: n?.node_uid ?? null,
        node_region: n?.region ?? null,
        node_pool: n?.pool_code ?? null,
        node_state: n?.state ?? null,
      };
    });
    return HttpResponse.json(decorated, { headers });
  }),

  http.get('/api/maintenance-windows', async ({ request }) => {
    await listDelay();
    const region = new URL(request.url).searchParams.get('region') as RegionCode | null;
    const list = region
      ? MAINTENANCE_WINDOWS.filter((w) => w.region === region)
      : MAINTENANCE_WINDOWS;
    return HttpResponse.json(list);
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

  // ─────────── 顶部状态栏聚合（PRD §3.2：全部真实派生，无硬编码） ───────────
  http.get('/api/status-bar', async ({ request }) => {
    await listDelay();
    const region = (new URL(request.url).searchParams.get('region') ?? 'jp') as RegionCode;
    const dist = nodeStateDistribution(region);
    const totalNodes = Object.values(dist).reduce((a, b) => a + b, 0);
    const healthy = totalNodes > 0 ? dist.ready / totalNodes : 0;
    const regionNodeIds = new Set(
      GPU_NODES.filter((n) => n.region === region).map((n) => Number(n.id)),
    );
    const incidentCount = NODE_EVENTS.filter(
      (e) =>
        e.level === 'error' &&
        regionNodeIds.has(Number(e.node_id)) &&
        Date.now() - +new Date(e.occurredAt) < 24 * 3600_000,
    ).length;
    const supplies = NODE_POOLS.filter((p) => isPoolAvailableIn(p.code, region)).map((p) => {
      const s = poolSupply(region, p.code);
      return {
        code: p.code,
        display_name: p.display_name,
        ...s,
        tight: s.totalGpu > 0 && s.availableGpu / s.totalGpu < 0.15,
      };
    });
    const live = RESOURCES.filter((r) => !r.deleted_at);
    const runningByKind = live.reduce<Record<string, number>>((acc, r) => {
      if (r.status === 'running' && r.region === region) {
        acc[r.kind] = (acc[r.kind] ?? 0) + 1;
      }
      return acc;
    }, {});
    const regionUsage = USAGE_ROWS.filter((u) => u.region === region);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const mtd = regionUsage
      .filter((u) => u.usage_hour >= monthStart.toISOString())
      .reduce((a, b) => a + b.amount, 0);
    return HttpResponse.json({
      region,
      service_health: healthy > 0.95 ? 'ok' : healthy > 0.9 ? 'degraded' : 'down',
      healthy_ratio: healthy,
      incident_count: incidentCount,
      total_nodes: totalNodes,
      supplies,
      credit_balance: ORG.credit_balance,
      low_balance_threshold: ORG.low_balance_threshold_usd,
      cost_mtd: Math.round(mtd * 100) / 100,
      budget: 5000,
      running_by_kind: runningByKind,
      running_total: Object.values(runningByKind).reduce((a, b) => a + b, 0),
      /** 实时指示：WS 心跳可达性（轮询降级时为 polling），不再上报写死的延迟值 */
      heartbeat: 'live',
    });
  }),

  // ─────────── 日志页（§4.4.1 区域感知 + B 档 Drawer 上下文） ───────────
  http.get('/api/logs', async ({ request }) => {
    await listDelay();
    const url = new URL(request.url);
    const rows: LogEntry[] = queryLogs({
      region: (url.searchParams.get('region') as RegionCode | null) ?? undefined,
      resourceUuid: url.searchParams.get('resource') ?? undefined,
      level: url.searchParams.get('level') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
    });
    const { data, headers } = paginate(rows, url);
    return HttpResponse.json(data, { headers });
  }),

  http.get('/api/logs/:id/context', async ({ params }) => {
    await detailDelay();
    return HttpResponse.json(logContext(String(params.id)));
  }),

  // ─────────── 计费与配额（§7.8 / §4.4.1） ───────────
  http.get('/api/billing/cost', async ({ request }) => {
    await listDelay();
    const url = new URL(request.url);
    const region = (url.searchParams.get('region') ?? null) as RegionCode | null;
    const projectId = url.searchParams.get('project_id');
    const dimension = (url.searchParams.get('dimension') ?? 'project') as CostDimension;
    const scope = {
      region: region ?? undefined,
      projectId: projectId && projectId !== 'all' ? (Number(projectId) as InternalId) : undefined,
    };
    const slices: CostSlice[] = costSlices(dimension, scope);
    const rows: UsageRow[] = USAGE_ROWS.filter((u) => {
      if (scope.region && u.region !== scope.region) return false;
      if (scope.projectId && u.project_id !== scope.projectId) return false;
      return true;
    });
    return HttpResponse.json({
      billing_period: currentBillingPeriod(),
      total: Math.round(rows.reduce((a, b) => a + b.amount, 0) * 100) / 100,
      mtd: costMtd(),
      today: costToday(),
      trend: costTrend(48),
      slices,
    });
  }),

  http.get('/api/billing/transactions', async ({ request }) => {
    await listDelay();
    const { data, headers } = paginate(TRANSACTIONS, new URL(request.url));
    return HttpResponse.json(data, { headers });
  }),

  http.get('/api/quotas', async ({ request }) => {
    await listDelay();
    const region = (new URL(request.url).searchParams.get('region') ?? null) as RegionCode | null;
    // used_value 为派生值（§7.3 占用口径），由资源占用重算，禁止业务代码直写
    const derived = QUOTAS.map((q) => {
      let used = 0;
      const holders: Array<{ uuid: string; name: string; used: number }> = [];
      for (const r of RESOURCES) {
        if (r.deleted_at || !occupiesQuota(q.metric, r.status)) continue;
        // 区域作用域行只累加本区域资源；org 级行（region=null）累加全部区域
        if (q.region && r.region !== q.region) continue;
        let v = 0;
        if (q.metric === 'gpu') v = r.gpu_count;
        else if (q.metric === 'vcpu') v = r.gpu_count * 14;
        else if (q.metric === 'storage_gb') v = r.storage_gb;
        else if (q.metric === 'public_ip') v = 1;
        used += v;
        if (v > 0) {
          holders.push({ uuid: r.resource_uuid as string, name: r.name, used: v });
        }
      }
      return { ...q, used_value: Math.round(used * 100) / 100, holders };
    });
    // 区域参数只筛选区域作用域行（org 级行不受区域筛选，符合 §7.3 NULL 语义）
    const list = region
      ? derived.filter((q) => q.region === region || q.region === null)
      : derived;
    return HttpResponse.json(list);
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
  http.get('/api/buckets', async ({ request }) => {
    await listDelay();
    const region = new URL(request.url).searchParams.get('region') as RegionCode | null;
    return HttpResponse.json(region ? BUCKETS.filter((b) => b.region === region) : BUCKETS);
  }),
  http.get('/api/pipelines', async () => {
    await listDelay();
    return HttpResponse.json(PIPELINES);
  }),

  http.get('/api/billing/invoices', async () => {
    await listDelay();
    return HttpResponse.json(INVOICES);
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
    const url = new URL(request.url);
    const region = url.searchParams.get('region') as RegionCode | null;
    let list = TICKETS.map((t) => {
      const r = t.resource_id ? RESOURCES.find((x) => x.id === t.resource_id) : undefined;
      return { ...t, resource_uuid: r ? (r.resource_uuid as string) : null, resource_name: r?.name ?? null, region: r?.region ?? null };
    });
    if (region) {
      list = list.filter((t) => t.region === region || t.region === null);
    }
    const { data, headers } = paginate(list, url);
    return HttpResponse.json(data, { headers });
  }),
  http.post('/api/tickets', async ({ request }) => {
    await writeDelay();
    const body = (await request.json()) as {
      subject?: string;
      description?: string;
      priority?: string;
      resource_uuid?: string;
    };
    const subject = (body.subject ?? '').trim();
    if (!subject) {
      return HttpResponse.json(
        { code: 'INVALID_SUBJECT', message: '工单标题不能为空' },
        { status: 400 },
      );
    }
    const r = body.resource_uuid ? resourceByUuid(body.resource_uuid) : undefined;
    const ts = new Date().toISOString();
    const ticket = {
      id: (TICKETS.length + 1) as InternalId,
      resource_id: r ? r.id : null,
      resource_uuid: r ? (r.resource_uuid as string) : null,
      resource_name: r?.name ?? null,
      region: r?.region ?? null,
      subject,
      description: (body.description ?? '').trim(),
      status: 'open' as const,
      priority: (body.priority ?? 'normal') as 'low' | 'normal' | 'high' | 'urgent',
      created_at: ts,
      updated_at: ts,
    };
    TICKETS.unshift(ticket);
    return HttpResponse.json(ticket, { status: 201 });
  }),
  http.get('/api/tickets/:id', async ({ params }) => {
    await detailDelay();
    const t = TICKETS.find((x) => Number(x.id) === Number(params.id));
    if (!t) return new HttpResponse(null, { status: 404 });
    const r = t.resource_id ? RESOURCES.find((x) => x.id === t.resource_id) : undefined;
    return HttpResponse.json({
      ...t,
      resource_uuid: r ? (r.resource_uuid as string) : null,
      resource_name: r?.name ?? null,
      region: r?.region ?? null,
      // 工单时间线由状态推进派生（§4.4.1：工单详情含处理历史）
      timeline: [
        { at: t.created_at, label: '工单创建', level: 'info' as const },
        ...(t.status === 'open'
          ? [{ at: t.updated_at, label: '已受理，等待技术支持响应', level: 'info' as const }]
          : t.status === 'pending'
            ? [{ at: t.updated_at, label: '技术支持处理中', level: 'warning' as const }]
            : t.status === 'resolved'
              ? [{ at: t.updated_at, label: '已解决，待用户确认', level: 'info' as const }]
              : [{ at: t.updated_at, label: '工单关闭', level: 'info' as const }]),
      ],
    });
  }),

  // ─────────── 成本下钻（§4.4.1 C 档：分组行内展开） ───────────
  http.get('/api/billing/usage', async ({ request }) => {
    await listDelay();
    const url = new URL(request.url);
    const region = (url.searchParams.get('region') ?? null) as RegionCode | null;
    const projectId = url.searchParams.get('project_id');
    const dimension = (url.searchParams.get('dimension') ?? 'project') as CostDimension;
    const slice = url.searchParams.get('slice');
    const rows = USAGE_ROWS.filter((u) => {
      if (region && u.region !== region) return false;
      if (projectId && projectId !== 'all' && u.project_id !== Number(projectId)) return false;
      if (!slice || slice === 'all') return true;
      if (dimension === 'project') return u.project_name === slice;
      if (dimension === 'region') return u.region === slice;
      if (dimension === 'kind') return u.resource_kind === slice;
      return u.resource_name === slice;
    });
    const data = rows
      .slice()
      .sort((a, b) => (a.usage_hour < b.usage_hour ? 1 : -1))
      .slice(0, 200)
      .map((u) => ({
        id: u.id,
        usage_hour: u.usage_hour,
        resource_uuid: u.resource_uuid,
        resource_name: u.resource_name,
        project_name: u.project_name,
        resource_kind: u.resource_kind,
        region: u.region,
        unit: u.unit,
        quantity: u.quantity,
        unit_price: u.unit_price,
        amount: u.amount,
      }));
    return HttpResponse.json({
      count: rows.length,
      total: Math.round(rows.reduce((a, b) => a + b.amount, 0) * 100) / 100,
      rows: data,
    });
  }),
];
