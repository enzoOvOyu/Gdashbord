// 供给侧：节点池 / GPU 节点 / 节点事件（ARCH §12.3 · PRD §9 · MOCK-DATA §5.3/§6.6.1）
// G7「不完美即真实」：必须存在非 Ready 节点，且每个非 Ready 节点 MUST 有匹配的 Xid 事件（§6.6.1）。
import type {
  GpuNode,
  InternalId,
  NodeEvent,
  NodePool,
  NodePoolCode,
  NodeState,
  RegionCode,
} from '../../types/domain';
import { GPU_SPECS } from './gpu-specs';
import { POOL_CAPACITY, POOL_REGIONS } from './regions-pools';
import { intBetween, rngFor } from '../lib/rng';

export const NODE_POOLS: NodePool[] = (Object.keys(GPU_SPECS) as NodePoolCode[]).map((code) => {
  const s = GPU_SPECS[code];
  return {
    code,
    display_name: code === 'B200_NVL72' ? 'B200 NVL72（GB200 机柜）' : code.replace('_', ' '),
    gpu_model: s.productName,
    gpus_per_node: s.gpusPerNode,
    vram_gb: s.vramGb,
    interconnect: s.nvlink,
  };
});

export const nodePoolByCode = (code: NodePoolCode): NodePool | undefined =>
  NODE_POOLS.find((p) => p.code === code);

/** NVIDIA Xid 标准（§6.6.1）— 非 Ready 节点必须有匹配 Xid 事件 */
const XID_TABLE = [
  { xid: 13, meaning: 'Graphics Engine Exception', action: '进程终止，节点保持 Ready，记录事件' },
  { xid: 31, meaning: 'MMU Fault', action: '进程终止，节点保持 Ready，记录事件' },
  { xid: 48, meaning: 'Double Bit ECC Error (DBE)', action: '立即 Cordoned → Remediation' },
  { xid: 63, meaning: 'Row remapping event（页退役）', action: '事件记录，计数累加' },
  { xid: 64, meaning: 'Row remapping failure', action: '→ Remediation' },
  { xid: 74, meaning: 'NVLink Error', action: '→ NotReady → Remediation' },
  { xid: 79, meaning: 'GPU fallen off the bus', action: '→ NotReady → Remediation' },
  { xid: 94, meaning: 'Contained ECC error', action: '事件记录，重启可回收' },
  { xid: 109, meaning: 'Context switch timeout', action: '事件记录，进程级' },
] as const;

export const XID_TABLE_EXPORT = XID_TABLE;

const STATES: NodeState[] = ['ready', 'cordoned', 'draining', 'remediation', 'notready'];

/** 按 §5.3 占比区间生成节点状态（G7：必须存在非 Ready） */
function pickState(rand: () => number, index: number): NodeState {
  const r = rand();
  // 前若干节点强制构造非 Ready，确保健康视图有意义
  if (index % 23 === 5) return 'notready';
  if (index % 31 === 7) return 'cordoned';
  if (index % 41 === 11) return 'draining';
  if (index % 37 === 13) return 'remediation';
  if (r < 0.91) return 'ready';
  return STATES[intBetween(rand, 1, 4)];
}

function buildNodes(): GpuNode[] {
  const nodes: GpuNode[] = [];
  let id = 1;
  for (const pool of Object.keys(POOL_CAPACITY) as NodePoolCode[]) {
    const regions = POOL_REGIONS[pool];
    for (const region of regions) {
      const total = POOL_CAPACITY[pool][region] ?? 0;
      // 演示规模：按比例缩放到可渲染数量（真实容量见 POOL_CAPACITY）
      const demoCount = Math.max(4, Math.min(18, Math.round(total / 16)));
      for (let i = 0; i < demoCount; i++) {
        const rand = rngFor(`node:${pool}:${region}:${i}`);
        const state = pickState(rand, id);
        const spec = GPU_SPECS[pool];
        nodes.push({
          id: id as InternalId,
          node_uid: `node-${region}-${pool.toLowerCase()}-${String(i + 1).padStart(3, '0')}`,
          pool_code: pool,
          region: region as RegionCode,
          rack_id: `rack-${region}-${String(intBetween(rand, 1, 12)).padStart(2, '0')}`,
          switch_group: `sw-${region}-${String(intBetween(rand, 1, 4)).padStart(2, '0')}`,
          gpu_count: spec.gpusPerNode,
          state,
          straggler: state === 'ready' && rand() < 0.06,
          updated_at: new Date(Date.now() - intBetween(rand, 1, 120) * 60_000).toISOString(),
        });
        id++;
      }
    }
  }
  return nodes;
}

