// 时序指标（MOCK-DATA §6：详情页监控区块唯一来源）
// 边界（ARCH §12.8 / §11）：时序指标不落 PG，走独立 /api/metrics/* 契约，不混入业务实体接口。
// G4：provisioning 无指标；stopped/error 指标为 null（非 0）；无数据 null 断点。
import type { Resource } from '../types/domain';
import { generateSeries, type RangeKey, type SeriesPoint, type SeriesShape } from './lib/timeseries';
import { GPU_SPECS, nodeIdlePowerW } from './fixtures/gpu-specs';
import { deriveCost, decodeTpsUpperBound, kvAllocation, kvRequiredGb, memoryDecomposition } from './lib/derive';
import { modelBySlug } from './fixtures/models';
import { thresholdOf, type Threshold } from './fixtures/thresholds';
import { checkResourceMetrics, checkQuantiles, checkKvCache } from './lib/consistency';

export interface MetricSeries {
  key: string;
  label: string;
  unit: string;
  /** 当前值（null = 无数据，图表断点，禁止 0 填充） */
  current: number | null;
  threshold?: Threshold;
  points: SeriesPoint[];
  /** 结构化附加信息（如显存分解、分位数） */
  meta?: Record<string, number | string | null>;
}

const shapeOf = (r: Resource): SeriesShape => {
  if (r.status === 'stopped' || r.status === 'error') return 'idle';
  switch (r.kind) {
    case 'gpu_vm':
      return r.name.includes('notebook') ? 'spiky-interactive' : 'steady-high';
    case 'gpu_baremetal':
      return 'steady-high';
    case 'vgpu':
      return 'traffic-following';
    case 'inference':
      return 'traffic-following';
  }
};

/** 状态 → 是否有运行时指标（G4） */
const hasMetrics = (r: Resource): boolean => r.status === 'running';

function series(
  r: Resource,
  key: string,
  range: RangeKey,
  min: number,
  max: number,
  allowGaps = true,
): SeriesPoint[] {
  if (!hasMetrics(r)) {
    // G4：provisioning/stopped/error 无运行时指标 ⇒ 全 null（图表断点）
    const n = range === '1h' ? 240 : range === '6h' ? 360 : range === '24h' ? 288 : 168;
    return Array.from({ length: n }, (_, i) => ({
      t: new Date(Date.now() - (n - i) * 15000).toISOString(),
      v: null,
    }));
  }
  return generateSeries({ key: `${r.resource_uuid}:${key}`, shape: shapeOf(r), range, min, max, allowGaps });
}

const last = (p: SeriesPoint[]): number | null => (p.length ? p[p.length - 1].v : null);
const r1 = (n: number): number => Math.round(n * 10) / 10;

