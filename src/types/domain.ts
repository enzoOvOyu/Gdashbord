// 领域类型：与 ARCHITECTURE §12 DDL 同构（§6 契约同源 / §12.8 边界）
// 枚举单一事实来源：PRD §5.2.1 · §9.1 · §9.2 ↔ ARCH §12.6（禁止第二套命名）

// ─────────── 枚举（落库值，小写） ───────────
export type RegionCode = 'jp' | 'th' | 'sg' | 'us';
export type NodePoolCode =
  | 'H100_SXM'
  | 'H200_NVL'
  | 'B200_NVL72'
  | 'B300'
  | 'GB300_NVL72';
export type ResourceKind = 'gpu_vm' | 'gpu_baremetal' | 'vgpu' | 'inference';
/** 资源生命周期 5 态 + deleted_at 软删终态（PRD §5.4，闭环） */
export type ResourceStatus =
  | 'provisioning'
  | 'running'
  | 'stopped'
  | 'error'
  | 'terminating';
export type NodeState =
  | 'ready'
  | 'cordoned'
  | 'draining'
  | 'remediation'
  | 'notready';
export type UserRole = 'owner' | 'admin' | 'member' | 'billing' | 'viewer';
export type OrderStatus = 'pending' | 'provisioning' | 'fulfilled' | 'failed';
export type StepState = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
export type EventLevel = 'info' | 'warning' | 'error' | 'success';
export type RateUnit = 'per_gpu_hour' | 'per_gb_hour' | 'per_instance_hour';
export type QuotaMetric = 'gpu' | 'vcpu' | 'storage_gb' | 'public_ip';
export type SourceType = 'direct' | 'image' | 'model' | 'template' | 'notebook';
export type InvoiceStatus = 'open' | 'paid' | 'overdue' | 'void';
export type TxnType = 'charge' | 'refund' | 'credit' | 'adjustment';
export type VoucherStatus = 'unused' | 'partial' | 'used' | 'expired' | 'void';
export type ReservationStatus =
  | 'scheduled'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'refunded';
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

// ─────────── 品牌类型 ID（PRD §5.5 / ARCH §6，禁止混用） ───────────
export type ResourceUuid = string & { readonly __brand: 'ResourceUuid' };
export type DisplayId = string & { readonly __brand: 'DisplayId' };
/** 内部主键 BIGINT：仅内部使用，禁止出现在接口响应与 URL（PRD §5.5） */
export type InternalId = number & { readonly __brand: 'InternalId' };

export const asResourceUuid = (v: string): ResourceUuid => v as ResourceUuid;
export const asDisplayId = (v: string): DisplayId => v as DisplayId;
export const asInternalId = (v: number): InternalId => v as InternalId;

// ─────────── spec_json 契约（ARCH §12.9，Zod 校验） ───────────
export interface GpuVmSpec {
  gpu_model: string;
  gpu_count: number;
  vcpu: number;
  memory_gb: number;
  storage_gb: number;
  image_ref: string;
  env?: Record<string, string>;
  ports?: number[];
  ssh_pubkey?: string;
}
export interface GpuBareMetalSpec {
  machine_type: string;
  gpu_model: string;
  gpu_count: number;
  passthrough: boolean;
  cpu_model: string;
  local_nvme_gb: number;
  ipmi_enabled?: boolean;
  ib_enabled?: boolean;
}
export interface VgpuSpec {
  k8s_version: string;
  node_count: number;
  gpu_count: number;
  slicing_policy: string;
  storage_gb: number;
  network_plugin?: string;
  ingress_enabled?: boolean;
}
export interface InferenceSpec {
  model_ref: string;
  replicas: number;
  gpu_count: number;
  port: number;
  auth_enabled: boolean;
  hpa?: { min: number; max: number; target: string };
  traffic_split?: Array<{ version: string; weight: number }>;
}
export type ResourceSpec =
  | GpuVmSpec
  | GpuBareMetalSpec
  | VgpuSpec
  | InferenceSpec;

// ─────────── 实体（字段与 ARCH §12 DDL 对齐） ───────────
export interface Plan {
  code: 'free' | 'standard' | 'enterprise';
  name: string;
  free_credit_usd: number;
  max_members: number;
  support_level: string;
}
export interface Org {
  id: InternalId;
  name: string;
  slug: string;
  plan_code: Plan['code'];
  credit_balance: number;
  currency: string;
  low_balance_threshold_usd: number;
  created_at: string;
}
export interface User {
  id: InternalId;
  uuid: string;
  org_id: InternalId;
  email: string;
  display_name: string;
  role: UserRole;
  status: string;
}
export interface Project {
  id: InternalId;
  org_id: InternalId;
  name: string;
  slug: string;
}

