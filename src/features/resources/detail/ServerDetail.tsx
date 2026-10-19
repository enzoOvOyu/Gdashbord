// GPU 云服务器详情（PRD §4.3.1：AutoDL 实例控制台 + 阿里云 ECS 详情分区）
import { t } from '../../../i18n';
import { useState } from 'react';
import { Terminal, FolderTree, KeyRound, Copy, Check } from 'lucide-react';
import {
  ui as s,
  KeyValue,
  InfoCard,
  Badge,
  Button,
  EmptyState,
  StatTile,
  toast,
} from '../../../components/ui';
import { MetricsGrid, RangeTabs } from '../../shared/MetricsPanel';
import { EventsTimeline } from '../../shared/EventsTimeline';
import { BillingTab } from '../../shared/BillingTab';
import { ScalingTab } from './ScalingTab';
import { useEvents, useMetrics, type ResourceDetail } from '../../shared/api';
import { NODE_POOL_LABEL, REGION_META } from '../../../lib/ids';
import { formatUsd } from '../../../lib/money';
import { formatDateTime, runningDuration } from '../../../lib/date';
import type { RangeKey } from '../../../mocks/lib/timeseries';
import type { GpuVmSpec } from '../../../types/domain';
import { endpointsOf, copyText } from './endpoints';

type TabKey = 'overview' | 'monitor' | 'console' | 'config' | 'elastic'
  | 'events' | 'billing';

export const SERVER_TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', get label() { return t('detail.overview'); } },
  { key: 'monitor', get label() { return t('detail.monitor'); } },
  { key: 'console', get label() { return t('server.console'); } },
  { key: 'config', get label() { return t('server.configStorage'); } },
  { key: 'elastic', get label() { return t('detail.elastic'); } },
  { key: 'events', get label() { return t('detail.events'); } },
  { key: 'billing', get label() { return t('detail.billing'); } },
];

