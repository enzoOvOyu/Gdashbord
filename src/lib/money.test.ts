// money 单测（G3：USD 唯一入口、2 位精度、禁止伪精度）
import { describe, expect, it } from 'vitest';
import {
  formatGb, formatLatency, formatNumber, formatPercent, formatRate, formatUsd, round2,
} from './money';

describe('round2', () => {
  it('四舍五入到 2 位并消除浮点伪精度', () => {
    expect(round2(3.4900001)).toBe(3.49);
    expect(round2(0.005)).toBe(0.01);
    expect(round2(1234.567)).toBe(1234.57);
  });
});

describe('formatUsd', () => {
  it('按 en-US 千分位 + 2 位小数', () => {
    expect(formatUsd(1234.5)).toBe('$1,234.50');
    expect(formatUsd(0)).toBe('$0.00');
  });
  it('不展示超过 2 位的小数', () => {
    expect(formatUsd(3.4900001)).toBe('$3.49');
  });
});

describe('formatRate', () => {
  it('单价不带货币符号', () => {
    expect(formatRate(3.49)).toBe('3.49');
  });
});

describe('formatPercent / formatNumber / formatGb', () => {
  it('百分比默认 1 位小数', () => {
    expect(formatPercent(87.25)).toBe('87.3%');
    expect(formatPercent(50, 0)).toBe('50%');
  });
  it('数值按指定位数格式化', () => {
    expect(formatNumber(1234.5, 1)).toBe('1,234.5');
  });
  it('GB 固定 1 位小数', () => {
    expect(formatGb(80)).toBe('80.0 GB');
  });
});

describe('formatLatency', () => {
  it('小于 1s 用 ms 取整', () => {
    expect(formatLatency(120.6)).toBe('121 ms');
  });
  it('大于等于 1s 用 s 保留 2 位', () => {
    expect(formatLatency(1500)).toBe('1.50 s');
  });
});
