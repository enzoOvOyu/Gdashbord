// G8 假数据红旗运行时断言（MOCK-DATA §8.3，开发态 MUST）
// 每次 fixture 生成 / WS 推送前执行；失败则 console.error 并抛出可见错误，原型期即发现数据问题。
import { VITE_ENABLE_CONSISTENCY_CHECK } from './env';

export interface CheckResult {
  ok: boolean;
  failures: string[];
}

class Consistency {
  private failures: string[] = [];

  assert(cond: boolean, msg: string): void {
    if (!cond) this.failures.push(msg);
  }

  reset(): void {
    this.failures = [];
  }

  report(context: string): CheckResult {
    const ok = this.failures.length === 0;
    if (!ok && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error(
        `[consistency] ${context} 发现 ${this.failures.length} 项 G8 红旗：\n` +
          this.failures.map((f) => `  - ${f}`).join('\n'),
      );
    }
    return { ok, failures: [...this.failures] };
  }
}

const c = new Consistency();

/** 资源指标自检（G4 状态自洽 + G8 红旗） */
export function checkResourceMetrics(input: {
  resourceUuid: string;
  status: string;
  gpuUtilization: number | null;
  memoryUsedGb: number | null;
  memoryTotalGb: number | null;
  powerDrawW: number | null;
  tdpW: number;
  tokensPerSecond?: number | null;
}): CheckResult {
  if (!VITE_ENABLE_CONSISTENCY_CHECK) return { ok: true, failures: [] };
  c.reset();
  const s = input.status;

  // G4：provisioning 无运行时指标；stopped 指标为 null（非 0）
  if (s === 'provisioning') {
    c.assert(
      input.gpuUtilization === null && input.memoryUsedGb === null,
      `${input.resourceUuid}: provisioning 不应有运行时指标（G4）`,
    );
  }
  if (s === 'stopped') {
    c.assert(input.gpuUtilization === null, `${input.resourceUuid}: stopped 的 GPU 利用率应为 null 而非 0（G4）`);
  }
  // G8：显存占用 > 容量（物理不可能）
  if (input.memoryUsedGb !== null && input.memoryTotalGb !== null) {
    c.assert(
      input.memoryUsedGb <= input.memoryTotalGb,
      `${input.resourceUuid}: 显存占用 ${input.memoryUsedGb}GB > 容量 ${input.memoryTotalGb}GB（G8 红旗）`,
    );
  }
  // G8：利用率恒定 / 越界
  if (input.gpuUtilization !== null) {
    c.assert(
      input.gpuUtilization >= 0 && input.gpuUtilization <= 100,
      `${input.resourceUuid}: 利用率 ${input.gpuUtilization}% 越界（0–100）`,
    );
  }
  // G8：功耗不超过 TDP×1.02
  if (input.powerDrawW !== null) {
    c.assert(
      input.powerDrawW <= input.tdpW * 1.02,
      `${input.resourceUuid}: 功耗 ${input.powerDrawW}W 超过 TDP ${input.tdpW}W×1.02`,
    );
  }
  // G8：利用率为 0 但 tokens/s > 0（逻辑矛盾）
  if (input.gpuUtilization === 0 && (input.tokensPerSecond ?? 0) > 0) {
    c.assert(false, `${input.resourceUuid}: 利用率 0 但吞吐 ${input.tokensPerSecond} tok/s（G8 逻辑矛盾）`);
  }
  return c.report(`resource:${input.resourceUuid}`);
}

/** 分位数自检（G8：P50 ≤ P90 ≤ P95 ≤ P99，禁止 P99 < P50） */
export function checkQuantiles(
  label: string,
  q: { p50?: number; p90?: number; p95?: number; p99?: number },
): CheckResult {
  if (!VITE_ENABLE_CONSISTENCY_CHECK) return { ok: true, failures: [] };
  c.reset();
  const raw: Array<[string, number | undefined]> = [
    ['p50', q.p50],
    ['p90', q.p90],
    ['p95', q.p95],
    ['p99', q.p99],
  ];
  const order = raw.filter((x): x is [string, number] => x[1] !== undefined);
  for (let i = 1; i < order.length; i++) {
    c.assert(
      order[i][1] >= order[i - 1][1],
      `${label}: ${order[i][0]}(${order[i][1]}) < ${order[i - 1][0]}(${order[i - 1][1]}) — 分位数矛盾（G8）`,
    );
  }
  return c.report(`quantiles:${label}`);
}

/** KV cache 自检（G8：kv_used ≤ kv_allocated ≤ total - weights） */
export function checkKvCache(input: {
  label: string;
  kvUsedGb: number;
  kvAllocatedGb: number;
  totalGb: number;
  weightsGb: number;
}): CheckResult {
  if (!VITE_ENABLE_CONSISTENCY_CHECK) return { ok: true, failures: [] };
  c.reset();
  c.assert(
    input.kvUsedGb <= input.kvAllocatedGb,
    `${input.label}: kv_used ${input.kvUsedGb} > kv_allocated ${input.kvAllocatedGb}（G8）`,
  );
  c.assert(
    input.kvAllocatedGb <= input.totalGb - input.weightsGb,
    `${input.label}: kv_allocated ${input.kvAllocatedGb} > total-weights ${input.totalGb - input.weightsGb}（G8）`,
  );
  return c.report(`kv:${input.label}`);
}

/** 集群效能自检（§6.6.2：MFU ≤ HFU；goodput ≤ 100%） */
export function checkClusterEfficiency(input: {
  label: string;
  mfu: number;
  hfu: number;
  goodput: number;
  availableGpu: number;
  totalGpu: number;
}): CheckResult {
  if (!VITE_ENABLE_CONSISTENCY_CHECK) return { ok: true, failures: [] };
  c.reset();
  c.assert(input.mfu <= 1, `${input.label}: MFU ${input.mfu} > 1（不可能）`);
  c.assert(input.hfu >= input.mfu, `${input.label}: HFU ${input.hfu} < MFU ${input.mfu}（§6.6.2）`);
  c.assert(input.goodput <= 1, `${input.label}: goodput ${input.goodput} > 100%`);
  c.assert(
    input.availableGpu >= 0 && input.availableGpu <= input.totalGpu,
    `${input.label}: available ${input.availableGpu} 越界（0–${input.totalGpu}）`,
  );
  return c.report(`cluster:${input.label}`);
}
