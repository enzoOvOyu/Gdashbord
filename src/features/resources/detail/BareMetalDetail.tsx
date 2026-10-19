// GPU 裸金属详情（PRD §4.3.2：Lambda 整机视角 + 硬件健康/带外运维；计费单位 = 台·小时）
import { t, dt } from '../../../i18n';
import { useState } from 'react';
import { Terminal, Copy, Check } from 'lucide-react';
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
import { formatUsd, formatUsdRate } from '../../../lib/money';
import { runningDuration } from '../../../lib/date';
import {
  NODE_PLATFORM,
  GPU_SPECS,
  firmwareOf,
} from '../../../mocks/fixtures/gpu-specs';
import type { RangeKey } from '../../../mocks/lib/timeseries';
import type { GpuBareMetalSpec } from '../../../types/domain';
import { endpointsOf, copyText } from './endpoints';

type TabKey =
  | 'overview'
  | 'hardware'
  | 'bmc'
  | 'network'
  | 'firmware'
  | 'elastic'
  | 'events'
  | 'billing';

export const BAREMETAL_TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', get label() { return t('detail.overview'); } },
  { key: 'hardware', get label() { return t('detail.hwMonitor'); } },
  { key: 'bmc', get label() { return t('detail.oob'); } },
  { key: 'network', get label() { return t('detail.netStorage'); } },
  { key: 'firmware', get label() { return t('detail.firmware'); } },
  { key: 'elastic', get label() { return t('detail.elastic'); } },
  { key: 'events', get label() { return t('detail.events'); } },
  { key: 'billing', get label() { return t('detail.billing'); } },
];

