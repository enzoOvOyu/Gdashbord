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
