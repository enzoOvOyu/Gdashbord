// Mock 期环境变量集中读取（ARCH §12.7；VITE_ENABLE_MOCK=false 时 derive.ts 不得被调用）
const env = import.meta.env;

export const VITE_ENABLE_MOCK = env.VITE_ENABLE_MOCK === 'true';
export const VITE_MOCK_SEED = Number(env.VITE_MOCK_SEED ?? 20261017);
export const VITE_ENABLE_CONSISTENCY_CHECK =
  env.VITE_ENABLE_CONSISTENCY_CHECK !== 'false' && import.meta.env.DEV;
export const VITE_MOCK_FAULT = (env.VITE_MOCK_FAULT ?? '') as FaultKey | '';
export const VITE_FEATURE_STATUS_BAR = env.VITE_FEATURE_STATUS_BAR !== 'false';
export const VITE_FEATURE_TOPOLOGY = env.VITE_FEATURE_TOPOLOGY !== 'false';
export const VITE_DEFAULT_REGION = (env.VITE_DEFAULT_REGION ?? 'jp') as
  | 'jp'
  | 'th'
  | 'sg'
  | 'us';
export const VITE_THEME_DEFAULT = (env.VITE_THEME_DEFAULT ?? 'light') as
  | 'light'
  | 'dark';
/** i18n 默认语言（DS §5.24；运行期可经语言切换器切换并持久化 rs.locale） */
export const VITE_I18N_DEFAULT_LOCALE = (env.VITE_I18N_DEFAULT_LOCALE ?? 'zh-CN') as
  | 'zh-CN'
  | 'en-US';
export const VITE_LOW_BALANCE_THRESHOLD_USD = Number(
  env.VITE_LOW_BALANCE_THRESHOLD_USD ?? 50,
);

export type FaultKey =
  | 'oom'
  | 'xid48'
  | 'network'
  | 'straggler'
  | 'insufficient'
  | 'billing';
export const FAULT_KEYS: FaultKey[] = [
  'oom',
  'xid48',
  'network',
  'straggler',
  'insufficient',
  'billing',
];

/** URL ?fault= 覆盖（§12.7；异常与 TTL 一起生效，默认 15 min 后自愈） */
export function activeFault(): FaultKey | '' {
  if (typeof window === 'undefined') return VITE_MOCK_FAULT;
  const q = new URLSearchParams(window.location.search).get('fault');
  if (q && (FAULT_KEYS as string[]).includes(q)) return q as FaultKey;
  return VITE_MOCK_FAULT;
}

/** 故障 TTL：15 min 后自愈（§8.4，避免原型「永久红」） */
export const FAULT_TTL_MS = 15 * 60 * 1000;
