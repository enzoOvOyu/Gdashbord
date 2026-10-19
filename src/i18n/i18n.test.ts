// i18n 契约测试：中英字典键集合严格一致、无空值、模板占位符同名
import { describe, expect, it } from 'vitest';
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';
import { dt, t } from './index';

describe('中英语言包契约', () => {
  const zhKeys = Object.keys(zhCN).sort();
  const enKeys = Object.keys(enUS).sort();

  it('键集合完全一致（多退少补都算失败）', () => {
    expect(enKeys).toEqual(zhKeys);
  });

  it('键数量 > 1400（v0.7 后规模）', () => {
    expect(zhKeys.length).toBeGreaterThan(1400);
  });

  it('无空值（trim 后非空）', () => {
    for (const [k, v] of Object.entries(zhCN)) expect(v.trim(), k).not.toBe('');
    for (const [k, v] of Object.entries(enUS)) expect(v.trim(), k).not.toBe('');
  });

  it('同名键的模板占位符一致（避免英文丢 {v0}）', () => {
    for (const k of zhKeys) {
      const zhVars = (zhCN[k].match(/\{(\w+)\}/g) ?? []).sort();
      const enVars = (enUS[k].match(/\{(\w+)\}/g) ?? []).sort();
      expect(enVars, k).toEqual(zhVars);
    }
  });
});

describe('t() / dt() 行为', () => {
  it('t() 默认中文；变量插值生效', () => {
    expect(t('deploy.createKind', { v0: 'GPU 云服务器' })).toBe('新建 GPU 云服务器');
  });
  it('t() 缺键时返回 key 本身（不炸）', () => {
    expect(t('__no_such_key__')).toBe('__no_such_key__');
  });
  it('dt() 中文态原样返回；非中文串不触发翻译', () => {
    expect(dt('GPU 云服务器')).toBe('GPU 云服务器');
    expect(dt('H100_SXM')).toBe('H100_SXM');
    expect(dt(null)).toBe('');
  });
});
