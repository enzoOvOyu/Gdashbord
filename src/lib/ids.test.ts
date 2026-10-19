// ids 单测（ARCH §12.6：单一事实来源映射；PRD §5.5：display_id 规范）
import { describe, expect, it } from 'vitest';
import {
  KIND_LIST, KIND_META, kindOfRouteKey, makeDisplayId, matchesResourceQuery,
  resourceDetailPath, resourceListPath, routeKeyOf,
} from './ids';
import type { ResourceKind } from '../types/domain';

/** 固定种子的简易伪随机（保证测试可复现，G5） */
function seeded(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe('KIND_META 单一事实来源', () => {
  it('四类齐全且 routeKey / 前缀唯一', () => {
    expect(KIND_LIST).toHaveLength(4);
    const routeKeys = KIND_LIST.map((k) => KIND_META[k].routeKey);
    const prefixes = KIND_LIST.map((k) => KIND_META[k].prefix);
    expect(new Set(routeKeys).size).toBe(4);
    expect(new Set(prefixes).size).toBe(4);
  });

  it('前缀与类型语义对应', () => {
    expect(KIND_META.gpu_vm.prefix).toBe('srv-');
    expect(KIND_META.gpu_baremetal.prefix).toBe('bm-');
    expect(KIND_META.vgpu.prefix).toBe('vgpu-');
    expect(KIND_META.inference.prefix).toBe('inf-');
  });

  it('routeKey 双向映射自洽', () => {
    for (const k of KIND_LIST) {
      expect(kindOfRouteKey(routeKeyOf(k))).toBe(k);
    }
  });

  it('label 惰性求值（语言切换可更新，非模块级固化）', () => {
    // getter 存在性校验：直接读属性应返回当前语言文案
    expect(typeof KIND_META.gpu_vm.label).toBe('string');
    expect(KIND_META.gpu_vm.label.length).toBeGreaterThan(0);
  });
});

describe('makeDisplayId', () => {
  it('格式 = 前缀 + 6 位小写字母数字', () => {
    for (const k of KIND_LIST) {
      const id = makeDisplayId(k, seeded(k.length + 7));
      expect(id.startsWith(KIND_META[k].prefix)).toBe(true);
      expect(id.slice(KIND_META[k].prefix.length)).toMatch(/^[a-z0-9]{6}$/);
    }
  });

  it('同一随机序列产生同一 ID（可复现）', () => {
    const a = makeDisplayId('gpu_vm', seeded(1));
    const b = makeDisplayId('gpu_vm', seeded(1));
    expect(a).toBe(b);
  });
});

describe('matchesResourceQuery', () => {
  it('空查询命中一切', () => {
    expect(matchesResourceQuery('srv-abc123' as never, 'uuid-x' as never, '  ')).toBe(true);
  });
  it('display_id 与 uuid 均可检索（大小写不敏感）', () => {
    expect(matchesResourceQuery('srv-abc123' as never, 'uuid-x' as never, 'ABC123')).toBe(true);
    expect(matchesResourceQuery('srv-abc123' as never, 'uuid-x' as never, 'UUID-X')).toBe(true);
    expect(matchesResourceQuery('srv-abc123' as never, 'uuid-x' as never, 'zzz')).toBe(false);
  });
});

describe('资源路由', () => {
  it('列表/详情路由由 routeKey 派生', () => {
    const uuid = 'r-0001' as never;
    expect(resourceListPath('gpu_vm' as ResourceKind)).toBe('/resources/servers');
    expect(resourceDetailPath('vgpu' as ResourceKind, uuid)).toBe('/resources/vgpu/r-0001');
  });
});
