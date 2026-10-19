// 自研轻量 i18n（DESIGN-SYSTEM §5.24）
// - t(key, vars)：翻译 UI 文案；缺键回退中文并在 dev 下告警
// - dt(source)：翻译 fixture 数据短语（fixture 保留中文源值，按中文原句反查语言包）
// 语言切换经 stores/locale 的 setLocale 同步模块态；ConsoleLayout 订阅 locale 以整体重渲染
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';

export type LocaleCode = 'zh-CN' | 'en-US';
export type Dict = Record<string, string>;

export const LOCALE_CODES: LocaleCode[] = ['zh-CN', 'en-US'];

const DICTS: Record<LocaleCode, Dict> = { 'zh-CN': zhCN, 'en-US': enUS };

let current: LocaleCode = 'zh-CN';

export function getLocale(): LocaleCode {
  return current;
}

export function setLocale(l: LocaleCode): void {
  current = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

/** UI 语言显示名（语言切换器用；本身不再翻译） */
export const LOCALE_LABELS: Record<LocaleCode, string> = {
  'zh-CN': '中文',
  'en-US': 'English',
};

function interpolate(s: string, vars: Record<string, unknown>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (!(k in vars)) return m;
    const v = vars[k];
    return v == null ? '' : String(v);
  });
}

export function t(key: string, vars?: Record<string, unknown>): string {
  let s = DICTS[current][key];
  if (s === undefined) {
    s = zhCN[key];
    if (s === undefined) {
      if (import.meta.env.DEV) console.warn('[i18n] missing key:', key);
      return key;
    }
    if (import.meta.env.DEV) console.warn('[i18n] missing key in ' + current + ':', key);
  }
  return vars ? interpolate(s, vars) : s;
}

/** 数据短语反查表：中文源值 → i18n key（fixture 与语言包同源，见 MOCK-DATA §6） */
const ZH_TO_KEY = new Map<string, string>();
for (const [k, v] of Object.entries(zhCN)) {
  if (!ZH_TO_KEY.has(v)) ZH_TO_KEY.set(v, k);
}

/**
 * 模板反查表：字典值中含 {name} 占位的条目（如 'fx.orderAcceptedDesc'），
 * 编译为锚定正则，用于反查 fixture 动态拼接的中文句子（G10：数据值双语文案）。
 * 例：`订单受理，目标形态 GPU 云服务器，区域 JP，请求 4 GPU。`
 *   → t('fx.orderAcceptedDesc', { v0: dt('GPU 云服务器'), v1: 'JP', v2: '4' })
 * 匹配策略：**字面量最长者胜**——防止 '{v0}。' 这类通用模板劫持具体句子。
 */
interface TemplateEntry {
  key: string;
  re: RegExp;
  names: string[];
  literalLen: number;
}
const TEMPLATE_ENTRIES: TemplateEntry[] = [];
for (const [k, v] of Object.entries(zhCN)) {
  if (!v.includes('{')) continue;
  const names: string[] = [];
  let literalLen = 0;
  const pattern = v
    .split(/(\{\w+\})/)
    .map((chunk) => {
      const m = /^\{(\w+)\}$/.exec(chunk);
      if (m) {
        names.push(m[1]);
        return '([\\s\\S]+?)';
      }
      literalLen += chunk.length;
      return chunk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  TEMPLATE_ENTRIES.push({ key: k, re: new RegExp('^' + pattern + '$'), names, literalLen });
}
// 字面量长的模板更具体，优先匹配
TEMPLATE_ENTRIES.sort((a, b) => b.literalLen - a.literalLen);

/** 含 CJK（汉字/中文标点/全角形式）才可能是待翻译的中文数据值 */
const CJK_RE = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;

/**
 * 翻译 fixture 中的中文数据短语；缺失时原样返回（不告警，数据可能来自后端）。
 * 两级反查：① 整句精确匹配；② 占位符模板匹配（动态拼接句，捕获值递归 dt）。
 */
export function dt(source: string | null | undefined): string {
  if (source == null) return '';
  if (current === 'zh-CN') return source;
  const exact = ZH_TO_KEY.get(source);
  if (exact !== undefined) return DICTS[current][exact] ?? source;
  if (!CJK_RE.test(source)) return source;
  let best: { entry: TemplateEntry; m: RegExpExecArray } | null = null;
  for (const entry of TEMPLATE_ENTRIES) {
    const m = entry.re.exec(source);
    if (m && (!best || entry.literalLen > best.entry.literalLen)) best = { entry, m };
  }
  if (best) {
    const vars: Record<string, unknown> = {};
    best.entry.names.forEach((n, i) => {
      vars[n] = dt(best!.m[i + 1]);
    });
    return t(best.entry.key, vars);
  }
  return source;
}