// ─────────── GPU 云服务器（§6.2） ───────────
function gpuVmMetrics(r: Resource, range: RangeKey): MetricSeries[] {
  const spec = GPU_SPECS[r.node_pool];
  const util = series(r, 'gpu_utilization', range, 0, 100);
  const memTotal = spec.vramGb;
  const memUtilPct = series(r, 'gpu_memory_util', range, 40, 96);
  const memUsed = memUtilPct.map((p) => ({
    t: p.t,
    v: p.v === null ? null : r1((p.v / 100) * memTotal),
  }));
  const power = series(r, 'gpu_power_draw', range, nodeIdlePowerW(r.node_pool) / spec.gpusPerNode, spec.tdpW);
  const temp = series(r, 'gpu_temperature', range, spec.cooling === 'liquid' ? 45 : 58, spec.cooling === 'liquid' ? 75 : 82);
  const cost = deriveCost(
    { pool: r.node_pool, region: r.region, gpu_count: r.gpu_count, storage_gb: r.storage_gb, status: r.status },
    1234.56,
  );

  // G8 断言
  checkResourceMetrics({
    resourceUuid: r.resource_uuid,
    status: r.status,
    gpuUtilization: last(util),
    memoryUsedGb: last(memUsed),
    memoryTotalGb: memTotal,
    powerDrawW: last(power),
    tdpW: spec.tdpW,
  });

  const memDecomp = memoryDecomposition({
    weightsGb: r.name.includes('notebook') ? 3.2 : 42.5,
    kvCacheGb: 0,
    activationsGb: 12.4,
    fragmentationGb: 3.1,
    frameworkOverheadGb: 1.0,
  });

  return [
    { key: 'gpu_utilization', label: 'GPU 利用率', unit: '%', current: last(util), threshold: thresholdOf('gpu_utilization'), points: util },
    { key: 'gpu_memory_used', label: '显存占用', unit: 'GB', current: last(memUsed), threshold: thresholdOf('gpu_memory_util'), points: memUsed, meta: { total: memTotal, decomposition: memDecomp.total } },
    { key: 'gpu_power_draw', label: '功耗', unit: 'W', current: last(power), threshold: thresholdOf('gpu_power_draw'), points: power, meta: { tdp: spec.tdpW } },
    { key: 'gpu_temperature', label: 'GPU 温度', unit: '°C', current: last(temp), threshold: thresholdOf('gpu_temperature'), points: temp, meta: { cooling: spec.cooling } },
    { key: 'cpu_util', label: 'CPU 利用率', unit: '%', current: last(series(r, 'cpu_util', range, 5, 70)), points: series(r, 'cpu_util', range, 5, 70) },
    { key: 'host_memory_used', label: '主机内存', unit: 'GB', current: last(series(r, 'host_memory_used', range, 40, 400)), points: series(r, 'host_memory_used', range, 40, 400), meta: { total: Math.round(r.gpu_count * 112) } },
    { key: 'disk_used', label: '磁盘已用', unit: 'GB', current: last(series(r, 'disk_used', range, 60, r.storage_gb * 0.9)), points: series(r, 'disk_used', range, 60, r.storage_gb * 0.9), meta: { total: r.storage_gb } },
    { key: 'net_in', label: '入网', unit: 'MB/s', current: last(series(r, 'net_in', range, 1, 320)), points: series(r, 'net_in', range, 1, 320) },
    { key: 'net_out', label: '出网', unit: 'MB/s', current: last(series(r, 'net_out', range, 1, 180)), points: series(r, 'net_out', range, 1, 180) },
    {
      key: 'cost_per_hour', label: '实时费用', unit: '$/h',
      current: r.status === 'running' ? cost.running_cost_per_hour : null,
      points: [], meta: {
        gpu_hourly: cost.gpu_hourly_cost,
        storage_monthly: cost.storage_monthly_cost,
        remaining_hours: cost.remaining_hours ?? null,
      },
    },
  ];
}

// ─────────── GPU 裸金属（§6.3：硬件健康 + 带外） ───────────
function bareMetalMetrics(r: Resource, range: RangeKey): MetricSeries[] {
  const spec = GPU_SPECS[r.node_pool];
  const base = gpuVmMetrics(r, range);
  const eccSbe = series(r, 'ecc_sbe_total', range, 0, 12);
  const eccDbe = series(r, 'ecc_dbe_total', range, 0, 0);
  const ibTx = series(r, 'ib_tx_bytes', range, 0, 50);
  const nvmeTemp = series(r, 'nvme_temperature', range, 35, 62);
  const inlet = series(r, 'inlet_temp', range, spec.cooling === 'liquid' ? 25 : 22, spec.cooling === 'liquid' ? 35 : 27);
  return [
    ...base.slice(0, 4),
    { key: 'ecc_sbe_total', label: 'ECC 单比特错误', unit: '次', current: last(eccSbe), threshold: thresholdOf('ecc_dbe_total'), points: eccSbe },
    { key: 'ecc_dbe_total', label: 'ECC 双比特错误', unit: '次', current: last(eccDbe) ?? 0, threshold: thresholdOf('ecc_dbe_total'), points: eccDbe, meta: { note: '≥1 立即隔离（Xid 48）' } },
    { key: 'row_remap_failed', label: '行重映射失败', unit: '次', current: 0, points: [] },
    { key: 'pcie_link_gen', label: 'PCIe 链路代次', unit: '', current: 5, points: [], meta: { width: 'x16', expected: 'Gen5 x16' } },
    { key: 'ib_tx_bytes', label: 'IB 发送', unit: 'GB/s', current: last(ibTx), points: ibTx, meta: { port_rate: '400 Gb/s', state: 'Active' } },
    { key: 'ib_symbol_errors', label: 'IB 符号错误', unit: '次', current: 0, points: [] },
    { key: 'nvme_percentage_used', label: 'NVMe 寿命消耗', unit: '%', current: hasMetrics(r) ? 12 : null, points: [], meta: { media_errors: 0, critical_warning: 'none' } },
    { key: 'nvme_temperature', label: 'NVMe 温度', unit: '°C', current: last(nvmeTemp), points: nvmeTemp },
    { key: 'psu_redundancy', label: 'PSU 冗余', unit: '', current: 2, points: [], meta: { status: '2N 冗余正常', input_power_w: spec.nodePowerKw * 1000 } },
    { key: 'inlet_temp', label: '入风温度', unit: '°C', current: last(inlet), points: inlet, meta: { cooling: spec.cooling } },
    { key: 'sel_log_count', label: 'BMC SEL 条目', unit: '条', current: hasMetrics(r) ? 34 : null, points: [], meta: { bmc_firmware: '2.94', reachability: '可达' } },
    { key: 'firmware', label: '固件与驱动', unit: '', current: null, points: [], meta: { vbios: '96.00.4E.00', driver_version: '570.86.10', cuda_version: '12.8' } },
    { key: 'gpu_temperature_extra', label: 'HBM 温度', unit: '°C', current: last(series(r, 'gpu_memory_temperature', range, 50, 90)), threshold: thresholdOf('gpu_memory_temperature'), points: series(r, 'gpu_memory_temperature', range, 50, 90) },
  ];
}

