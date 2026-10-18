// 货币格式化：统一 USD + locale 千分位两位小数，不做汇率换算（DESIGN-SYSTEM §11 / PRD §7.1）
const STANDARD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COMPACT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

export function formatUsd(amount: number): string {
  return STANDARD.format(amount);
}

export function formatUsdCompact(amount: number): string {
  return COMPACT.format(amount);
}
