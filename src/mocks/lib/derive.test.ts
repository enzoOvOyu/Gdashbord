// derive 派生公式单测（MOCK-DATA §7；G2：金额与指标一律算出来）
import { describe, expect, it } from 'vitest';
import {
  decodeTpsUpperBound, deriveCost, gpuHourlyCost, proratedQuantity,
  storageMonthlyCost, tokensPerSecond,
} from './derive';
import { DISCOUNT_FACTOR } from '../fixtures/pricing';

describe('§7.1 费用派生', () => {
  it('gpu_hourly = 基准价 × 区域系数 × 卡数 × 折扣', () => {
    // H100 @ jp：3.49 × 1.12 = 3.9088 → round2 3.91；× 8 卡 × 无折扣
    expect(gpuHourlyCost({ pool: 'H100_SXM', region: 'jp', gpu_count: 8, storage_gb: 0, status: 'running' })).toBe(31.28);
    // spot 0.48 折扣：3.91 × 8 × 0.48 = 15.01
    expect(
      gpuHourlyCost({ pool: 'H100_SXM', region: 'jp', gpu_count: 8, storage_gb: 0, status: 'running', discount: 'spot' }),
    ).toBe(15.01);
    // 折扣档齐全且与文档口径一致
    expect(DISCOUNT_FACTOR.spot).toBeLessThan(DISCOUNT_FACTOR.reserved_1y);
    expect(DISCOUNT_FACTOR.reserved_3y).toBeLessThan(DISCOUNT_FACTOR.reserved_1y);
  });

  it('存储月费 = GB × 0.08', () => {
    expect(storageMonthlyCost(500)).toBe(40);
    expect(storageMonthlyCost(0)).toBe(0);
  });

  it('计量与生命周期严格挂钩（§7.4）', () => {
    const base = { pool: 'H100_SXM', region: 'us', gpu_count: 8, storage_gb: 365, status: 'running' } as const;
    const running = deriveCost(base, 1000);
    // running：算力 3.49×8=27.92 + 存储 29.2/730≈0.04
    expect(running.gpu_hourly_cost).toBe(27.92);
    expect(running.running_cost_per_hour).toBe(27.96);
    expect(running.remaining_hours).toBe(35.77);

    const stopped = deriveCost({ ...base, status: 'stopped' }, 1000);
    expect(stopped.gpu_hourly_cost).toBe(27.92); // 单价照算
    expect(stopped.running_cost_per_hour).toBe(0.04); // 仅存储

    const provisioning = deriveCost({ ...base, status: 'provisioning' }, 1000);
    expect(provisioning.running_cost_per_hour).toBe(0); // provisioning 不计
    expect(provisioning.remaining_hours).toBeNull();

    const terminating = deriveCost({ ...base, status: 'terminating' }, 1000);
    expect(terminating.running_cost_per_hour).toBe(0); // 立即停计
  });
});

describe('§7.4 不足整小时折算', () => {
  it('quantity = gpu_count × seconds / 3600', () => {
    expect(proratedQuantity(8, 1800)).toBe(4);
    expect(proratedQuantity(1, 900)).toBe(0.25);
  });
});

describe('§7.2 训练吞吐', () => {
  it('tokens_per_second = mfu × 节点峰值算力 × 节点数 / flops_per_token（精确算术）', () => {
    // H100 节点峰值 = 8 × 989 = 7912 TFlops；7B 重计算 8N（默认）：
    // 0.5 × 7912e12 / (8×7e9) = 70642.86 → 70643
    expect(tokensPerSecond({ mfu: 0.5, pool: 'H100_SXM', nodeCount: 1, paramsBillion: 7 })).toBe(70643);
    // 无重计算 6N：0.5 × 7912e12 / (6×7e9) = 94190.48 → 94190
    expect(
      tokensPerSecond({ mfu: 0.5, pool: 'H100_SXM', nodeCount: 1, paramsBillion: 7, recompute: false }),
    ).toBe(94190);
  });

  it('吞吐随节点数线性放大', () => {
    const one = tokensPerSecond({ mfu: 0.5, pool: 'H100_SXM', nodeCount: 1, paramsBillion: 7, recompute: false });
    const eight = tokensPerSecond({ mfu: 0.5, pool: 'H100_SXM', nodeCount: 8, paramsBillion: 7, recompute: false });
    expect(eight / one).toBeCloseTo(8, 3);
  });

  it('重计算使 flops/token 从 6N 升到 8N（吞吐降至 75%）', () => {
    const noRecompute = tokensPerSecond({ mfu: 0.5, pool: 'H100_SXM', nodeCount: 8, paramsBillion: 65, recompute: false });
    const withRecompute = tokensPerSecond({ mfu: 0.5, pool: 'H100_SXM', nodeCount: 8, paramsBillion: 65 });
    expect(withRecompute).toBeLessThan(noRecompute);
    expect(withRecompute / noRecompute).toBeCloseTo(0.75, 2);
  });
});

describe('§7.3 推理 decode 带宽上界', () => {
  it('70B FP8 单卡 H100：带宽理论上界 48 tok/s，默认效率 65% ⇒ 31 tok/s', () => {
    // 3.35 TB/s ÷ 70 GB(FP8) = 47.86 tok/s（efficiency=1）
    expect(
      decodeTpsUpperBound({ pool: 'H100_SXM', paramsBillion: 70, precision: 'fp8', gpusInTp: 1, efficiency: 1 }),
    ).toBe(48);
    // 默认 efficiency 0.65 ⇒ 31（带宽受限 ⇒ 必须多卡 TP 的量化依据）
    expect(decodeTpsUpperBound({ pool: 'H100_SXM', paramsBillion: 70, precision: 'fp8', gpusInTp: 1 })).toBe(31);
  });
  it('TP 切分线性提升单模型吞吐上界', () => {
    const tp1 = decodeTpsUpperBound({ pool: 'H100_SXM', paramsBillion: 70, precision: 'fp8', gpusInTp: 1 });
    const tp4 = decodeTpsUpperBound({ pool: 'H100_SXM', paramsBillion: 70, precision: 'fp8', gpusInTp: 4 });
    expect(tp4 / tp1).toBeCloseTo(4, 1);
  });
  it('bf16 权重字节数为 fp8 的 2 倍 ⇒ 上界减半', () => {
    const fp8 = decodeTpsUpperBound({ pool: 'H100_SXM', paramsBillion: 70, precision: 'fp8', gpusInTp: 1 });
    const bf16 = decodeTpsUpperBound({ pool: 'H100_SXM', paramsBillion: 70, precision: 'bf16', gpusInTp: 1 });
    expect(bf16 / fp8).toBeCloseTo(0.5, 1);
  });
});