// ─────────── vGPU · 托管 K8s（§6.4） ───────────
function vgpuMetrics(r: Resource, range: RangeKey): MetricSeries[] {
  const specJson = r.spec_json as { k8s_version: string; node_count: number; slicing_policy: string };
  const apiP99 = series(r, 'apiserver_latency_p99', range, 60, 480);
  const etcdP99 = series(r, 'etcd_fsync_p99', range, 2, 9);
  const alloc = series(r, 'gpu_allocation', range, 55, 92);
  const pending = series(r, 'scheduler_pending_pods', range, 0, 8);
  return [
    { key: 'apiserver_latency_p99', label: 'apiserver P99', unit: 'ms', current: last(apiP99), threshold: thresholdOf('apiserver_latency_p99'), points: apiP99 },
    { key: 'etcd_fsync_p99', label: 'etcd fsync P99', unit: 'ms', current: last(etcdP99), threshold: thresholdOf('etcd_fsync_p99'), points: etcdP99 },
    { key: 'etcd_db_size', label: 'etcd DB 大小', unit: 'MB', current: hasMetrics(r) ? 184 : null, points: [] },
    { key: 'scheduler_pending_pods', label: 'Pending Pods', unit: '个', current: last(pending), points: pending },
    { key: 'api_error_rate', label: 'API 错误率', unit: '%', current: hasMetrics(r) ? 0.12 : null, points: [] },
    { key: 'node_count', label: '节点数', unit: '个', current: hasMetrics(r) ? specJson.node_count : null, points: [], meta: { ready_ratio: 94.1 } },
    { key: 'gpu_allocation', label: 'GPU 分配率', unit: '%', current: last(alloc), points: alloc, meta: { allocatable: r.gpu_count, capacity: r.gpu_count + 8 } },
    { key: 'mig_profile', label: 'MIG 切片', unit: '', current: null, points: [], meta: { profile: '1g.24gb', free: 12, total: 56, mode: specJson.slicing_policy } },
    { key: 'device_plugin_healthy', label: '设备插件健康', unit: '', current: hasMetrics(r) ? 1 : null, points: [], meta: { gpu_operator: 'v24.9.1', driver_daemonset_ready: '8/8' } },
    { key: 'pod_phases', label: 'Pod 分布', unit: '个', current: null, points: [], meta: { Running: 42, Pending: 3, Failed: 1, Succeeded: 8 } },
    { key: 'scheduling_failures', label: '调度失败原因', unit: '', current: null, points: [], meta: { 'Insufficient nvidia.com/gpu': 7, 'node(s) had taint': 2, 'didn\'t match PodTopologySpread': 1 } },
    { key: 'cni_errors', label: 'CNI 错误', unit: '次', current: hasMetrics(r) ? 0 : null, points: [], meta: { ingress_qps: 128, vpc_peering: 'established' } },
    { key: 'pvc_bound', label: 'PVC', unit: '个', current: null, points: [], meta: { bound: 18, pending: 1, capacity_gb: 2048, csi_errors: 0 } },
    ...gpuVmMetrics(r, range).slice(0, 2),
  ];
}

