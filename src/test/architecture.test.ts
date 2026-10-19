// 架构守护测试（ARCH §11「Mock 关闭时派生责任移交后端」的边界治理）
// 目的：把「UI 层对 mocks 的有限引用」钉成**白名单**——可以存在，但不许悄悄扩散；
//      同时保证仓库内无 TODO/FIXME 半成品标记、无 @ts-ignore 压制错误。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../', import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const ALL_FILES = walk(SRC).map((p) => relative(SRC, p).split(sep).join('/'));

/** 允许引用 mocks 的 UI/store 文件 → 原因（新增引用必须在此登记理由） */
const MOCK_IMPORT_ALLOWLIST: Record<string, string> = {
  'app/layouts/ConsoleLayout.tsx': '特性开关 VITE_FEATURE_STATUS_BAR（构建期常量，非数据）',
  'app/providers.tsx': 'MSW 启动开关 + 动态 import worker',
  'components/charts/MetricChart.tsx': '指标语义（semanticOf）为展示层参考常量',
  'components/ui/MetricCard.tsx': 'MetricSemantic 类型（type-only）',
  'features/assets/ComputeAssetsPage.tsx': '月度折算小时数常量',
  'features/assets/ReservationsPage.tsx': '取价常量（Mock 期唯一取价入口）',
  'features/data/StoragePage.tsx': '对象存储单价常量',
  'features/deployment/InferenceWizard.tsx': '模型目录 + 显存计划派生（向导期同步计算）',
  'features/deployment/shared/pricing.ts': '取价常量（Mock 期唯一取价入口）',
  'features/resources/detail/BareMetalDetail.tsx': '硬件规格参考常量',
  'features/resources/detail/InferenceDetail.tsx': 'RangeKey 类型（type-only）',
  'features/resources/detail/ServerDetail.tsx': 'RangeKey 类型（type-only）',
  'features/resources/detail/VgpuDetail.tsx': 'RangeKey 类型 + 特性开关',
  'features/shared/BillingTab.tsx': '区域系数参考常量',
  'features/shared/MetricsPanel.tsx': '指标类型 + 语义常量',
  'features/shared/api.ts': 'MetricSeries 类型（type-only）',
  'stores/auth.ts': '默认区域开关 + 默认项目种子',
  'stores/locale.ts': '默认语言开关',
};

const MOCK_IMPORT_RE = /from\s+'[^']*mocks\/(?:fixtures|lib|metrics|browser|handlers)[^']*'/;

describe('架构边界（ARCH §11）', () => {
  it('UI/store 层对 mocks 的引用不超出白名单', () => {
    const violations: string[] = [];
    for (const rel of ALL_FILES) {
      if (rel.startsWith('mocks/') || rel.startsWith('test/')) continue;
      const src = readFileSync(join(SRC, rel), 'utf8');
      if (MOCK_IMPORT_RE.test(src) && !(rel in MOCK_IMPORT_ALLOWLIST)) {
        violations.push(rel);
      }
    }
    expect(violations, '新增 mocks 引用需在架构测试白名单登记理由').toEqual([]);
  });

  it('白名单登记项真实存在（防止登记后文件被改名/删除而失效）', () => {
    for (const rel of Object.keys(MOCK_IMPORT_ALLOWLIST)) {
      expect(ALL_FILES, rel).toContain(rel);
    }
  });
});

describe('工程质量底线', () => {
  /** 自身文件包含这些标记的字面量（正则源码），扫描时跳过 */
  const SELF = 'test/architecture.test.ts';

  it('src 内无 TODO / FIXME / XXX 半成品标记', () => {
    const hits: string[] = [];
    for (const rel of ALL_FILES) {
      if (rel === SELF) continue;
      const src = readFileSync(join(SRC, rel), 'utf8');
      const re = /\/\/.*\b(TODO|FIXME|XXX)\b|\/\*[\s\S]*?\b(TODO|FIXME|XXX)\b[\s\S]*?\*\//;
      if (re.test(src)) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });

  it('src 内无 @ts-ignore / @ts-expect-error 压制类型错误', () => {
    const hits: string[] = [];
    for (const rel of ALL_FILES) {
      if (rel === SELF) continue;
      const src = readFileSync(join(SRC, rel), 'utf8');
      if (/@ts-(ignore|expect-error)/.test(src)) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });

  it('无 eslint-disable / stylelint-disable 静默豁免', () => {
    // 白名单：consistency.ts 的 dev 红旗告警（§8.3）需要 console.warn
    const allow: Record<string, string> = {
      'mocks/lib/consistency.ts': 'dev 模式 G8 红旗断言告警（no-console）',
    };
    const hits: string[] = [];
    for (const rel of ALL_FILES) {
      if (rel === SELF) continue;
      const src = readFileSync(join(SRC, rel), 'utf8');
      if (/(eslint|stylelint)-disable/.test(src) && !(rel in allow)) hits.push(rel);
    }
    expect(hits).toEqual([]);
    for (const rel of Object.keys(allow)) expect(ALL_FILES, rel).toContain(rel);
  });
});
