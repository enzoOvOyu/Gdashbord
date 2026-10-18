// 共享类型与取数钩子（ARCH §12.11 接口契约的前端类型化）
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BillingTransaction,
  CostSlice,
  DeploymentOrder,
  InternalId,
  LogEntry,
  NodeEvent,
  NodePoolCode,
  ProvisioningStep,
  Quota,
  RegionCode,
  Resource,
  ResourceEvent,
  ResourceKind,
  Ticket,
  UsageRow,
} from '../../types/domain';
import { EP, api, withQuery } from '../../lib/api-client';
// 时序契约类型（仅类型引用，编译期擦除；运行时不依赖 mock）
import type { MetricSeries } from '../../mocks/metrics';
import { useRegionStore } from '../../stores/auth';

// ─────────── 响应类型 ───────────
export interface CostSnapshotView {
  unit: 'per_gpu_hour' | 'per_gb_hour' | 'per_instance_hour' | 'per_machine_hour' | 'per_cluster_hour';
  quantity: number;
  unit_price: number;
  control_plane_per_hour: number;
  storage_per_month: number;
  storage_per_hour: number;
  compute_per_hour: number;
  per_hour: number;
  per_month: number;
  remaining_hours: number | null;
  metering_note: string;
}

export interface ResourceListItem extends Resource {
  project_name: string;
  cost: CostSnapshotView;
}

export interface ResourceDetail extends Resource {
  project_name: string;
  cost: CostSnapshotView;
  cost_summary: {
    today: number;
    mtd: number;
    total: number;
    gpu_hours: number;
    storage_gb_hours: number;
    machine_hours: number;
    cluster_hours: number;
  };
  steps: ProvisioningStep[];
  placement: { rack_id: string | null; node_id: InternalId | null; gpu_indices: number[] } | null;
  order: DeploymentOrder | null;
}

export interface PoolSupplyView {
  totalGpu: number;
  availableGpu: number;
  allocatedGpu: number;
  nodeCount: number;
}

export interface NodePoolView {
  code: NodePoolCode;
  display_name: string;
  gpu_model: string;
  gpus_per_node: number;
  vram_gb: number;
  interconnect: string;
  available_regions: RegionCode[];
  available_in_region: boolean;
  unit_price: number;
  machine_unit_price: number;
  market_range: [number, number];
  platform: { cpu: string; localNvme: string; network: string };
  supply: PoolSupplyView | null;
  fallback_regions: RegionCode[];
}

export interface NodeView {
  id: InternalId;
  node_uid: string;
  pool_code: NodePoolCode;
  pool_display_name: string;
  region: RegionCode;
  rack_id: string | null;
  switch_group: string | null;
  gpu_count: number;
  state: string;
  straggler: boolean;
  updated_at: string;
  hosted_resources: number;
}

export interface CostResponse {
  billing_period: string;
  total: number;
  mtd: number;
  today: number;
  trend: Array<{ ts: string; amount: number }>;
  slices: CostSlice[];
}

export interface QuotaView extends Quota {
  holders: Array<{ uuid: string; name: string; used: number }>;
}

export interface TicketView extends Ticket {
  resource_uuid: string | null;
  resource_name: string | null;
  region: RegionCode | null;
}

export interface NodeEventView extends NodeEvent {
  node_uid: string | null;
  node_region: RegionCode | null;
  node_pool: NodePoolCode | null;
  node_state: string | null;
}

export interface MaintenanceWindowView {
  id: string;
  region: RegionCode;
  pool_code: NodePoolCode;
  starts_at: string;
  ends_at: string;
  impacted_nodes: number;
  impacted_gpu: number;
  status: 'scheduled' | 'in_progress' | 'completed';
  reason: string;
}

export interface NodeDetailView {
  node: {
    id: InternalId;
    node_uid: string;
    pool_code: NodePoolCode;
    pool_display_name: string;
    region: RegionCode;
    rack_id: string | null;
    switch_group: string | null;
    gpu_count: number;
    state: string;
    straggler: boolean;
    updated_at: string;
    hosted_resources: number;
  };
  events: NodeEvent[];
}

export interface StatusBarView {
  region: RegionCode;
  service_health: string;
  healthy_ratio: number;
  incident_count: number;
  total_nodes: number;
  supplies: Array<{ code: NodePoolCode; display_name: string; totalGpu: number; availableGpu: number; allocatedGpu: number; tight: boolean }>;
  credit_balance: number;
  low_balance_threshold: number;
  cost_mtd: number;
  budget: number;
  running_by_kind: Record<string, number>;
  running_total: number;
  heartbeat: string;
}