export function BareMetalDetail({
  detail,
  tab,
}: {
  detail: ResourceDetail;
  tab: TabKey;
}) {
  const spec = detail.spec_json as GpuBareMetalSpec;
  const platform = NODE_PLATFORM[detail.node_pool];
  const gpuSpec = GPU_SPECS[detail.node_pool];
  const fw = firmwareOf(detail.node_pool);
  const [range, setRange] = useState<RangeKey>('1h');
  const { data: metrics = [] } = useMetrics(detail.resource_uuid as string, range);
  const { data: events = [] } = useEvents(detail.resource_uuid as string);
  const ep = endpointsOf(detail);

  const perMachine = formatUsdRate(detail.cost.unit_price);
  const totalGpu = spec.machine_count * gpuSpec.gpusPerNode;

  if (tab === 'overview') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <InfoCard
          title={t('bm.machineInfo')}
          items={[
            { label: t('common.machineType'), value: spec.machine_type },
            { label: t('bm.machineCount'), value: t('bm.machineCountValue', { v0: spec.machine_count }) },
            {
              label: t('bm.totalGpuLabel'),
              value: t('bm.totalGpuValue', { v0: totalGpu, v1: gpuSpec.gpusPerNode }),
            },
            { label: 'CPU', value: dt(platform.cpu) },
            { label: t('bm.systemMemory'), value: `${platform.systemMemoryGb} GB` },
            { label: t('pools.localNvme'), value: spec.local_nvme_gb ? `${spec.local_nvme_gb} GB` : dt(platform.localNvme) },
            { label: t('deploy.bmRaid'), value: spec.raid_level.toUpperCase() },
            { label: t('bm.passthroughPolicy'), value: spec.passthrough ? t('deploy.bmPassthrough') : `MIG ${spec.mig_partition ?? '—'}` },
            {
              label: t('common.region'),
              value: `${REGION_META[detail.region].label} ${REGION_META[detail.region].iso}`,
            },
            { label: t('common.nodePool'), value: NODE_POOL_LABEL[detail.node_pool] },
            { label: t('common.rack'), value: detail.placement?.rack_id ?? '—', mono: true },
            {
              label: t('bm.bizNetwork'),
              value: dt(platform.network),
            },
          ]}
        />
        <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <StatTile
            label={t('bm.machineRate')}
            value={t('bm.ratePerMachine', { v0: perMachine })}
            hint={t('bm.rateSource')}
          />
          <StatTile
            label={t('detail.currentHourly')}
            value={formatUsd(detail.cost.per_hour)}
            hint={t('bm.hourlyLine', { v0: spec.machine_count, v1: perMachine })}
          />
          <StatTile label={t('cost.mtd')} value={formatUsd(detail.cost_summary.mtd)} />
          <StatTile
            label={t('common.uptime')}
            value={detail.running_since ? runningDuration(detail.running_since).text : '—'}
          />
        </div>
        <div className={s.muted} style={{ fontSize: 12 }}>
          {t('bm.billingDetail', { v0: spec.machine_count, v1: perMachine, v2: formatUsd(detail.cost.per_hour) })}</div>
        <MetricsGrid metrics={metrics.slice(0, 4)} />
      </div>
    );
  }

  if (tab === 'hardware') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <RangeTabs value={range} onChange={setRange} />
        <MetricsGrid metrics={metrics} />
        {metrics.length === 0 && (
          <EmptyState icon="🔧" title={t('detail.noHwMetrics')} hint={t('detail.offOrProvisioning')} />
        )}
        <KeyValue
          items={[
            { label: t('common.gpuModel'), value: dt(gpuSpec.productName) },
            { label: t('common.memPerGpu'), value: `${gpuSpec.vramGb} GB` },
            { label: t('bm.cooling'), value: gpuSpec.cooling === 'liquid' ? t('bm.liquid') : t('bm.air') },
            { label: t('bm.tdp'), value: `${gpuSpec.tdpW} W` },
          ]}
        />
      </div>
    );
  }

  if (tab === 'bmc') {
    const bmcIp = `${ep.privateIp.split('.').slice(0, 3).join('.')}.${Number(ep.privateIp.split('.')[3]) + 100}`;
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <InfoCard
          title="BMC / IPMI"
          items={[
            { label: t('bm.ipmi'), value: spec.ipmi_enabled ? t('common.enabled') : t('common.disabled') },
            { label: t('bm.bmcNetwork'), value: spec.bmc_network === 'dedicated' ? t('bm.bmcDedicated') : t('bm.bmcShared') },
            { label: t('bm.bmcAddr'), value: bmcIp, mono: true },
            { label: t('bm.bmcFirmware'), value: fw.bmcFirmware },
          ]}
        />
        <div className={s.card} style={{ padding: 12 }}>
          <div className={s.metricLabel}>
            <Terminal size={15} />
            {t('bm.sol')}
          </div>
          <div className={s.mono} style={{ fontSize: 12, margin: '6px 0' }}>
            ipmitool -I lanplus -H {bmcIp} -U ADMIN -P ****** sol activate
          </div>
          <CopyButton text={`ipmitool -I lanplus -H ${bmcIp} -U ADMIN -P ****** sol activate`} />
          <div className={s.muted} style={{ fontSize: 11, marginTop: 6 }}>
            {t('bm.selLogHint')}</div>
        </div>
      </div>
    );
  }

  if (tab === 'network') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <InfoCard
          title={t('bm.physNetwork')}
          items={[
            { label: t('bm.bizNic'), value: platform.network },
            { label: 'InfiniBand', value: spec.ib_enabled ? t('bm.ibEnabled') : t('common.disabled') },
            { label: t('common.privateIp'), value: ep.privateIp, mono: true },
            { label: t('price.publicIp'), value: ep.publicIp ?? t('common.unbound'), mono: true },
          ]}
        />
        <InfoCard
          title={t('bm.localStorage')}
          items={[
            { label: t('bm.nvmeCapacity'), value: `${spec.local_nvme_gb} GB` },
            { label: t('deploy.bmRaid'), value: spec.raid_level.toUpperCase() },
            { label: t('bm.memberDisks'), value: dt(platform.localNvme) },
            { label: t('bm.oobStorage'), value: t('bm.oobStorageHint') },
          ]}
        />
        <div className={s.muted} style={{ fontSize: 12 }}>
          {t('bm.nvmeHint')}
        </div>
      </div>
    );
  }

  if (tab === 'firmware') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <InfoCard
          title={t('bm.versionBaseline')}
          items={[
            { label: 'vBIOS', value: fw.vbios, mono: true },
            { label: t('bm.driverVersion'), value: fw.driverVersion, mono: true },
            { label: t('bm.cudaVersion'), value: fw.cudaVersion },
            { label: t('bm.bmcFirmware'), value: fw.bmcFirmware },
            { label: t('bm.firmwarePolicy'), value: spec.firmware_baseline === 'recommended' ? t('common.recommended') : t('common.latestShort') },
            {
              label: t('bm.compliance'),
              value:
                <Badge tone="success">{t('bm.compliant')}</Badge>,
            },
          ]}
        />
        <div className={s.muted} style={{ fontSize: 12 }}>
          {t('bm.complianceHint')}
        </div>
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      icon={copied ? <Check size={13} /> : <Copy size={13} />}
      onClick={async () => {
        const ok = await copyText(text);
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
  );
}
