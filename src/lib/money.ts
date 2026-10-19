import { t } from '../i18n';
// 货币格式化唯一入口（DESIGN-SYSTEM §11 / PRD §7.1 / MOCK-DATA G3）
// USD 为唯一计价币种；按 locale 千分位格式化；**不做汇率换算**；金额一律 round(2)。
// G3 精度：单价 $/GPU·h 2 位；金额 $ 2 位。禁止伪精度（如 $3.4900001）。

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const USD_COMPACT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});
const NUM2 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 金额 $1,234.56 */
export function formatUsd(amount: number): string {
  return USD.format(round2(amount));
}
/** 紧凑金额 $1.2K */
export function formatUsdCompact(amount: number): string {
  return USD_COMPACT.format(amount);
}
/** 单价（不带货币符号，用于表格密集列）3.49 */
export function formatRate(rate: number): string {
  return NUM2.format(round2(rate));
}
/** 单价带货币 $3.49 */
export function formatUsdRate(rate: number): string {
  return USD.format(round2(rate));
}
/** $3.49 / GPU·时 */
export function formatPricePerGpuHour(rate: number): string {
  return t('pools.ratePerGpu', { v0: USD.format(round2(rate)) });
}

/** 百分比（1 位小数，G3） */
export function formatPercent(v: number, digits = 1): string {
  return `${v.toFixed(digits)}%`;
}
/** 通用数值（指定小数位） */
export function formatNumber(v: number, digits = 0): string {
  return v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
/** GB 展示（1 位小数，G3） */
export function formatGb(v: number): string {
  return `${v.toFixed(1)} GB`;
}
/** 延迟：ms（< 1s）/ s（≥ 1s），0 / 2 位小数（G3） */
export function formatLatency(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}
