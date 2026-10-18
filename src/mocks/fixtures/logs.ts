// 结构化逐行日志（PRD §4.4.1 日志页 / §4.3.4 推理日志 Tab；Modal 风格）
// 禁止只有正常日志刷屏：错误行必须存在且带 Traceback（MOCK-DATA §9.2）。
import type { InternalId, LogEntry, RegionCode, Resource, ResourceKind } from '../../types/domain';
import { rngFor, intBetween, pick, between } from '../lib/rng';
import type { InferenceSpec } from '../../types/domain';

const HOUR_MS = 3_600_000;

interface SystemLine {
  level: LogEntry['level'];
  source: string;
  message: string;
}

const SYSTEM_LINES: Record<ResourceKind, SystemLine[]> = {
  gpu_vm: [
    { level: 'info', source: 'containerd', message: 'task started: jupyterlab container created' },
    { level: 'info', source: 'nvidia-device-plugin', message: 'GPU 0 allocated to container (UUID GPU-9f2a-1)' },
    { level: 'info', source: 'jupyter', message: 'Jupyter Server 2.14 is running at http://127.0.0.1:8888' },
    { level: 'warning', source: 'cgroup', message: 'memory usage 82% of limit (164 GB / 200 GB)' },
    { level: 'error', source: 'containerd', message: 'OCI runtime exec failed: no such container' },
    { level: 'info', source: 'sshd', message: 'Accepted publickey for ubuntu from 10.42.7.19' },
    { level: 'debug', source: 'nvidia-smi', message: 'GPU utilization 71%, memory 62.4/80 GB' },
  ],
  gpu_baremetal: [
    { level: 'info', source: 'bmc', message: 'host power state: On, SEL cleared' },
    { level: 'info', source: 'kernel', message: 'mlx5_core 0000:2b:00.0: Link up, 400 Gb/s NDR' },
    { level: 'info', source: 'nvme', message: 'nvme0n1: SMART overall-health self-assessment: PASSED' },
    { level: 'warning', source: 'kernel', message: 'NVRM: Xid 63: Row remapping event detected on GPU 3' },
    { level: 'error', source: 'ib-link', message: 'mlx5_2: port 1 link down, 1 event in last 15 min' },
    { level: 'info', source: 'raid', message: 'md0: RAID10 array resync completed (99.9%)' },
    { level: 'debug', source: 'ipmid', message: 'PSU1 612W / PSU2 598W, redundancy 2N healthy' },
  ],
  vgpu: [
    { level: 'info', source: 'kubelet', message: 'Successfully registered node ip-10-42-8-11' },
    { level: 'info', source: 'gpu-operator', message: 'nvidia-device-plugin daemonset ready 6/6' },
    { level: 'warning', source: 'kube-scheduler', message: '0/8 nodes available: 3 Insufficient nvidia.com/gpu' },
    { level: 'error', source: 'kubelet', message: 'Pod llama-train-0 container OOMKilled (exit 137)' },
    { level: 'info', source: 'cilium', message: 'endpoint 1182 regenerated, policy verdict ALLOW' },
    { level: 'debug', source: 'etcd', message: 'fsync duration 4.2ms, db size 128 MB' },
  ],
  inference: [
    { level: 'info', source: 'vllm', message: 'init engine (model, tokenizer, cuda graphs) took 41.2s' },
    { level: 'info', source: 'vllm', message: 'Chunked prefill enabled, max_num_batched_tokens=8192' },
    { level: 'warning', source: 'vllm', message: 'KV cache usage 91.4%, preempting 3 requests' },
    { level: 'error', source: 'vllm', message: 'Request aborted: output length exceeded max_model_len' },
    { level: 'info', source: 'ingress', message: 'route POST /v1/chat/completions status 200' },
    { level: 'error', source: 'ingress', message: 'route POST /v1/completions status 500 upstream timeout' },
    { level: 'debug', source: 'vllm', message: 'prefix cache hit rate 62.1%, 812 cached blocks' },
  ],
};

