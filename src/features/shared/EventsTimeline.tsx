// 事件时间线（PRD §4.3 事件 Tab / §4.4.1：每条含 before→after 度量与建议动作）
// fixture 事件文本以中文为源，展示经 dt() 出英译（MOCK-DATA G10）
import { t, dt } from '../../i18n';
import { ui as s, EmptyState, Badge } from '../../components/ui';
import { formatDateTime, formatUtcTooltip } from '../../lib/date';
import type { MonitorEvent } from '../../types/domain';

const LEVEL_TONE = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
} as const;

const LEVEL_COLOR: Record<string, string> = {
  info: 'var(--rs-info)',
  success: 'var(--rs-success)',
  warning: 'var(--rs-warning)',
  error: 'var(--rs-danger)',
};

const metricsText = (m?: Record<string, number | string>): string =>
  m ? Object.entries(m).map(([k, v]) => `${k}=${v}`).join('  ') : '';

export function EventsTimeline({ events }: { events: MonitorEvent[] }) {
  if (!events || events.length === 0) {
    return <EmptyState icon="🕘" title={t('common.noEvents')} />;
  }
  return (
    <div className={s.timeline}>
      {events.map((e, i) => (
        <div className={s.timelineItem} key={e.id}>
          <div className={s.timelineRail}>
            <span
              className={s.timelineDot}
              style={{ background: LEVEL_COLOR[e.level] ?? 'var(--rs-text-muted)' }}
            />
            {i < events.length - 1 && <span className={s.timelineLine} />}
          </div>
          <div className={s.timelineBody}>
            <div className={s.timelineTitle}>
              <Badge tone={LEVEL_TONE[e.level]} icon={<span aria-hidden>{e.code.slice(0, 12)}</span>}>
                {dt(e.title)}
              </Badge>
              <span className={s.timelineTime} title={formatUtcTooltip(e.occurredAt)}>
                {formatDateTime(e.occurredAt)}
              </span>
            </div>
            <div className={s.timelineDetail}>{dt(e.detail)}</div>
            {(e.metricsBefore || e.metricsAfter) && (
              <div className={s.timelineMetrics}>
                {e.metricsBefore && <span>before: {metricsText(e.metricsBefore)}</span>}
                {e.metricsAfter && <span>after: {metricsText(e.metricsAfter)}</span>}
              </div>
            )}
            {e.suggestedAction && (
              <div className={s.timelineMetrics}>
                <span>{t('events.actionValue', { v0: dt(e.suggestedAction) })}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