// ─────────── 推理服务（§6.5：vLLM/SGLang 语义全集） ───────────
function inferenceMetrics(r: Resource, range: RangeKey): MetricSeries[] {
  const spec = GPU_SPECS[r.node_pool];
  const specJson = r.spec_json as { model_ref: string; replicas: number; gpu_count: number };
  const model = modelBySlug(specJson.model_ref);
  const paramsB = model?.paramsBillion ?? 8;
  const weightsGb = model ? Math.round((paramsB * 1e9 * (model.precision === 'bf16' ? 2 : 1)) / 1e9 * 10) / 10 : 16;
  const tp = Math.min(specJson.gpu_count, 8);

  // §7.3 decode 上界（带宽受限，不得套用训练公式）
  const tpsUpper = decodeTpsUpperBound({ pool: r.node_pool, paramsBillion: paramsB, precision: model?.precision ?? 'fp8', gpusInTp: tp });
  // §7.4 KV cache
  const kvAlloc = kvAllocation({ pool: r.node_pool, weightsGb });
  const kvUsed = kvRequiredGb({
    concurrency: 32,
    avgContextTokens: 4096,
    layers: model?.layers ?? 32,
    kvHeads: model?.kvHeads ?? 8,
    headDim: model?.headDim ?? 128,
  });
  const cachePerc = kvAlloc.kvAllocatedGb > 0 ? Math.min(96, Math.round((kvUsed / kvAlloc.kvAllocatedGb) * 1000) / 10) : 0;

  checkKvCache({ label: r.resource_uuid, kvUsedGb: kvUsed, kvAllocatedGb: kvAlloc.kvAllocatedGb, totalGb: spec.vramGb, weightsGb });

  const ttftP50 = series(r, 'ttft_p50', range, 180, 520);
  const ttftP99 = series(r, 'ttft_p99', range, 1400, 3600);
  const tpotP50 = series(r, 'tpot_p50', range, 14, 34);
  const tpotP99 = series(r, 'tpot_p99', range, 32, 74);
  const rps = series(r, 'requests_per_second', range, 6, 84);
  const cache = series(r, 'gpu_cache_usage_perc', range, 52, cachePerc);
  const waiting = series(r, 'num_requests_waiting', range, 0, 18);

  // G8：分位数矛盾拦截
  checkQuantiles(r.resource_uuid, {
    p50: last(ttftP50) ?? undefined,
    p99: last(ttftP99) ?? undefined,
  });

  const genTps = hasMetrics(r) ? Math.round(tpsUpper * 0.42 * specJson.replicas) : null;

  return [
    { key: 'ttft_p50', label: 'TTFT P50', unit: 'ms', current: last(ttftP50), points: ttftP50 },
    { key: 'ttft_p99', label: 'TTFT P99', unit: 'ms', current: last(ttftP99), threshold: thresholdOf('ttft_p99'), points: ttftP99 },
    { key: 'tpot_p50', label: 'TPOT P50', unit: 'ms', current: last(tpotP50), points: tpotP50 },
    { key: 'tpot_p99', label: 'TPOT P99', unit: 'ms', current: last(tpotP99), threshold: thresholdOf('tpot_p99'), points: tpotP99 },
    { key: 'e2e_latency_p99', label: '端到端 P99', unit: 's', current: last(series(r, 'e2e_p99', range, 8, 22)), threshold: thresholdOf('e2e_latency_p99'), points: series(r, 'e2e_p99', range, 8, 22) },
    { key: 'requests_per_second', label: 'QPS', unit: 'req/s', current: last(rps), points: rps },
    { key: 'num_requests_running', label: '运行中请求', unit: '个', current: hasMetrics(r) ? Math.round(24 * specJson.replicas) : null, points: [], meta: { max_num_seqs: 256 } },
    { key: 'num_requests_waiting', label: '排队请求', unit: '个', current: last(waiting), threshold: thresholdOf('num_requests_waiting'), points: waiting },
    { key: 'num_requests_swapped', label: 'Swap 请求', unit: '个', current: hasMetrics(r) ? 1 : null, threshold: thresholdOf('num_requests_swapped'), points: [] },
    { key: 'generation_tokens_total', label: '输出吞吐', unit: 'tokens/s', current: genTps, points: [], meta: { upper_bound: tpsUpper, weights_gb: weightsGb, tp } },
    { key: 'prompt_tokens_total', label: '输入吞吐', unit: 'tokens/s', current: hasMetrics(r) ? Math.round((genTps ?? 0) * 0.35) : null, points: [] },
    { key: 'gpu_cache_usage_perc', label: 'KV cache 占用', unit: '%', current: last(cache), threshold: thresholdOf('gpu_cache_usage_perc'), points: cache, meta: { kv_used_gb: kvUsed, kv_allocated_gb: kvAlloc.kvAllocatedGb } },
    { key: 'prefix_cache_hit_rate', label: '前缀缓存命中率', unit: '%', current: hasMetrics(r) ? 42.6 : null, points: [], meta: { note: '>90 为极优' } },
    { key: 'avg_generation_length', label: '平均生成长度', unit: 'tokens', current: hasMetrics(r) ? 286 : null, points: [] },
    { key: 'http_error_rate_4xx', label: '4xx 错误率', unit: '%', current: hasMetrics(r) ? 0.18 : null, points: [] },
    { key: 'http_error_rate_5xx', label: '5xx 错误率', unit: '%', current: hasMetrics(r) ? 0.04 : null, threshold: thresholdOf('http_error_rate_5xx'), points: [] },
    { key: 'replica_count', label: '副本数', unit: '个', current: hasMetrics(r) ? specJson.replicas : null, points: [], meta: { desired: specJson.replicas, hpa: 'min1/max6' } },
    ...gpuVmMetrics(r, range).slice(0, 2),
  ];
}

