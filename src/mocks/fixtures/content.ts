// 内容与支撑实体（ARCH §12.5：datasets/buckets/pipelines/notebooks/app_templates/
// tickets/notifications；§12.4：invoices/transactions/vouchers/reservations/storage_packs）
import type {
  AppTemplate,
  BillingTransaction,
  Bucket,
  Dataset,
  Invoice,
  InternalId,
  NotificationItem,
  Pipeline,
  Reservation,
  StoragePack,
  Ticket,
  Voucher,
} from '../../types/domain';
import { rngFor, intBetween } from '../lib/rng';
import { billingPeriodOf } from '../../lib/date';

const now = Date.now();
const iso = (msAgo: number): string => new Date(now - msAgo).toISOString();

// ─────────── 数据模块 ───────────
export const DATASETS: Dataset[] = [
  { id: 1 as InternalId, name: 'imagenet-1k', version: 'v1', size_gb: 148.6, created_at: iso(30 * 86400_000) },
  { id: 2 as InternalId, name: 'c4-en-subset', version: 'v3', size_gb: 892.4, created_at: iso(22 * 86400_000) },
  { id: 3 as InternalId, name: 'chinese-wiki-corpus', version: 'v2', size_gb: 46.2, created_at: iso(15 * 86400_000) },
  { id: 4 as InternalId, name: 'code-instruct-350k', version: 'v1', size_gb: 12.8, created_at: iso(9 * 86400_000) },
  { id: 5 as InternalId, name: 'laion-aesthetic-6p', version: 'v1', size_gb: 1240.5, created_at: iso(4 * 86400_000) },
];

export const BUCKETS: Bucket[] = [
  { id: 1 as InternalId, name: 'runsun-model-weights', region: 'jp', created_at: iso(120 * 86400_000) },
  { id: 2 as InternalId, name: 'runsun-datasets', region: 'jp', created_at: iso(118 * 86400_000) },
  { id: 3 as InternalId, name: 'runsun-checkpoints', region: 'us', created_at: iso(96 * 86400_000) },
  { id: 4 as InternalId, name: 'runsun-logs', region: 'sg', created_at: iso(60 * 86400_000) },
];

export const PIPELINES: Pipeline[] = [
  {
    id: 1 as InternalId,
    name: 'llm-pretrain-etl',
    dag_json: { nodes: ['load', 'dedup', 'tokenize', 'shard'], edges: [['load', 'dedup'], ['dedup', 'tokenize'], ['tokenize', 'shard']] },
    created_at: iso(40 * 86400_000),
  },
  {
    id: 2 as InternalId,
    name: 'image-caption-pipeline',
    dag_json: { nodes: ['fetch', 'resize', 'caption', 'filter'], edges: [['fetch', 'resize'], ['resize', 'caption'], ['caption', 'filter']] },
    created_at: iso(28 * 86400_000),
  },
  {
    id: 3 as InternalId,
    name: 'rag-ingest',
    dag_json: { nodes: ['parse', 'chunk', 'embed', 'upsert'], edges: [['parse', 'chunk'], ['chunk', 'embed'], ['embed', 'upsert']] },
    created_at: iso(11 * 86400_000),
  },
];

// ─────────── 工作台模块 ───────────
// Notebook / IDE 已迁出到 fixtures/notebooks.ts（v0.7 三类挂靠，PRD §4.5.1）
export const APP_TEMPLATES: AppTemplate[] = [
  { id: 1 as InternalId, slug: 'comfyui', name: 'ComfyUI 文生图', category: 'diffusion', default_image_id: 7 as InternalId, form_schema: { fields: [{ name: 'model', type: 'select', options: ['sdxl-1.0'] }] } },
  { id: 2 as InternalId, slug: 'vllm-openai', name: 'vLLM OpenAI 兼容服务', category: 'chatbot', default_image_id: 3 as InternalId, form_schema: { fields: [{ name: 'model', type: 'model' }, { name: 'port', type: 'number', default: 8000 }] } },
  { id: 3 as InternalId, slug: 'rag-stack', name: 'RAG 检索增强栈（BGE + Rerank）', category: 'embedding', default_image_id: 5 as InternalId, form_schema: { fields: [{ name: 'top_k', type: 'number', default: 5 }] } },
  { id: 4 as InternalId, slug: 'llama-factory', name: 'LLaMA-Factory 微调', category: 'finetune', default_image_id: 1 as InternalId, form_schema: { fields: [{ name: 'lora_rank', type: 'number', default: 16 }] } },
  { id: 5 as InternalId, slug: 'ollama-webui', name: 'Ollama + WebUI', category: 'chatbot', default_image_id: 8 as InternalId, form_schema: { fields: [{ name: 'model', type: 'model' }] } },
];