export const GPU_NODES: GpuNode[] = buildNodes();

/** 节点事件：非 Ready / Remediation 节点 MUST 有匹配 Xid 事件（§6.6.1） */
function buildNodeEvents(nodes: GpuNode[]): NodeEvent[] {
  const events: NodeEvent[] = [];
  let i = 0;
  for (const n of nodes) {
    const rand = rngFor(`nodeevent:${n.node_uid}`);
    if (n.state === 'ready' && !n.straggler) {
      // Ready 节点也可能有历史可恢复事件（Xid 13/31）
      if (rand() < 0.12) {
        const x = XID_TABLE[intBetween(rand, 0, 1)];
        events.push({
          id: `ne-${++i}`,
          node_id: n.id,
          occurredAt: new Date(Date.now() - intBetween(rand, 2, 72) * 3600_000).toISOString(),
          level: 'warning',
          source: 'dcgm',
          type: `XID_${x.xid}`,
          code: `XID_${x.xid}`,
          title: `检测到 Xid ${x.xid}（${x.meaning}）`,
          detail: `GPU ${intBetween(rand, 0, 7)} 触发 Xid ${x.xid}：${x.meaning}；${x.action}。进程已终止，节点保持 Ready。`,
          metricsBefore: { ecc_sbe_total: intBetween(rand, 0, 3) },
          metricsAfter: { ecc_sbe_total: intBetween(rand, 3, 9) },
          actor_user_id: null,
          suggestedAction: '观察 SBE 增速，单日 > 10 需关注',
        });
      }
      continue;
    }
    // 非 Ready / straggler：必须有 Xid 证据
    const xid =
      n.state === 'notready' ? XID_TABLE[intBetween(rand, 5, 7)] // 74 / 79
      : n.state === 'remediation' ? XID_TABLE[intBetween(rand, 2, 4)] // 48 / 63 / 64
      : XID_TABLE[2]; // 48
    const stateText: Record<NodeState, string> = {
      ready: 'Ready',
      cordoned: 'Cordoned（禁止新调度）',
      draining: 'Draining（驱逐负载中）',
      remediation: 'Remediation（自愈/修复中）',
      notready: 'NotReady（异常不可调度）',
    };
    events.push({
      id: `ne-${++i}`,
      node_id: n.id,
      occurredAt: new Date(Date.now() - intBetween(rand, 1, 36) * 3600_000).toISOString(),
      level: n.state === 'notready' ? 'error' : 'warning',
      source: 'dcgm',
      type: `XID_${xid.xid}`,
      code: `XID_${xid.xid}`,
      title: `检测到 Xid ${xid.xid}（${xid.meaning}）`,
      detail: `GPU ${intBetween(rand, 0, 7)} 触发 Xid ${xid.xid}：${xid.meaning}；${xid.action}。节点当前状态 ${stateText[n.state]}，受影响实例 ${intBetween(rand, 1, 4)} 个。`,
      metricsBefore: { node_state: 'ready', ecc_dbe_total: 0 },
      metricsAfter: { node_state: n.state, ecc_dbe_total: xid.xid === 48 ? 1 : 0 },
      actor_user_id: null,
      suggestedAction:
        n.state === 'notready' ? '等待自愈完成后重新加入调度' : '跟踪 Remediation 进度',
    });
  }
  return events;
}

export const NODE_EVENTS: NodeEvent[] = buildNodeEvents(GPU_NODES);

// ─────────── 运维事件流（§4.4.1 事件与维护：cordon/drain/evicted/fail/remediate/fixed/rejoin） ───────────
// 每条事件均带 before/after 度量与建议动作（MOCK-DATA §9），全部确定性派生，禁止运行时随机。
type MaintainStep = {
  type: string;
  title: string;
  level: 'info' | 'warning' | 'error';
  detail: (gpu: number, pods: number) => string;
  before: (gpu: number, pods: number) => Record<string, number | string>;
  after: (gpu: number, pods: number) => Record<string, number | string>;
  action: string;
};

