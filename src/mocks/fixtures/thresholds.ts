// 告警阈值（唯一来源：MOCK-DATA §6 + DESIGN-SYSTEM §8.3）
// 阈值为产品配置，应由后端下发；Mock 期放此处，**组件只读消费，禁止在组件内硬编码数字比较**。

export interface Threshold {
  /** 指标键（与 §6 指标字典一致） */
  key: string;
  label: string;
  unit: string;
  /** 正常区间 [lo, hi] */
  normal: [number, number];
  /** 警戒阈值（越过 ⇒ Warning） */
  warning?: number;
  /** 严重阈值（越过 ⇒ Critical） */
  critical?: number;
  /** 比较方向 */
  direction: 'upper' | 'lower';
  /** Y 轴固定量程（§7：利用率固定 0–100%） */
  axis?: [number, number];
}

export const THRESHOLDS: Record<string, Threshold> = {
  // ── §6.1 GPU 核心指标 ──
  gpu_utilization: {
    key: 'gpu_utilization', label: 'GPU 利用率', unit: '%',
    normal: [20, 98], critical: 20, direction: 'lower', axis: [0, 100],
  },
  gpu_memory_util: {
    key: 'gpu_memory_util', label: '显存占用率', unit: '%',
    normal: [40, 95], warning: 95, direction: 'upper', axis: [0, 100],
  },
  gpu_power_draw: {
    key: 'gpu_power_draw', label: '功耗', unit: 'W',
    normal: [60, 1000], direction: 'upper',
  },
  gpu_temperature: {
    key: 'gpu_temperature', label: 'GPU 温度', unit: '°C',
    normal: [40, 80], warning: 85, critical: 88, direction: 'upper',
  },
  gpu_memory_temperature: {
    key: 'gpu_memory_temperature', label: 'HBM 温度', unit: '°C',
    normal: [50, 90], critical: 95, direction: 'upper',
  },
  ecc_dbe_total: {
    key: 'ecc_dbe_total', label: 'ECC 双比特错误', unit: '次',
    normal: [0, 0], critical: 1, direction: 'upper',
  },
  // ── §6.4 vGPU 控制面 ──
  apiserver_latency_p99: {
    key: 'apiserver_latency_p99', label: 'apiserver P99', unit: 'ms',
    normal: [0, 500], warning: 1000, direction: 'upper',
  },
  etcd_fsync_p99: {
    key: 'etcd_fsync_p99', label: 'etcd fsync P99', unit: 'ms',
    normal: [0, 10], warning: 25, direction: 'upper',
  },
  // ── §6.5 推理服务（vLLM 语义） ──
  ttft_p99: {
    key: 'ttft_p99', label: 'TTFT P99', unit: 'ms',
    normal: [1200, 4000], warning: 5000, direction: 'upper',
  },
  tpot_p99: {
    key: 'tpot_p99', label: 'TPOT P99', unit: 'ms',
    normal: [30, 80], warning: 100, direction: 'upper',
  },
  e2e_latency_p99: {
    key: 'e2e_latency_p99', label: '端到端 P99', unit: 's',
    normal: [8, 25], warning: 30, direction: 'upper',
  },
  gpu_cache_usage_perc: {
    key: 'gpu_cache_usage_perc', label: 'KV cache 占用', unit: '%',
    normal: [45, 88], warning: 92, direction: 'upper', axis: [0, 100],
  },
  num_requests_waiting: {
    key: 'num_requests_waiting', label: '排队请求', unit: '个',
    normal: [0, 20], warning: 50, direction: 'upper',
  },
  num_requests_swapped: {
    key: 'num_requests_swapped', label: 'Swap 请求', unit: '个',
    normal: [0, 5], warning: 20, direction: 'upper',
  },
  http_error_rate_5xx: {
    key: 'http_error_rate_5xx', label: '5xx 错误率', unit: '%',
    normal: [0, 0.1], critical: 1, direction: 'upper',
  },
  // ── §6.6.2 训练集群效能 ──
  goodput: {
    key: 'goodput', label: 'Goodput', unit: '%',
    normal: [85, 97], warning: 85, direction: 'lower', axis: [0, 100],
  },
  mfu: {
    key: 'mfu', label: 'MFU', unit: '%',
    normal: [35, 55], warning: 20, direction: 'lower', axis: [0, 100],
  },
  straggler_ratio: {
    key: 'straggler_ratio', label: 'Straggler 比', unit: '×',
    normal: [1, 1.2], warning: 1.2, critical: 1.5, direction: 'upper',
  },
  communication_overhead: {
    key: 'communication_overhead', label: '通信开销', unit: '%',
    normal: [5, 25], warning: 35, direction: 'upper',
  },
  node_availability: {
    key: 'node_availability', label: '节点可用性', unit: '%',
    normal: [99, 100], warning: 98, direction: 'lower',
  },
};

/** 按阈值判定语义（DESIGN §8.3：normal / notice / warning / critical / nodata） */
export type MetricSemantic = 'normal' | 'notice' | 'warning' | 'critical' | 'nodata';

export function semanticOf(key: string, value: number | null): MetricSemantic {
  if (value === null) return 'nodata';
  const t = THRESHOLDS[key];
  if (!t) return 'normal';
  if (t.direction === 'upper') {
    if (t.critical !== undefined && value >= t.critical) return 'critical';
    if (t.warning !== undefined && value >= t.warning) return 'warning';
  } else {
    if (t.critical !== undefined && value <= t.critical) return 'critical';
    if (t.warning !== undefined && value <= t.warning) return 'warning';
  }
  const [lo, hi] = t.normal;
  if (value < lo || value > hi) return 'notice';
  return 'normal';
}

export function thresholdOf(key: string): Threshold | undefined {
  return THRESHOLDS[key];
}