// ─────────── 计费与资产 ───────────
export const INVOICES: Invoice[] = [
  { id: 1 as InternalId, invoice_uuid: 'inv-00000001-2026-09', billing_period: '2026-09-01', subtotal: 8420.36, tax: 0, total: 8420.36, status: 'paid', due_at: '2026-10-05T00:00:00Z', paid_at: '2026-10-03T09:12:00Z' },
  { id: 2 as InternalId, invoice_uuid: 'inv-00000002-2026-08', billing_period: '2026-08-01', subtotal: 7318.9, tax: 0, total: 7318.9, status: 'paid', due_at: '2026-09-05T00:00:00Z', paid_at: '2026-09-04T14:20:00Z' },
  { id: 3 as InternalId, invoice_uuid: 'inv-00000003-2026-07', billing_period: '2026-07-01', subtotal: 5102.44, tax: 0, total: 5102.44, status: 'paid', due_at: '2026-08-05T00:00:00Z', paid_at: '2026-08-02T11:00:00Z' },
  { id: 4 as InternalId, invoice_uuid: 'inv-00000004-2026-10', billing_period: billingPeriodOf(), subtotal: 3284.4, tax: 0, total: 3284.4, status: 'open', due_at: null, paid_at: null },
];

export const TRANSACTIONS: BillingTransaction[] = (() => {
  const rand = rngFor('transactions');
  const list: BillingTransaction[] = [];
  let balance = 5680.0;
  for (let i = 0; i < 24; i++) {
    const isCharge = i % 4 !== 0;
    const amount = isCharge ? -(intBetween(rand, 40, 380) + intBetween(rand, 0, 99) / 100) : 2000;
    balance = Math.round((balance + amount) * 100) / 100;
    list.push({
      id: (i + 1) as InternalId,
      org_id: 1 as InternalId,
      type: isCharge ? 'charge' : 'credit',
      amount: Math.round(amount * 100) / 100,
      balance_after: balance,
      reference_type: isCharge ? 'usage' : 'manual',
      reference_id: isCharge ? `usage-seed-${i}` : `recharge-seed-${i}`,
      summary: isCharge ? '周期用量扣费（初始化种子）' : '账户充值',
      created_at: iso((24 - i) * 3600_000 * 6),
    });
  }
  return list.reverse();
})();

export const VOUCHERS: Voucher[] = [
  { id: 1 as InternalId, code: 'WELCOME-2026-50', amount: 50, balance: 50, applicable_kind: null, applicable_region: null, status: 'unused', valid_from: '2026-06-11T08:00:00Z', valid_to: '2026-12-31T23:59:59Z' },
  { id: 2 as InternalId, code: 'GPU-JP-200', amount: 200, balance: 86.4, applicable_kind: 'gpu_vm', applicable_region: 'jp', status: 'partial', valid_from: '2026-07-01T00:00:00Z', valid_to: '2026-11-30T23:59:59Z' },
  { id: 3 as InternalId, code: 'INFER-500', amount: 500, balance: 500, applicable_kind: 'inference', applicable_region: null, status: 'unused', valid_from: '2026-09-01T00:00:00Z', valid_to: '2027-02-28T23:59:59Z' },
  { id: 4 as InternalId, code: 'EXPIRED-100', amount: 100, balance: 100, applicable_kind: null, applicable_region: null, status: 'expired', valid_from: '2026-01-01T00:00:00Z', valid_to: '2026-03-31T23:59:59Z' },
];

