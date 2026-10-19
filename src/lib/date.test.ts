// date 单测（§8.5：UTC 存储 + 本地展示 + Tooltip 原始 UTC；duration 人类可读）
import { describe, expect, it } from 'vitest';
import {
  billingPeriodOf, formatDuration, formatRelative, runningDuration, toIsoUtc,
} from './date';

describe('toIsoUtc', () => {
  it('统一以 UTC 输出（Z 后缀）', () => {
    const d = new Date('2026-10-19T04:00:00+08:00');
    expect(toIsoUtc(d)).toBe('2026-10-18T20:00:00.000Z');
  });
});

describe('formatDuration', () => {
  it('null/undefined 安全返回占位', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
  });
  it('按 秒/分/时 组合（负值按 0 处理）', () => {
    expect(formatDuration(45)).toBe('45 秒');
    expect(formatDuration(-10)).toBe('0 秒');
    expect(formatDuration(90)).toBe('1 分 30 秒');
    expect(formatDuration(120)).toBe('2 分钟');
    expect(formatDuration(3600)).toBe('1 小时 0 分');
    expect(formatDuration(3661)).toBe('1 小时 1 分');
  });
});

describe('formatRelative', () => {
  it('相对时间使用注入的 now（可复现）', () => {
    const now = Date.parse('2026-10-19T12:00:00Z');
    expect(formatRelative('2026-10-19T11:59:30Z', now)).toBe('刚刚');
    expect(formatRelative('2026-10-19T11:30:00Z', now)).toBe('30 分钟前');
    expect(formatRelative('2026-10-19T09:00:00Z', now)).toBe('3 小时前');
    expect(formatRelative('2026-10-17T12:00:00Z', now)).toBe('2 天前');
  });
});

describe('runningDuration', () => {
  it('从启动时刻到 now 的整小时数', () => {
    const now = Date.parse('2026-10-19T12:00:00Z');
    const r = runningDuration('2026-10-18T09:30:00Z', now);
    expect(r.hours).toBe(26);
    expect(r.days).toBe(1);
    expect(r.text).toBe('1 天 2 小时');
  });
});

describe('billingPeriodOf', () => {
  it('自然月账期 yyyy-mm-01（UTC）', () => {
    expect(billingPeriodOf(new Date('2026-10-19T00:00:00Z'))).toBe('2026-10-01');
    expect(billingPeriodOf(new Date('2026-01-31T23:00:00Z'))).toBe('2026-01-01');
  });
});
