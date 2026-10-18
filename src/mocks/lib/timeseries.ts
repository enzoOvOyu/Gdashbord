// 时间序列生成（MOCK-DATA §8.2 形态模板 · §6.0 采样与降采样约定 · G4/G5）
// 不同工作负载必须使用不同形态，不可全用同一种；无数据用 null（断点），禁止填 0。
import { between, gaussian, rngFor } from './rng';

export type SeriesShape =
  | 'steady-high'
  | 'spiky-interactive'
  | 'traffic-following'
  | 'batch-sawtooth'
  | 'idle';

export interface SeriesPoint {
  /** ISO 8601 UTC（G3） */
  t: string;
  /** null = 无数据（图表断点，禁止 0 填充） */
  v: number | null;
}

/** 降采样档位（§6.0：近 1h→15s 原始；6h→1min；24h→5min；7d→1h） */
export type RangeKey = '1h' | '6h' | '24h' | '7d';
export const RANGE_CONFIG: Record<RangeKey, { points: number; stepSec: number; label: string }> = {
  '1h': { points: 240, stepSec: 15, label: '近 1 小时' },
  '6h': { points: 360, stepSec: 60, label: '近 6 小时' },
  '24h': { points: 288, stepSec: 300, label: '近 24 小时' },
  '7d': { points: 168, stepSec: 3600, label: '近 7 天' },
};

const RAW_STEP_SEC = 15; // 原始采样间隔（§6.0）

/** 昼夜节律（§8.2）：UTC 亚太高峰 02:00–10:00，北美 14:00–22:00 */
function diurnalFactor(utcHour: number): number {
  const apac = Math.exp(-Math.pow(((utcHour - 6) % 24) / 4, 2));
  const nam = Math.exp(-Math.pow(((utcHour - 18) % 24) / 4, 2));
  return 0.35 + 0.65 * Math.max(apac, nam);
}

/**
 * 生成曲线。五种形态（§8.2）：
 *  steady-high        训练：85–98% 平台 + ±3% 噪声 + 每 step 边界规律小凹（通信/同步）
 *  spiky-interactive 开发：0–10% 基底 + 随机 30–120s 的 40–90% 脉冲 + 冷却
 *  traffic-following 推理：昼夜正弦（白天峰值 3–5× 夜间谷值）+ 突发叠加
 *  batch-sawtooth    批处理：快速爬升 → 高台 → 骤降归零 → 间隔
 *  idle              空转：0–5%（触发闲置提醒）
 */