/** 资源实例主表（resources）— 对外暴露 resource_uuid / display_id */
export interface Resource {
  id: InternalId;
  resource_uuid: ResourceUuid;
  display_id: DisplayId;
  org_id: InternalId;
  owner_id: InternalId;
  project_id: InternalId | null;
  order_id: InternalId | null;
  kind: ResourceKind;
  name: string;
  region: RegionCode;
  node_pool: NodePoolCode;
  spec_json: ResourceSpec;
  gpu_count: number;
  storage_gb: number;
  status: ResourceStatus;
  running_since: string | null;
  stopped_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export interface DeploymentOrder {
  id: InternalId;
  order_uuid: string;
  org_id: InternalId;
  owner_id: InternalId;
  project_id: InternalId | null;
  resource_kind: ResourceKind;
  requested_spec: ResourceSpec;
  region: RegionCode;
  node_pool: NodePoolCode | null;
  source_type: SourceType;
  source_ref_id: InternalId | null;
  price_snapshot: number | null;
  status: OrderStatus;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}
export interface ProvisioningStep {
  id: InternalId;
  resource_id: InternalId;
  seq: number;
  step_key: 'schedule' | 'provision' | 'pull_image' | 'attach_storage' | 'ready';
  state: StepState;
  message: string | null;
  started_at: string | null;
  finished_at: string | null;
}
export interface ResourcePlacement {
  id: InternalId;
  resource_id: InternalId;
  node_pool: NodePoolCode;
  node_id: InternalId | null;
  rack_id: string | null;
  gpu_indices: number[];
  assigned_at: string;
}
/** 有意义事件契约（MOCK-DATA §9.1，必带 before/after 度量） */
export interface MonitorEvent {
  id: string;
  occurredAt: string;
  level: EventLevel;
  source: string;
  code: string;
  title: string;
  detail: string;
  metricsBefore?: Record<string, number | string>;
  metricsAfter?: Record<string, number | string>;
  relatedResource?: { kind: string; uuid: string; label: string };
  correlationId?: string;
  suggestedAction?: string;
}
export interface ResourceEvent extends MonitorEvent {
  resource_id: InternalId;
  type: string;
  actor_user_id: InternalId | null;
}

export interface NodePool {
  code: NodePoolCode;
  display_name: string;
  gpu_model: string;
  gpus_per_node: number;
  vram_gb: number;
  interconnect: string;
}
export interface GpuNode {
  id: InternalId;
  node_uid: string;
  pool_code: NodePoolCode;
  region: RegionCode;
  rack_id: string | null;
  switch_group: string | null;
  gpu_count: number;
  state: NodeState;
  straggler: boolean;
  updated_at: string;
}
export interface NodeEvent extends MonitorEvent {
  node_id: InternalId;
  type: string;
  actor_user_id: InternalId | null;
}

export interface BillingUsage {
  id: InternalId;
  org_id: InternalId;
  project_id: InternalId | null;
  resource_id: InternalId;
  resource_kind: ResourceKind;
  node_pool: NodePoolCode;
  region: RegionCode;
  unit: RateUnit;
  quantity: number;
  unit_price: number;
  amount: number;
  billing_period: string;
  usage_hour: string;
}
export interface Quota {
  id: InternalId;
  org_id: InternalId;
  resource_kind: ResourceKind | null;
  region: RegionCode | null;
  metric: QuotaMetric;
  limit_value: number;
  used_value: number;
}
export interface Voucher {
  id: InternalId;
  code: string;
  amount: number;
  balance: number;
  applicable_kind: ResourceKind | null;
  applicable_region: RegionCode | null;
  status: VoucherStatus;
  valid_from: string;
  valid_to: string;
}
export interface Reservation {
  id: InternalId;
  node_pool: NodePoolCode;
  region: RegionCode;
  gpu_count: number;
  committed_price_per_gpu_hour: number;
  start_at: string;
  end_at: string;
  status: ReservationStatus;
}
export interface StoragePack {
  id: InternalId;
  size_gb: number;
  remaining_gb: number;
  valid_from: string;
  valid_to: string;
}
export interface Invoice {
  id: InternalId;
  invoice_uuid: string;
  billing_period: string;
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  due_at: string | null;
  paid_at: string | null;
}
export interface BillingTransaction {
  id: InternalId;
  type: TxnType;
  amount: number;
  balance_after: number;
  reference_type: string | null;
  created_at: string;
}

export interface ModelItem {
  id: InternalId;
  slug: string;
  name: string;
  source: 'hf_mirror' | 'official' | 'community';
  modality: string;
  param_size: string;
  license: string;
  quantization: string | null;
  description: string;
  /** 权重体积 GB（用于 §7.3/§7.4 派生：单卡可行性 / KV cache / 加载时长） */
  weights_gb: number;
  context_tokens: number;
  favorite?: boolean;
}
export interface ImageItem {
  id: InternalId;
  name: string;
  registry: string;
  tag: string;
  framework: string;
  cuda_version: string;
  size_gb: number;
  is_official: boolean;
}
export interface AppTemplate {
  id: InternalId;
  slug: string;
  name: string;
  category: string;
  default_image_id: InternalId | null;
  form_schema: Record<string, unknown>;
}
export interface NotebookItem {
  id: InternalId;
  resource_id: InternalId | null;
  type: 'jupyter' | 'vscode';
  status: string;
  url_path: string;
  created_at: string;
}
export interface Dataset {
  id: InternalId;
  name: string;
  version: string;
  size_gb: number;
  created_at: string;
}
export interface Bucket {
  id: InternalId;
  name: string;
  region: RegionCode;
  created_at: string;
}
export interface Pipeline {
  id: InternalId;
  name: string;
  dag_json: Record<string, unknown>;
  created_at: string;
}
export interface Ticket {
  id: InternalId;
  resource_id: InternalId | null;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
}
export interface NotificationItem {
  id: InternalId;
  type: string;
  level: EventLevel;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}