const MAINT_STEPS: Record<string, MaintainStep> = {
  fail: {
    type: 'fail',
    title: '节点健康检查失败（Xid 74/79）',
    level: 'error',
    detail: (gpu, pods) => `GPU ${gpu} 上报 NVLink/掉卡错误，节点退出调度，承载实例 ${pods} 个待驱逐。`,
    before: (gpu) => ({ node_state: 'ready', allocatable_gpu: gpu }),
    after: () => ({ node_state: 'notready', allocatable_gpu: 0 }),
    action: '确认影响面后提交 Remediation 工单',
  },
  cordon: {
    type: 'cordon',
    title: '已执行 Cordon（禁止新调度）',
    level: 'warning',
    detail: () => '节点标记为不可调度，存量实例继续运行直至驱逐。',
    before: () => ({ schedulable: 1 }),
    after: () => ({ schedulable: 0 }),
    action: '无需操作，等待 Drain 完成',
  },
  drain: {
    type: 'drain',
    title: '开始 Drain（驱逐负载）',
    level: 'warning',
    detail: (_g, pods) => `优雅驱逐 ${pods} 个实例，超时 600s 后强制删除。`,
    before: (_g, pods) => ({ running_pods: pods }),
    after: () => ({ running_pods: 0 }),
    action: '确认业务侧已切流，避免并发中断',
  },
  evicted: {
    type: 'evicted',
    title: '实例驱逐完成',
    level: 'warning',
    detail: (_g, pods) => `${pods} 个实例已驱逐，等待在健康节点重新调度。`,
    before: () => ({ pending_pods: 0 }),
    after: (_g, pods) => ({ evicted_pods: pods }),
    action: '核对实例是否在备选节点成功重建',
  },
  remediate: {
    type: 'remediate',
    title: '进入 Remediation（自愈/换卡）',
    level: 'warning',
    detail: () => '运维流水启动：硬件诊断 → 备件更换 → 固件校验。',
    before: () => ({ remediation: 0 }),
    after: () => ({ remediation: 1 }),
    action: '跟踪 Remediation 工单进度',
  },
  fixed: {
    type: 'fixed',
    title: '硬件修复完成（ECC 清零）',
    level: 'info',
    detail: () => '备件更换完成，DCGM 长测通过，ECC DBE 计数归零。',
    before: () => ({ ecc_dbe_total: 1 }),
    after: () => ({ ecc_dbe_total: 0 }),
    action: '校验通过后申请重新加入调度',
  },
  rejoin: {
    type: 'rejoin',
    title: '节点重新加入调度（Ready）',
    level: 'info',
    detail: (gpu) => `节点恢复 Ready，可分配 GPU ${gpu} 张。`,
    before: () => ({ node_state: 'cordoned', allocatable_gpu: 0 }),
    after: (gpu) => ({ node_state: 'ready', allocatable_gpu: gpu }),
    action: '无需操作',
  },
};

/** 按当前状态推导已完成到第几步（未完成的流程停在对应步骤，形成真实运维节奏） */
function flowOf(n: GpuNode): string[] {
  if (n.state === 'remediation') return ['fail', 'cordon', 'drain', 'evicted', 'remediate'];
  if (n.state === 'draining') return ['fail', 'cordon', 'drain'];
  return ['fail', 'cordon', 'drain', 'evicted'];
}

function buildMaintenanceEvents(nodes: GpuNode[]): NodeEvent[] {
  const out: NodeEvent[] = [];
  let seq = 0;
  for (const n of nodes) {
    const rand = rngFor(`maint:${n.node_uid}`);
    // 少量 Ready 节点保留「已修复并重新加入」的完整历史（Remediation 历史区块）
    const healedHistory = n.state === 'ready' && Number(n.id) % 29 === 3;
    if (n.state === 'ready' && !healedHistory) continue;
    const flow = healedHistory
      ? ['fail', 'cordon', 'drain', 'evicted', 'remediate', 'fixed', 'rejoin']
      : flowOf(n);
    const hoursAgo = healedHistory ? 96 + intBetween(rand, 0, 120) : intBetween(rand, 1, 36);
    const t0 = Date.now() - hoursAgo * 3600_000;
    const gpu = intBetween(rand, 0, 7);
    const pods = intBetween(rand, 1, 4);
    flow.forEach((key, idx) => {
      const st = MAINT_STEPS[key];
      if (!st) return;
      out.push({
        id: `me-${++seq}`,
        node_id: n.id,
        occurredAt: new Date(t0 + idx * 15 * 60_000).toISOString(),
        level: st.level,
        source: 'ops-automation',
        type: key,
        code: `MAINT_${key.toUpperCase()}`,
        title: st.title,
        detail: st.detail(gpu, pods),
        metricsBefore: st.before(n.gpu_count, pods),
        metricsAfter: st.after(n.gpu_count, pods),
        actor_user_id: null,
        suggestedAction: st.action,
      });
    });
  }
  return out;
}