export function generateSeries(opts: {
  key: string;
  shape: SeriesShape;
  range: RangeKey;
  /** 量程下限/上限（利用率类 0–100） */
  min: number;
  max: number;
  /** 是否允许 null 断点（无数据） */
  allowGaps?: boolean;
  now?: number;
}): SeriesPoint[] {
  const { points, stepSec } = RANGE_CONFIG[opts.range];
  const now = opts.now ?? Date.now();
  const rand = rngFor(`${opts.key}:${opts.range}`);
  const span = opts.max - opts.min;
  const out: SeriesPoint[] = [];

  // 脉冲/突发状态机（跨点保持，保证形态连续而非每点独立随机）
  let burstLeft = 0;
  let burstLevel = 0;
  let phase = 0;

  for (let i = points - 1; i >= 0; i--) {
    const ts = now - i * stepSec * 1000;
    const d = new Date(ts);
    const utcHour = d.getUTCHours() + d.getUTCMinutes() / 60;
    let v: number;

    switch (opts.shape) {
      case 'steady-high': {
        // 85–98% 平台 + ±3% 噪声；每 step 边界（约每 20 点）规律小凹
        const stepBoundary = i % 20 === 0;
        const dip = stepBoundary ? span * 0.18 : 0;
        v = opts.max - span * 0.06 - dip + gaussian(rand, 0, span * 0.03);
        break;
      }
      case 'spiky-interactive': {
        if (burstLeft <= 0) {
          // 脉冲间隔：多数时间空转，偶尔触发 30–120s 脉冲
          if (rand() < 0.06) {
            burstLeft = Math.max(1, Math.round(between(rand, 30, 120) / stepSec));
            burstLevel = between(rand, opts.min + span * 0.4, opts.max);
          } else {
            burstLeft = 0;
          }
        }
        if (burstLeft > 0) {
          v = burstLevel + gaussian(rand, 0, span * 0.05);
          burstLeft--;
        } else {
          v = opts.min + between(rand, 0, span * 0.1);
        }
        break;
      }
      case 'traffic-following': {
        const base = opts.min + span * (0.2 + 0.8 * diurnalFactor(utcHour));
        // 突发叠加
        if (burstLeft <= 0 && rand() < 0.04) {
          burstLeft = Math.max(1, Math.round(between(rand, 60, 240) / stepSec));
          burstLevel = span * 0.25;
        }
        const burst = burstLeft > 0 ? burstLevel : 0;
        if (burstLeft > 0) burstLeft--;
        v = base + burst + gaussian(rand, 0, span * 0.04);
        break;
      }
      case 'batch-sawtooth': {
        // 爬升 → 高台 → 骤降归零 → 间隔，周期约 40 点
        phase = (phase + 1) % 40;
        if (phase < 4) v = opts.min + (span * phase) / 4; // 快速爬升
        else if (phase < 22) v = opts.max - gaussian(rand, 0, span * 0.02); // 高台
        else if (phase < 24) v = opts.min + span * 0.1; // 骤降
        else v = opts.min + between(rand, 0, span * 0.03); // 间隔
        break;
      }
      case 'idle': {
        v = opts.min + between(rand, 0, Math.min(span, 5));
        break;
      }
    }

    // 稀疏毛刺（§8.2：每 100–300 点 1 次，幅度 < 阈值）
    if (rand() < 1 / 200) v += gaussian(rand, 0, span * 0.08);

    v = Math.min(opts.max, Math.max(opts.min, v));

    // 无数据断点（§6.0：用 null，禁止 0 填充）
    const isGap = opts.allowGaps ? rand() < 0.012 : false;
    out.push({ t: new Date(ts).toISOString(), v: isGap ? null : round(v) });
  }
  return out;
}

function round(v: number): number {
  return Math.round(v * 10) / 10; // G3：利用率 1 位小数
}

/** 降采样聚合（§6.0）：利用率/功耗/温度取均值；延迟取分位数 */
export function downsample(
  pts: SeriesPoint[],
  targetPoints: number,
  mode: 'mean' | 'max' | 'p95' = 'mean',
): SeriesPoint[] {
  if (pts.length <= targetPoints) return pts;
  const bucket = Math.ceil(pts.length / targetPoints);
  const out: SeriesPoint[] = [];
  for (let i = 0; i < pts.length; i += bucket) {
    const slice = pts.slice(i, i + bucket).map((p) => p.v).filter((v): v is number => v !== null);
    if (slice.length === 0) {
      out.push({ t: pts[i].t, v: null });
      continue;
    }
    if (mode === 'max') out.push({ t: pts[i].t, v: Math.max(...slice) });
    else if (mode === 'p95') {
      const s = [...slice].sort((a, b) => a - b);
      out.push({ t: pts[i].t, v: s[Math.floor(s.length * 0.95)] ?? s[s.length - 1] });
    } else {
      out.push({ t: pts[i].t, v: slice.reduce((a, b) => a + b, 0) / slice.length });
    }
  }
  return out;
}

/** 实时追加点（§6.0：2–5s，围绕种子基线随机游走，禁止 Math.random 直接用于初始值） */
export function nextRealtimePoint(
  prev: number | null,
  key: string,
  min: number,
  max: number,
): number {
  const rand = rngFor(`${key}:rt:${Date.now()}`);
  const base = prev ?? (min + max) / 2;
  const drift = gaussian(rand, 0, (max - min) * 0.03);
  return Math.min(max, Math.max(min, base + drift));
}

export { RAW_STEP_SEC };