const TRACEBACKS = [
  `Traceback (most recent call last):\n  File "/usr/lib/python3.11/site-packages/vllm/engine/llm_engine.py", line 921, in step\n    seq_group_metadata_list, scheduler_outputs\nRuntimeError: CUDA out of memory. Tried to allocate 1.84 GiB (GPU 0; 79.15 GiB total capacity)`,
  `Traceback (most recent call last):\n  File "train.py", line 214, in <module>\n    trainer.train()\n  File "train.py", line 168, in train\n    loss.backward()\ntorch.OutOfMemoryError: CUDA out of memory. Tried to allocate 640.00 MiB`,
  `k8s.io/client-go: FailedScheduling\n0/8 nodes are available: 3 Insufficient nvidia.com/gpu, 2 node(s) had untolerated taint {nvidia.com/gpu: present}.`,
];

const ROUTES = [
  '/v1/chat/completions',
  '/v1/completions',
  '/v1/embeddings',
  '/health',
  '/metrics',
];

let logSeq = 0;

const rid = (rand: () => number): string =>
  `req-${Math.floor(rand() * 0xffffff).toString(16).padStart(6, '0')}`;

function buildForResource(r: Resource, nowMs: number): LogEntry[] {
  const rand = rngFor(`log:${r.resource_uuid}`);
  const lines = SYSTEM_LINES[r.kind];
  const count = intBetween(rand, 28, 44);
  const out: LogEntry[] = [];
  const isInference = r.kind === 'inference';
  const modelName = isInference
    ? (r.spec_json as InferenceSpec).model_ref
    : '';

  for (let i = 0; i < count; i += 1) {
    // 时间单调：越靠后的记录越接近当前时间
    const agoMs = Math.floor(((count - i) / count) * 6 * HOUR_MS);
    const ts = new Date(nowMs - agoMs).toISOString();
    const requestLog = isInference && rand() > 0.45;
    if (requestLog) {
      const route = pick(rand, ROUTES);
      const failed = rand() > 0.92;
      out.push({
        id: `log-${(logSeq += 1)}`,
        ts,
        level: failed ? 'error' : 'info',
        region: r.region,
        resource_id: r.id,
        resource_uuid: r.resource_uuid as string,
        source: 'vllm',
        message: `${route} ${failed ? 'failed' : 'ok'} · model=${modelName}`,
        request_id: rid(rand),
        route,
        status: failed ? (rand() > 0.5 ? 500 : 422) : 200,
        latency_ms: Math.round(between(rand, failed ? 9000 : 120, failed ? 30000 : 4200)),
        traceback: failed && rand() > 0.6 ? pick(rand, TRACEBACKS) : null,
      });
      continue;
    }
    const line = pick(rand, lines);
    const withTrace = line.level === 'error' && rand() > 0.45;
    out.push({
      id: `log-${(logSeq += 1)}`,
      ts,
      level: line.level,
      region: r.region,
      resource_id: r.id,
      resource_uuid: r.resource_uuid as string,
      source: line.source,
      message: line.message,
      request_id: null,
      route: null,
      status: null,
      latency_ms: null,
      traceback: withTrace ? pick(rand, TRACEBACKS) : null,
    });
  }
  return out;
}

export let LOGS: LogEntry[] = [];

export function rebuildLogs(resources: Resource[]): void {
  const nowMs = Date.now();
  LOGS = resources
    .flatMap((r) => (r.deleted_at ? [] : buildForResource(r, nowMs)))
    .sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

export function appendLogsFor(r: Resource): void {
  LOGS = [...buildForResource(r, Date.now()), ...LOGS].sort((a, b) =>
    a.ts < b.ts ? 1 : -1,
  );
}

export interface LogFilter {
  region?: RegionCode;
  resourceUuid?: string;
  level?: string;
  q?: string;
}

export function queryLogs(f: LogFilter): LogEntry[] {
  const q = (f.q ?? '').trim().toLowerCase();
  return LOGS.filter((l) => {
    if (f.region && l.region !== f.region) return false;
    if (f.resourceUuid && l.resource_uuid !== f.resourceUuid) return false;
    if (f.level && f.level !== 'all' && l.level !== f.level) return false;
    if (q && !l.message.toLowerCase().includes(q) && !l.source.includes(q)) return false;
    return true;
  });
}

/** 日志上下文：目标行前后各 N 行（§4.4.1 日志页 Drawer） */
export function logContext(id: string, before = 50, after = 50): LogEntry[] {
  const idx = LOGS.findIndex((l) => l.id === id);
  if (idx < 0) return [];
  return LOGS.slice(Math.max(0, idx - before), idx + after + 1);
}

export const logsOfResource = (resourceId: InternalId): LogEntry[] =>
  LOGS.filter((l) => l.resource_id === resourceId);
