// 资源详情「弹性」Tab（v0.7 · PRD §4.5.2：只读视图；写入口唯一在工作台·弹性伸缩页）
// 展示该资源绑定的生效策略 + 最近伸缩事件；一切新建 / 编辑 / 暂停 / 解绑操作跳转工作台完成，
// 避免与工作台形成双入口（§4.5.2 强制分工）。
import { t, dt } from '../../../i18n';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Badge, Button, Card, KeyValue, Table } from '../../../components/ui';
import type { Column } from '../../../components/ui';
import type { KVItem } from '../../../components/ui';
import { EP, api } from '../../../lib/api-client';
import { ui as s } from '../../../components/ui';
import { formatDuration, formatRelative } from '../../../lib/date';
import type { ScalingEvent, ScalingPolicyRow } from '../../../types/domain';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'info' | 'muted'> = {
  active: 'success',
  paused: 'warning',
  cooldown: 'info',
};

const STATUS_LABEL: Record<string, () => string> = {
  active: () => t('sc.statusActive'),
  paused: () => t('sc.statusPaused'),
  cooldown: () => t('sc.statusCooldown'),
};

export function ScalingTab({ resourceUuid }: { resourceUuid: string }) {
  const { data, isLoading } = useQuery<{ policy: ScalingPolicyRow | null; events: ScalingEvent[] }>({
    queryKey: ['resource-scaling', resourceUuid],
    queryFn: () =>
      api.get<{ policy: ScalingPolicyRow | null; events: ScalingEvent[] }>(
        EP.resourceScaling(resourceUuid),
      ),
  });

  const policy = data?.policy ?? null;
  const events = data?.events ?? [];

  const columns: Array<Column<ScalingEvent>> = [
    {
      key: 'at',
      header: t('common.time'),
      render: (e) => <span className={s.secondary}>{formatRelative(e.created_at)}</span>,
    },
    {
      key: 'dir',
      header: t('sc.eventDirection'),
      render: (e) => (
        <Badge tone={e.direction === 'scale_out' ? 'danger' : 'info'}>
          {e.direction === 'scale_out' ? t('sc.eventOut') : t('sc.eventIn')}
        </Badge>
      ),
    },
    {
      key: 'size',
      header: t('sc.eventFromTo'),
      render: (e) => (
        <span className={s.mono}>
          {e.from_size} → {e.to_size}
        </span>
      ),
    },
    {
      key: 'duration',
      header: t('sc.eventDuration'),
      render: (e) => (
        <span>
          {formatDuration(e.duration_s)}
          <br />
          <span className={s.muted}>
            {e.warm_pool_hit === true
              ? t('sc.eventWarmHit')
              : e.warm_pool_hit === false
                ? t('sc.eventCold')
                : '—'}
          </span>
        </span>
      ),
    },
    {
      key: 'reason',
      header: t('sc.eventReason'),
      render: (e) => <span className={s.muted}>{dt(e.reason) || '—'}</span>
    },
  ];

  if (isLoading) {
    return (
      <Card title={t('sc.title')}>
        <p className={s.muted}>{t('common.loading')}</p>
      </Card>
    );
  }

  if (!policy) {
    return (
      <Card title={t('sc.title')}>
        <p className={s.muted}>{t('sc.emptyPolicies')}</p>
        <Link to="/workbench/scaling">
          <Button variant="primary">{t('sc.emptyPoliciesAction')}</Button>
        </Link>
      </Card>
    );
  }

  const items: KVItem[] = [
    { label: t('sc.strategyModel'), value: policy.strategy_model },
    { label: t('sc.triggerMetric'), value: `${policy.trigger_metric} ≤ ${policy.target_value ?? '—'}` },
    { label: t('sc.minMax'), value: `${policy.min_size} ~ ${policy.max_size}` },
    { label: t('sc.currentSize'), value: String(policy.current_size) },
    { label: t('sc.cooldown'), value: `${policy.cooldown_s} s` },
    { label: t('sc.drainTimeout'), value: `${policy.drain_timeout_s} s` },
    { label: t('sc.fallback'), value: policy.fallback_enabled ? t('common.enabled') : t('common.disabled') },
    { label: t('sc.scaleToZero'), value: policy.scale_to_zero ? t('common.enabled') : t('common.disabled') },
    { label: t('sc.lastEvent'), value: policy.last_event_at ? formatRelative(policy.last_event_at) : '—' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s5)' }}>
      <Card
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {t('sc.title')}
            <Badge tone={STATUS_TONE[policy.status] ?? 'muted'}>{(STATUS_LABEL[policy.status] ?? (() => policy.status))()}</Badge>
          </span>
        }
        actions={
          <Link to="/workbench/scaling">
            <Button size="sm" variant="ghost" icon={<ExternalLink size={13} />}>
              {t('sc.editPolicy')}
            </Button>
          </Link>
        }
      >
        <p className={s.muted} style={{ marginTop: 0 }}>
          {t('sc.desc')}
        </p>
        {policy.resource_kind === 'gpu_baremetal' && (
          <p className={s.muted} style={{ marginTop: 0 }}>
            ⚠ {t('sc.baremetalColdStart')} {t('sc.warmFloorHint')}
          </p>
        )}
        <KeyValue items={items} />
      </Card>

      <Card title={t('sc.tabEvents')}>
        <Table<ScalingEvent>
          columns={columns}
          rows={events}
          rowKey={(e) => e.event_uuid}
          zebra
          empty={<p className={s.muted}>{t('sc.emptyEvents')}</p>}
        />
      </Card>
    </div>
  );
}