export function ServerDetail({
  detail,
  tab,
}: {
  detail: ResourceDetail;
  tab: TabKey;
}) {
  const spec = detail.spec_json as GpuVmSpec;
  const [range, setRange] = useState<RangeKey>('1h');
  const { data: metrics = [] } = useMetrics(detail.resource_uuid as string, range);
  const { data: events = [] } = useEvents(detail.resource_uuid as string);
  const ep = endpointsOf(detail);
  const isRunning = detail.status === 'running';

  if (tab === 'overview') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <InfoCard
          title={t('server.instanceInfo')}
          items={[
            {
              label: t('server.specFamily'),
              value: `gpu.${spec.gpu_count}x${spec.gpu_model.replace(/\s+/g, '')}.${spec.vcpu}c.${spec.memory_gb}g`,
              mono: true,
            },
            { label: 'GPU', value: `${spec.gpu_model} × ${spec.gpu_count}` },
            { label: 'vCPU', value: spec.vcpu },
            { label: t('common.memory'), value: `${spec.memory_gb} GB` },
            { label: t('common.systemDisk'), value: `${spec.storage_gb} GB` },
            { label: t('common.image'), value: spec.image_ref, mono: true },
            {
              label: t('server.regionAz'),
              value: `${REGION_META[detail.region].label} ${REGION_META[detail.region].iso} / ${REGION_META[detail.region].iso.toLowerCase()}-az1`,
            },
            { label: t('common.nodePool'), value: NODE_POOL_LABEL[detail.node_pool] },
            { label: t('common.privateIp'), value: ep.privateIp, mono: true },
            { label: t('price.publicIp'), value: ep.publicIp ?? t('common.unbound'), mono: true },
            { label: t('common.createdAtFull'), value: formatDateTime(detail.created_at) },
            {
              label: t('common.uptime'),
              value: detail.running_since ? runningDuration(detail.running_since).text : '—',
            },
          ]}
        />
        <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <StatTile label={t('detail.currentHourly')} value={formatUsd(detail.cost.per_hour)} hint={detail.cost.metering_note} />
          <StatTile label={t('cost.today')} value={formatUsd(detail.cost_summary.today)} />
          <StatTile label={t('cost.mtd')} value={formatUsd(detail.cost_summary.mtd)} />
          <StatTile
            label={t('server.estRuntime')}
            value={
              detail.cost.remaining_hours === null
                ? '—'
                : t('common.hoursValue', { v0: detail.cost.remaining_hours.toFixed(1) })
            }
            hint={t('server.estRuntimeHint')}
          />
        </div>
        <div>
          <h2 className={s.sectionTitle} style={{ marginBottom: 12 }}>
            {t('server.compute1h')}
          </h2>
          <MetricsGrid metrics={metrics.slice(0, 4)} />
        </div>
      </div>
    );
  }

  if (tab === 'monitor') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <RangeTabs value={range} onChange={setRange} />
        <MetricsGrid metrics={metrics} />
        {metrics.length === 0 && (
          <EmptyState icon="📉" title={t('common.noMetricsData')} hint={t('common.stoppedOrProvisioning')} />
        )}
      </div>
    );
  }

  if (tab === 'console') {
    return (
      <div className={s.col} style={{ gap: 12 }}>
        {!isRunning && (
          <div
            style={{
              border: '1px solid var(--rs-border)',
              background: 'var(--rs-surface-2)',
              borderRadius: 8,
              padding: 12,
            }}
          >
            {t('inf.instanceNow')} <b>{detail.status}</b>{t('server.consoleUnavailable')}</div>
        )}
        <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          <AccessCard
            icon={<span aria-hidden>🧪</span>}
            title="JupyterLab"
            value={ep.jupyter}
            disabled={!isRunning}
          />
          <AccessCard
            icon={<Terminal size={16} />}
            title="Web Terminal"
            value={`https://${ep.publicIp ?? ep.privateIp}:8888/terminals/1`}
            disabled={!isRunning}
          />
          <AccessCard
            icon={<FolderTree size={16} />}
            title={t('server.fileManager')}
            value={ep.fileManager}
            disabled={!isRunning}
          />
          <AccessCard
            icon={<KeyRound size={16} />}
            title={t('server.sshCommand')}
            value={ep.ssh}
            disabled={!isRunning}
          />
        </div>
        <KeyValue
          items={[
            { label: t('server.loginMethod'), value: t('server.sshInjected') },
            { label: t('server.defaultUser'), value: 'ubuntu' },
            { label: t('server.privateAddr'), value: ep.privateIp, mono: true },
            { label: t('server.jupyterPort'), value: '8888' },
          ]}
        />
      </div>
    );
  }

  if (tab === 'config') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <InfoCard
          title={t('deploy.stepImageStorage')}
          items={[
            { label: t('server.sourceImage'), value: spec.image_ref, mono: true },
            { label: t('common.systemDisk'), value: `${spec.storage_gb} GB` },
            { label: t('server.dataMount'), value: '/data' },
          ]}
        />
        <InfoCard
          title={t('common.envVars')}
          items={Object.entries(spec.env ?? {}).map(([k, v]) => ({ label: k, value: v, mono: true }))}
        />
        <InfoCard
          title={t('server.portsKeys')}
          items={[
            { label: t('server.openPorts'), value: (spec.ports ?? []).join(t('common.listSep')) || '—' },
            {
              label: t('common.sshKey'),
              value: spec.ssh_pubkey ? `${spec.ssh_pubkey.slice(0, 40)}…` : '—',
              mono: true,
            },
          ]}
        />
      </div>
    );
  }

  if (tab === 'events') {
    return <EventsTimeline events={events} />;
  }

  if (tab === 'elastic') {
    return <ScalingTab resourceUuid={detail.resource_uuid as string} />;
  }

  return <BillingTab detail={detail} />;
}

function AccessCard({
  icon,
  title,
  value,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={s.card} style={{ padding: 12, opacity: disabled ? 0.6 : 1 }}>
      <div className={s.metricLabel}>
        {icon}
        {title}
      </div>
      <div className={s.mono} style={{ fontSize: 12, wordBreak: 'break-all', margin: '6px 0' }}>
        {value}
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled}
        icon={copied ? <Check size={13} /> : <Copy size={13} />}
        onClick={async () => {
          const ok = await copyText(value);
          if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } else {
            toast.error(t('common.copyFailed'));
          }
        }}
      >
        {copied ? t('common.copied') : t('common.copy')}
      </Button>
      {disabled && (
        <div className={s.muted} style={{ fontSize: 11, marginTop: 4 }}>
          {t('inf.availableAfterStart')}
        </div>
      )}
    </div>
  );
}

export { AccessCard };
export { Badge };