export const RESERVATIONS: Reservation[] = [
  { id: 1 as InternalId, node_pool: 'H100_SXM', region: 'jp', gpu_count: 16, committed_price_per_gpu_hour: 2.44, start_at: '2026-08-01T00:00:00Z', end_at: '2027-07-31T23:59:59Z', status: 'active' },
  { id: 2 as InternalId, node_pool: 'H200_NVL', region: 'us', gpu_count: 8, committed_price_per_gpu_hour: 3.35, start_at: '2026-09-15T00:00:00Z', end_at: '2027-09-14T23:59:59Z', status: 'active' },
  { id: 3 as InternalId, node_pool: 'B200_NVL72', region: 'us', gpu_count: 72, committed_price_per_gpu_hour: 5.24, start_at: '2026-11-01T00:00:00Z', end_at: '2027-10-31T23:59:59Z', status: 'scheduled' },
];

export const STORAGE_PACKS: StoragePack[] = [
  { id: 1 as InternalId, size_gb: 5000, remaining_gb: 3182.4, valid_from: '2026-07-01T00:00:00Z', valid_to: '2027-06-30T23:59:59Z' },
  { id: 2 as InternalId, size_gb: 1000, remaining_gb: 96.2, valid_from: '2026-05-01T00:00:00Z', valid_to: '2026-12-31T23:59:59Z' },
];

// ─────────── 通知与工单 ───────────
export const NOTIFICATIONS: NotificationItem[] = [
  { id: 1 as InternalId, type: 'node_notready', level: 'error', title: '节点 NotReady', body: 'node-jp-h100-005 因 Xid 79 进入 NotReady，受影响实例 2 个。', link: '/cluster/nodes', read_at: null, created_at: iso(18 * 60_000) },
  { id: 2 as InternalId, type: 'balance_alert', level: 'warning', title: '余额预警', body: '账户余额 $1,234.56 已接近阈值 $50 预警线，请及时充值以避免限新建。', link: '/operations/cost', read_at: null, created_at: iso(52 * 60_000) },
  { id: 3 as InternalId, type: 'task_failed', level: 'error', title: '供给失败', body: 'deepseek-v3-canary 供给失败：InsufficientCapacity，可重试或更换节点池。', link: '/resources/inference', read_at: null, created_at: iso(30 * 60_000) },
  { id: 4 as InternalId, type: 'gpu_memory_pressure', level: 'warning', title: '显存压力', body: 'llm-pretrain-01 GPU 3 显存 96.5%，建议降低 batch_size。', link: '/resources/servers', read_at: iso(2 * 3600_000), created_at: iso(3 * 3600_000) },
  { id: 5 as InternalId, type: 'hpa_scale', level: 'info', title: 'HPA 扩容完成', body: 'qwen-72b-prod 副本 3 → 6，月度成本预计 +$1,283。', link: '/resources/inference', read_at: iso(5 * 3600_000), created_at: iso(5 * 3600_000) },
];

export const TICKETS: Ticket[] = [
  { id: 1 as InternalId, resource_id: 7 as InternalId, subject: 'B300 节点供给失败', description: 'bm-b300-sg02 持续供给失败，提示容量不足，希望确认 SG 区域 B300 到货时间。', status: 'open', priority: 'high', created_at: iso(20 * 3600_000), updated_at: iso(4 * 3600_000) },
  { id: 2 as InternalId, resource_id: 14 as InternalId, subject: 'DeepSeek-V3 部署显存不足', description: '671B MoE 在 B200 8 卡上加载失败，需确认推荐部署形态。', status: 'pending', priority: 'normal', created_at: iso(6 * 3600_000), updated_at: iso(2 * 3600_000) },
  { id: 3 as InternalId, resource_id: null, subject: '申请提高 GPU 配额', description: '当前 GPU 配额 64，申请提升至 128 用于下季度训练。', status: 'resolved', priority: 'normal', created_at: iso(9 * 86400_000), updated_at: iso(7 * 86400_000) },
  { id: 4 as InternalId, resource_id: 1 as InternalId, subject: 'IB 链路偶发 down', description: '训练过程中 mlx5_2 偶发 link down，通信开销升至 43%。', status: 'closed', priority: 'urgent', created_at: iso(21 * 86400_000), updated_at: iso(19 * 86400_000) },
];
