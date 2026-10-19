// 运营&运维 · 工单详情（§4.4.1 A 档整页；由 /ops/tickets 抽屉进入）
import { t, dt } from '../../i18n';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import {
  ui as s,
  Card,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  RegionSelect,
  KeyValue,
} from '../../components/ui';
import { formatDateTime } from '../../lib/date';
import { REGION_META } from '../../lib/ids';
import { usePageRegion, useTicket } from '../shared/api';
import { TICKET_PRIORITY_META, TICKET_STATUS_META } from './shared';

export default function TicketsDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [region] = usePageRegion();
  const { data, isLoading } = useTicket(id);

  if (isLoading) {
    return (
      <Card title={t('common.loading')}>
        <div className={s.muted}>{t('tickets.loading')}</div>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card title={t('tickets.notFound')}>
        <EmptyState
          icon="🔍"
          title={t('tickets.notFoundValue', { v0: id ?? '—' })}
          hint={t('tickets.reselect')}
          action={<Button onClick={() => navigate('/ops/tickets')}>{t('common.backToTickets')}</Button>}
        />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title={
          <span className={s.row}>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={14} />}
              onClick={() => navigate('/ops/tickets')}
            />
            {dt(data.subject)}
          </span>
        }
        desc={t('tickets.scopeLine', { v0: String(data.id), v1: formatDateTime(data.created_at) })}
        actions={
          <span className={s.row}>
            <Badge tone={TICKET_STATUS_META[data.status]?.tone ?? 'neutral'}>
              {TICKET_STATUS_META[data.status]?.label ?? data.status}
            </Badge>
            <Badge tone={TICKET_PRIORITY_META[data.priority]?.tone ?? 'neutral'}>
              {t('tickets.priorityValue', { v0: TICKET_PRIORITY_META[data.priority]?.label ?? data.priority })}
            </Badge>
            <RegionSelect
              value={data.region ?? region}
              onChange={() => undefined}
              disabledReason={t('tickets.regionByResource')}
            />
          </span>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        <Card title={t('tickets.info')}>
          <KeyValue
            items={[
              { label: t('tickets.id'), value: `TK-${String(data.id)}`, mono: true },
              { label: t('common.status'), value: TICKET_STATUS_META[data.status]?.label ?? data.status },
              { label: t('tickets.priority'), value: TICKET_PRIORITY_META[data.priority]?.label ?? data.priority },
              {
                label: t('tickets.linkedResource'),
                value: data.resource_name ?? t('tickets.unlinked'),
              },
              { label: t('common.region'), value: data.region ? REGION_META[data.region].label : t('tickets.noRegion') },
              { label: t('common.createdAtFull'), value: formatDateTime(data.created_at) },
              { label: t('tickets.updatedAt'), value: formatDateTime(data.updated_at) },
            ]}
          />
          {data.resource_uuid && (
            <div style={{ marginTop: 8 }}>
              <Button
                icon={<ExternalLink size={14} />}
                onClick={() => navigate(`/resources/all/${data.resource_uuid}`)}
              >
                {t('tickets.jumpResource')}
              </Button>
            </div>
          )}
        </Card>
        <Card title={t('tickets.description')}>
          <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {data.description ? dt(data.description) : t('tickets.noDescription')}
          </div>
        </Card>
        <Card title={t('tickets.progress')}>
          <div className={s.timeline}>
            {(data.timeline ?? []).map((t, i) => (
              <div className={s.timelineItem} key={`${t.at}-${i}`}>
                <div className={s.timelineRail}>
                  <span
                    className={s.timelineDot}
                    style={{
                      background:
                        t.level === 'warning' ? 'var(--rs-warning)' : 'var(--rs-info)',
                    }}
                  />
                  {i < (data.timeline?.length ?? 0) - 1 && <span className={s.timelineLine} />}
                </div>
                <div className={s.timelineBody}>
                  <div className={s.timelineTitle}>{t.label}</div>
                  <div className={s.timelineTime}>{formatDateTime(t.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