// ─────────── 页面级区域上下文（PRD §3.3） ───────────
/** 每页独立区域上下文：切换后 Query key 变化，接口按 region 真实重算 */
export function usePageRegion(): [RegionCode, (r: RegionCode) => void] {
  const region = useRegionStore((st) => st.region);
  const setRegion = useRegionStore((st) => st.setRegion);
  return [region, setRegion];
}

// ─────────── 取数钩子 ───────────
export const QK = {
  resources: 'resources',
  resource: 'resource',
  pools: 'node-pools',
  nodes: 'nodes',
  nodeEvents: 'node-events',
  logs: 'logs',
  cost: 'cost',
  quotas: 'quotas',
  tickets: 'tickets',
  projects: 'projects',
  statusBar: 'status-bar',
  metrics: 'metrics',
  usage: 'usage',
  transactions: 'transactions',
};

export function useResources(params: {
  kind?: ResourceKind;
  region?: RegionCode;
  projectId?: number | 'all';
  status?: string;
  q?: string;
}) {
  return useQuery<ResourceListItem[]>({
    queryKey: [QK.resources, params],
    queryFn: () =>
      api.get<ResourceListItem[]>(
        withQuery(EP.resources, {
          kind: params.kind,
          region: params.region,
          project_id: params.projectId,
          status: params.status,
          q: params.q,
        }),
      ),
  });
}

export function useResource(uuid: string | undefined) {
  return useQuery<ResourceDetail>({
    queryKey: [QK.resource, uuid],
    queryFn: () => api.get<ResourceDetail>(EP.resource(uuid as string)),
    enabled: Boolean(uuid),
    refetchInterval: (q) =>
      q.state.data?.status === 'provisioning' ? 3000 : false,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: [QK.projects],
    queryFn: () => api.get(EP.projects),
    staleTime: 60_000,
  });
}

export function useNodePools(region?: RegionCode) {
  return useQuery<NodePoolView[]>({
    queryKey: [QK.pools, region],
    queryFn: () => api.get<NodePoolView[]>(withQuery(EP.nodePools, { region })),
  });
}

export function useNodes(region?: RegionCode, state?: string) {
  return useQuery<NodeView[]>({
    queryKey: [QK.nodes, region, state],
    queryFn: () =>
      api.get<NodeView[]>(withQuery(EP.nodes, { region, state: state === 'all' ? undefined : state })),
  });
}

export function useMetrics(uuid: string | undefined, range: string) {
  return useQuery<MetricSeries[]>({
    queryKey: [QK.metrics, uuid, range],
    queryFn: () =>
      api.get<MetricSeries[]>(`${EP.metrics(uuid as string)}?range=${range}`),
    enabled: Boolean(uuid),
  });
}

export function useUsage(uuid: string | undefined) {
  return useQuery<UsageRow[]>({
    queryKey: [QK.usage, uuid],
    queryFn: () => api.get<UsageRow[]>(EP.resourceUsage(uuid as string)),
    enabled: Boolean(uuid),
  });
}

export function useTransactions(uuid: string | undefined) {
  return useQuery<BillingTransaction[]>({
    queryKey: [QK.transactions, uuid],
    queryFn: () => api.get<BillingTransaction[]>(EP.resourceTransactions(uuid as string)),
    enabled: Boolean(uuid),
  });
}

export function useLogs(uuid: string | undefined, level: string, q: string) {
  return useQuery<LogEntry[]>({
    queryKey: [QK.logs, 'resource', uuid, level, q],
    queryFn: () =>
      api.get<LogEntry[]>(
        withQuery(EP.resourceLogs(uuid as string), {
          level: level === 'all' ? undefined : level,
          q,
          size: 200,
        }),
      ),
    enabled: Boolean(uuid),
  });
}

export function useEvents(uuid: string | undefined) {
  return useQuery<ResourceEvent[]>({
    queryKey: ['events', uuid],
    queryFn: () => api.get<ResourceEvent[]>(EP.resourceEvents(uuid as string)),
    enabled: Boolean(uuid),
  });
}

export function useCost(params: {
  region?: RegionCode;
  projectId?: number | 'all';
  dimension: string;
}) {
  return useQuery<CostResponse>({
    queryKey: [QK.cost, params],
    queryFn: () =>
      api.get<CostResponse>(
        withQuery(EP.cost, {
          region: params.region,
          project_id: params.projectId,
          dimension: params.dimension,
        }),
      ),
  });
}

export function useQuotas(region?: RegionCode) {
  return useQuery<QuotaView[]>({
    queryKey: [QK.quotas, region],
    queryFn: () => api.get<QuotaView[]>(withQuery(EP.quotas, { region })),
  });
}

export function useTickets(region?: RegionCode) {
  return useQuery<TicketView[]>({
    queryKey: [QK.tickets, region],
    queryFn: () => api.get<TicketView[]>(withQuery(EP.tickets, { region })),
  });
}