/** 按资源类型返回指标集（§6.2–§6.5） */
export function resourceMetrics(r: Resource, range: RangeKey = '1h'): MetricSeries[] {
  switch (r.kind) {
    case 'gpu_vm':
      return gpuVmMetrics(r, range);
    case 'gpu_baremetal':
      return bareMetalMetrics(r, range);
    case 'vgpu':
      return vgpuMetrics(r, range);
    case 'inference':
      return inferenceMetrics(r, range);
  }
}

/** 单指标查询（/api/metrics/resources/:uuid/:key） */
export function singleMetric(r: Resource, key: string, range: RangeKey = '1h'): MetricSeries | undefined {
  return resourceMetrics(r, range).find((m) => m.key === key);
}

/** 集群层效能指标（§6.6.2） */
export function clusterEfficiency(region?: string): Record<string, MetricSeries> {
  const mfu = 0.47;
  const nodeAvail = 0.994;
  const restartOverhead = 0.02;
  const stragglerRatio = 1.14;
  const goodput = Math.round(
    mfu * nodeAvail * (1 - restartOverhead) * (1 - Math.min(Math.max(stragglerRatio - 1, 0), 0.3)) * 10000,
  ) / 100;
  const stepP50 = 2.13;
  const stepP99 = stepP50 * stragglerRatio;
  return {
    mfu: { key: 'mfu', label: 'MFU', unit: '%', current: mfu * 100, threshold: thresholdOf('mfu'), points: generateSeries({ key: `mfu:${region ?? 'all'}`, shape: 'steady-high', range: '6h', min: 38, max: 52 }) },
    hfu: { key: 'hfu', label: 'HFU', unit: '%', current: mfu * 100 + 8.4, points: [], meta: { note: '含重计算，通常高于 MFU 5–15pp' } },
    goodput: { key: 'goodput', label: 'Goodput', unit: '%', current: goodput, threshold: thresholdOf('goodput'), points: generateSeries({ key: `goodput:${region ?? 'all'}`, shape: 'steady-high', range: '6h', min: 84, max: 96 }) },
    step_time_p50: { key: 'step_time_p50', label: 'Step Time P50', unit: 's', current: stepP50, points: [] },
    step_time_p99: { key: 'step_time_p99', label: 'Step Time P99', unit: 's', current: Math.round(stepP99 * 100) / 100, points: [] },
    straggler_ratio: { key: 'straggler_ratio', label: 'Straggler 比', unit: '×', current: stragglerRatio, threshold: thresholdOf('straggler_ratio'), points: [] },
    communication_overhead: { key: 'communication_overhead', label: '通信开销', unit: '%', current: 12.4, threshold: thresholdOf('communication_overhead'), points: [] },
    data_loading_stall: { key: 'data_loading_stall', label: '数据加载停顿', unit: '%', current: 3.1, points: [] },
    node_availability: { key: 'node_availability', label: '节点可用性', unit: '%', current: nodeAvail * 100, threshold: thresholdOf('node_availability'), points: [] },
    mean_time_to_remediation: { key: 'mean_time_to_remediation', label: '平均修复时长', unit: 'min', current: 26, points: [] },
  };
}