export const MAINTENANCE_EVENTS: NodeEvent[] = buildMaintenanceEvents(GPU_NODES);

/** 区域感知的完整事件流（Xid + 运维动作），按时间倒序 */
export function nodeEventStream(region?: RegionCode): NodeEvent[] {
  const nodes = region ? GPU_NODES.filter((n) => n.region === region) : GPU_NODES;
  const ids = new Set(nodes.map((n) => Number(n.id)));
  const xid = NODE_EVENTS.filter((e) => ids.has(Number(e.node_id)));
  const maint = MAINTENANCE_EVENTS.filter((e) => ids.has(Number(e.node_id)));
  return [...xid, ...maint].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
}

// ─────────── 维护窗口（§4.4.1 事件与维护必含区块） ───────────
export interface MaintenanceWindow {
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

const WINDOW_REASONS = [
  '交换机固件升级（Leaf 层滚动）',
  'GPU 驱动与固件基线升级',
  '内核安全补丁（需重启）',
  'NVSwitch 诊断与微码刷新',
  '机柜供电模块更换',
];

function buildMaintenanceWindows(): MaintenanceWindow[] {
  const out: MaintenanceWindow[] = [];
  let seq = 0;
  for (const pool of Object.keys(POOL_REGIONS) as NodePoolCode[]) {
    for (const region of POOL_REGIONS[pool]) {
      const rand = rngFor(`window:${pool}:${region}`);
      if (rand() > 0.45) continue;
      const nodes = GPU_NODES.filter((n) => n.region === region && n.pool_code === pool);
      if (nodes.length === 0) continue;
      const offsetDays = intBetween(rand, -6, 9);
      const startMs =
        new Date().setHours(2, 0, 0, 0) + offsetDays * 86_400_000 + intBetween(rand, 0, 5) * 3_600_000;
      const impacted = Math.max(1, Math.round(nodes.length * (0.2 + rand() * 0.5)));
      const status: MaintenanceWindow['status'] =
        offsetDays < 0 ? 'completed' : offsetDays === 0 ? 'in_progress' : 'scheduled';
      out.push({
        id: `mw-${++seq}`,
        region: region as RegionCode,
        pool_code: pool,
        starts_at: new Date(startMs).toISOString(),
        ends_at: new Date(startMs + 4 * 3_600_000).toISOString(),
        impacted_nodes: impacted,
        impacted_gpu: impacted * GPU_SPECS[pool].gpusPerNode,
        status,
        reason: WINDOW_REASONS[intBetween(rand, 0, WINDOW_REASONS.length - 1)],
      });
    }
  }
  return out.sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
}

export const MAINTENANCE_WINDOWS: MaintenanceWindow[] = buildMaintenanceWindows();

export const nodeById = (id: number): GpuNode | undefined =>
  GPU_NODES.find((n) => n.id === id);
export const eventsOfNode = (nodeId: InternalId): NodeEvent[] =>
  NODE_EVENTS.filter((e) => e.node_id === nodeId);

/** 节点状态占比（§5.3，用于健康概览环形图） */
export function nodeStateDistribution(region?: RegionCode): Record<NodeState, number> {
  const list = region ? GPU_NODES.filter((n) => n.region === region) : GPU_NODES;
  const dist: Record<NodeState, number> = {
    ready: 0, cordoned: 0, draining: 0, remediation: 0, notready: 0,
  };
  for (const n of list) dist[n.state]++;
  return dist;
}

/** 区域算力供给（§6.7：available/total < 0.15 判定紧张） */
export function poolSupply(region: RegionCode, pool: NodePoolCode) {
  const nodes = GPU_NODES.filter((n) => n.region === region && n.pool_code === pool);
  const totalGpu = nodes.reduce((a, n) => a + n.gpu_count, 0);
  const availableGpu = nodes
    .filter((n) => n.state === 'ready')
    .reduce((a, n) => a + n.gpu_count, 0);
  return { totalGpu, availableGpu, nodeCount: nodes.length };
}
