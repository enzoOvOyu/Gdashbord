// 运营&运维 · 节点详情（§4.4.1 A 档整页；由 /ops/nodes 抽屉进入）
import { t, dt } from '../../i18n';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
import { useNode } from '../shared/api';
import { NODE_STATE_META, MetricDiff } from './shared';

export default function NodesDetailPage() {
  const navigate = useNavigate();
  const { nodeUid } = useParams<{ nodeUid: string }>();
  const { data, isLoading } = useNode(nodeUid);

  if (isLoading) {
    return (
      <Card title={t('common.loading')}>
        <div className={s.muted}>{t('nodes.loading')}</div>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card title={t('nodes.notFound')}>
        <EmptyState
          icon="🔍"
          title={t('nodes.nodeNotFound', { v0: nodeUid ?? '—' })}
          hint={t('nodes.reselect')}
          action={<Button onClick={() => navigate('/ops/nodes')}>{t('common.backToNodes')}</Button>}
        />
      </Card>
    );
  }

  const n = data.node;

  return (
    <div>
      <PageHeader
        title={
          <span className={s.row}>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={14} />}
              onClick={() => navigate('/ops/nodes')}
            />
            <span style={{ fontFamily: 'var(--rs-font-mono)', fontSize: 18 }}>{n.node_uid}</span>
          </span>
        }
        desc={t('nodes.scopeLine', { v0: n.pool_display_name, v1: REGION_META[n.region].label, v2: n.rack_id, v3: n.switch_group })}
        actions={
          <span className={s.row}>
            <Badge tone={NODE_STATE_META[n.state]?.tone ?? 'neutral'}>
              {NODE_STATE_META[n.state]?.label ?? n.state}
            </Badge>
            <RegionSelect
              value={n.region}
              onChange={() => undefined}
              disabledReason={t('nodes.regionFixed')}
            />
          </span>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Card title={t('nodes.info')}>
          <KeyValue
            items={[
              { label: t('nodes.uid'), value: n.node_uid, mono: true },
              { label: t('common.machineType'), value: n.pool_display_name },
              { label: 'GPU', value: t('common.gpuCountValue', { v0: n.gpu_count }) },
              { label: t('common.rack'), value: n.rack_id ?? '—', mono: true },
              { label: t('common.switchGroup'), value: n.switch_group ?? '—', mono: true },
              { label: t('common.region'), value: REGION_META[n.region].label },
              { label: t('nodes.slowNode'), value: n.straggler ? t('nodes.slowYes') : t('common.no') },
              { label: t('pools.bearingResources'), value: t('common.countGeneric', { v0: n.hosted_resources }) },
              { label: t('nodes.statusUpdated'), value: formatDateTime(n.updated_at) },
            ]}
          />
        </Card>
        <Card title={t('nodes.opsAdvice')}>
          {n.state === 'ready' ? (
            <div className={s.muted} style={{ fontSize: 13 }}>
              {t('nodes.healthyOk')}{n.straggler ? t('nodes.stragglerNote') : t('common.period')}
            </div>
          ) : (
            <div className={`${s.notice} ${s.noticeWarn}`}>
              <div>
                {t('common.stateColon', { v0: NODE_STATE_META[n.state]?.label ?? n.state })}{n.state === 'notready'
                  ? t('nodes.stateNotReady')
                  : n.state === 'remediation'
                    ? t('nodes.stateRemediation')
                    : n.state === 'draining'
                      ? t('nodes.stateDraining')
                      : t('nodes.stateCordoned')}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card title={t('nodes.eventsTitle', { v0: data.events.length })}>
        {data.events.length === 0 ? (
          <EmptyState icon="📄" title={t('nodes.noEvents')} hint={t('nodes.noEventsHint')} />
        ) : (
          <div className={s.timeline}>
            {data.events.map((e) => (
              <div className={s.timelineItem} key={e.id}>
                <div className={s.timelineRail}>
                  <span
                    className={s.timelineDot}
                    style={{
                      background:
                        e.level === 'error'
                          ? 'var(--rs-danger)'
                          : e.level === 'warning'
                            ? 'var(--rs-warning)'
                            : 'var(--rs-info)',
                    }}
                  />
                  <span className={s.timelineLine} />
                </div>
                <div className={s.timelineBody}>
                  <div className={s.timelineTitle}>
                    {dt(e.title)}
                    <Badge tone={e.level === 'error' ? 'danger' : 'warning'}>{e.code}</Badge>
                  </div>
                  <div className={s.timelineTime}>{formatDateTime(e.occurredAt)}</div>
                  <div className={s.timelineDetail}>{dt(e.detail)}</div>
                  <MetricDiff before={e.metricsBefore} after={e.metricsAfter} />
                  {e.suggestedAction && (
                    <div className={s.muted} style={{ fontSize: 11 }}>
                      {t('events.actionValue', { v0: dt(e.suggestedAction) })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
