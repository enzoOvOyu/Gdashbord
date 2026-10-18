// 确定性伪随机（G5：固定种子可复现，禁止 Math.random() 直接用于初始值）
// mulberry32 —— 同一 seed 连续两次加载必须得到完全一致的结果（MOCK-DATA §12）
import { VITE_MOCK_SEED } from './env';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 由字符串派生稳定子种子（同一 resourceUuid 恒定 ⇒ 同一条时间序列） */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 以全局 seed 为基准，按 key 派生独立但确定的生成器 */
export function rngFor(key: string): () => number {
  return mulberry32((VITE_MOCK_SEED ^ hashSeed(key)) >>> 0);
}

/** [min, max] 区间内均匀分布 */
export function between(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}
/** [min, max] 区间内整数 */
export function intBetween(rand: () => number, min: number, max: number): number {
  return Math.floor(between(rand, min, max + 1));
}
/** 近似高斯（Box-Muller），用于噪声（§8.2：σ = 量程的 1–3%） */
export function gaussian(rand: () => number, mean = 0, sigma = 1): number {
  const u = Math.max(rand(), 1e-9);
  const v = Math.max(rand(), 1e-9);
  return mean + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
