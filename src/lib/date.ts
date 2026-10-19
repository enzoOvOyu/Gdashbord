import { t } from '../i18n';
// 时间格式化（MOCK-DATA §8.5：接口统一 UTC；UI 按本地时区显示，Tooltip 显示原始 UTC）
// G3：时间戳 ISO 8601 UTC 以 Z 结尾

export function toIsoUtc(d: Date): string {
  return d.toISOString();
}

/** 本地时间 HH:mm:ss */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour12: false });
}
/** 本地时间 YYYY-MM-DD HH:mm */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}
/** 原始 UTC（用于 Tooltip，避免跨时区评审歧义） */
export function formatUtcTooltip(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

/** 相对时间：3 分钟前 / 2 小时前 */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('date.justNow');
  if (min < 60) return t('date.minAgo', { v0: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('date.hourAgo', { v0: hr });
  const day = Math.floor(hr / 24);
  if (day < 30) return t('date.dayAgo', { v0: day });
  return t('date.monthAgo', { v0: Math.floor(day / 30) });
}

/** 运行时长（running_since 起算），返回 { hours, text } */
export function runningDuration(sinceIso: string, now: number = Date.now()) {
  const ms = now - new Date(sinceIso).getTime();
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  const text =
    days > 0 ? t('date.dh', { v0: days, v1: hours % 24 }) : t('date.hm', { v0: hours, v1: Math.floor((ms % 3600000) / 60000) });
  return { hours, days, text };
}

/** 秒级耗时的人类可读文本（伸缩事件 duration_s / 冷启动耗时口径，MOCK-DATA §6.9） */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return t('date.secShort', { v0: s });
  const min = Math.floor(s / 60);
  const rest = s % 60;
  if (min < 60) return rest === 0 ? t('date.minShort', { v0: min }) : t('date.minSecShort', { v0: min, v1: rest });
  const hr = Math.floor(min / 60);
  return t('date.hourMinShort', { v0: hr, v1: min % 60 });
}

/** 自然月账期 yyyy-mm-01（PRD §7.5，UTC+0） */
export function billingPeriodOf(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