export function useNodeEvents(region?: RegionCode, type?: string) {
  return useQuery<NodeEventView[]>({
    queryKey: [QK.nodeEvents, region, type],
    queryFn: () =>
      api.get<NodeEventView[]>(
        withQuery(EP.nodeEvents, {
          region,
          type: type === 'all' ? undefined : type,
          size: 200,
        }),
      ),
  });
}

/** 运维日志（全局，按 region + 关键字过滤；§4.4.1 日志页） */
export function useLogList(params: { region?: RegionCode; level?: string; q?: string }) {
  return useQuery<LogEntry[]>({
    queryKey: [QK.logs, 'global', params],
    queryFn: () =>
      api.get<LogEntry[]>(
        withQuery(EP.logs, {
          region: params.region,
          level: params.level === 'all' ? undefined : params.level,
          q: params.q,
          size: 200,
        }),
      ),
  });
}

/** 日志上下文（前后各 50 行，§3.4 B 档 Drawer） */
export function useLogContext(id: string | null) {
  return useQuery<LogEntry[]>({
    queryKey: [QK.logs, 'context', id],
    queryFn: () => api.get<LogEntry[]>(EP.logContext(id as string)),
    enabled: Boolean(id),
  });
}

export function useMaintenanceWindows(region?: RegionCode) {
  return useQuery<MaintenanceWindowView[]>({
    queryKey: ['maintenance-windows', region],
    queryFn: () =>
      api.get<MaintenanceWindowView[]>(withQuery(EP.maintenanceWindows, { region })),
  });
}

export function useNode(uid: string | undefined) {
  return useQuery<NodeDetailView>({
    queryKey: [QK.nodes, 'detail', uid],
    queryFn: () => api.get<NodeDetailView>(EP.node(uid as string)),
    enabled: Boolean(uid),
  });
}

export function useNodeStateDist(region?: RegionCode) {
  return useQuery<Record<string, number>>({
    queryKey: ['node-state-dist', region],
    queryFn: () => api.get<Record<string, number>>(withQuery(EP.clusterDist, { region })),
  });
}

/** 工单详情（A 档整页 /ops/tickets/:id） */
export function useTicket(id: string | undefined) {
  return useQuery<TicketView & { timeline: Array<{ at: string; label: string; level: string }> }>({
    queryKey: [QK.tickets, 'detail', id],
    queryFn: () =>
      api.get<TicketView & { timeline: Array<{ at: string; label: string; level: string }> }>(
        EP.ticket(id as string),
      ),
    enabled: Boolean(id),
  });
}

export interface UsageSliceRow {
  id: InternalId;
  usage_hour: string;
  resource_uuid: string;
  resource_name: string;
  project_name: string;
  resource_kind: ResourceKind;
  region: RegionCode;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

/** 成本下钻：某切片下的逐小时用量（C 档行内展开） */
export function useUsageSlice(params: {
  region?: RegionCode;
  projectId?: number | 'all';
  dimension: string;
  slice: string | null;
}) {
  return useQuery<{ count: number; total: number; rows: UsageSliceRow[] }>({
    queryKey: [QK.usage, 'slice', params],
    queryFn: () =>
      api.get<{ count: number; total: number; rows: UsageSliceRow[] }>(
        withQuery(EP.billingUsage, {
          region: params.region,
          project_id: params.projectId,
          dimension: params.dimension,
          slice: params.slice,
        }),
      ),
    enabled: Boolean(params.slice),
  });
}

export function useStatusBar(region: RegionCode) {
  return useQuery<StatusBarView>({
    queryKey: [QK.statusBar, region],
    queryFn: () => api.get<StatusBarView>(withQuery(EP.statusBar, { region })),
    refetchInterval: 30_000,
  });
}

// ─────────── 写操作（真实落地） ───────────
export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => api.del<{ deleted_at: string }>(EP.resource(uuid)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK.resources] });
      void qc.invalidateQueries({ queryKey: [QK.quotas] });
      void qc.invalidateQueries({ queryKey: [QK.cost] });
      void qc.invalidateQueries({ queryKey: [QK.statusBar] });
    },
  });
}

export type LifecycleAction = 'start' | 'stop';

export function useLifecycleAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, action }: { uuid: string; action: LifecycleAction }) =>
      api.post<ResourceListItem>(
        action === 'start' ? EP.resourceStart(uuid) : EP.resourceStop(uuid),
        {},
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK.resources] });
      void qc.invalidateQueries({ queryKey: [QK.resource] });
    },
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<{ resource_uuid: string; price_snapshot: number }>(EP.orders, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK.resources] });
      void qc.invalidateQueries({ queryKey: [QK.quotas] });
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; default_region?: RegionCode }) =>
      api.post(EP.projects, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK.projects] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(EP.project(id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK.projects] });
    },
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post(EP.tickets, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK.tickets] });
    },
  });
}
