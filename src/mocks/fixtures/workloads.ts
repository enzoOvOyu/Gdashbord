// 工作负载与副本派生（vGPU §4.3.3 工作负载 Tab / 推理 §4.3.4 实例管理 Tab）
// G5 确定性：由资源 uuid 播种，同一资源刷新结果一致；禁止 Math.random。
import type { InternalId, Resource } from '../../types/domain';
import { rngFor, intBetween, pick, between } from '../lib/rng';
import type { InferenceSpec, VgpuSpec } from '../../types/domain';

export interface PodView {
  name: string;
  phase: 'Running' | 'Pending' | 'Failed' | 'Succeeded';
  node: string | null;
  restarts: number;
  oomKilled: number;
  waitingReason: string | null;
}

export interface DeployView {
  name: string;
  namespace: string;
  desired: number;
  ready: number;
  pods: PodView[];
}

export interface SchedulingFailure {
  reason: string;
  count: number;
}

export interface WorkloadTree {
  namespaces: Array<{ name: string; deployments: DeployView[] }>;
  schedulingFailures: SchedulingFailure[];
  phaseDistribution: Record<PodView['phase'], number>;
}

const NS = ['default', 'training', 'inference', 'system'];
const APPS = ['llm-train', 'sdxl-serve', 'embedding-worker', 'data-loader', 'vllm-gateway'];

/**
 * vGPU 集群工作负载：Namespace → Deployment → Pod 三级。
 * 必须包含 Insufficient nvidia.com/gpu 的调度失败原因才具说服力（§6.4）。
 */
export function workloadsOf(r: Resource): WorkloadTree {
  const rand = rngFor(`workload:${r.resource_uuid}`);
  const spec = r.spec_json as VgpuSpec;
  const nodeTotal = Math.max(1, spec.node_count);
  const namespaces = NS.slice(0, intBetween(rand, 2, 4)).map((ns, ni) => {
    const apps = APPS.slice(ni, ni + intBetween(rand, 1, 2));
    const deployments: DeployView[] = apps.map((app) => {
      const desired = intBetween(rand, 1, 3);
      // 至少一个 Deployment 存在 Pending（GPU 不足），保证调度失败可解释
      const hasPending = rand() > 0.55;
      const ready = hasPending ? Math.max(0, desired - 1) : desired;
      const pods: PodView[] = Array.from({ length: desired }, (_, i) => {
        const pending = hasPending && i >= ready;
        return {
          name: `${app}-${Math.floor(between(rand, 10000, 99999))}-${Math.floor(between(rand, 1000, 9999))}`,
          phase: pending ? 'Pending' : 'Running',
          node: pending ? null : `${app}-node-${intBetween(rand, 1, nodeTotal)}`,
          restarts: pending ? 0 : intBetween(rand, 0, 2),
          oomKilled: !pending && rand() > 0.88 ? 1 : 0,
          waitingReason: pending ? pick(rand, ['Insufficient nvidia.com/gpu', 'ContainerCreating', 'ImagePullBackOff']) : null,
        };
      });
      return { name: app, namespace: ns, desired, ready, pods };
    });
    return { name: ns, deployments };
  });

  const failures = new Map<string, number>();
  let dist: Record<PodView['phase'], number> = { Running: 0, Pending: 0, Failed: 0, Succeeded: 0 };
  for (const ns of namespaces) {
    for (const d of ns.deployments) {
      for (const p of d.pods) {
        dist[p.phase] += 1;
        if (p.waitingReason) {
          failures.set(p.waitingReason, (failures.get(p.waitingReason) ?? 0) + 1);
        }
      }
    }
  }
  // 保证 GPU 不足原因必现（§6.4 说服力要求）
  if (!failures.has('Insufficient nvidia.com/gpu')) {
    failures.set('Insufficient nvidia.com/gpu', intBetween(rand, 1, 3));
    dist = { ...dist, Pending: dist.Pending + 1 };
  }

  return {
    namespaces,
    schedulingFailures: [...failures.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    phaseDistribution: dist,
  };
}

export interface ReplicaView {
  name: string;
  phase: 'Running' | 'Pending' | 'Terminating' | 'Failed';
  node: string;
  gpuCount: number;
  vramGb: number;
  rps: number;
  runningRequests: number;
  restarts: number;
  ageHours: number;
}

/** 推理服务副本列表（§4.3.4 实例管理） */
export function replicasOf(r: Resource): ReplicaView[] {
  const rand = rngFor(`replica:${r.resource_uuid}`);
  const spec = r.spec_json as InferenceSpec;
  const total = Math.max(1, spec.replicas);
  return Array.from({ length: total }, (_, i) => {
    const degraded = rand() > 0.9;
    return {
      name: `${r.name}-${i}`,
      phase: degraded ? 'Pending' : 'Running',
      node: `${r.region}-node-${intBetween(rand, 1, 8)}`,
      gpuCount: spec.gpu_count,
      vramGb: spec.gpu_count * 80,
      rps: degraded ? 0 : Math.round(between(rand, 2, 26) * 10) / 10,
      runningRequests: degraded ? 0 : intBetween(rand, 0, 32),
      restarts: rand() > 0.85 ? intBetween(rand, 1, 3) : 0,
      ageHours: Math.round(between(rand, 1, 400)),
    };
  });
}

export const internalIdOf = (n: number): InternalId => n as InternalId;
