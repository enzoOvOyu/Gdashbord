// GPU 裸金属详情（PRD §4.3.2：Lambda 整机视角 + 硬件健康/带外运维；计费单位 = 台·小时）
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
  | 'events'
  | 'billing';

export const BAREMETAL_TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'hardware', label: '硬件监控' },
  { key: 'bmc', label: '带外管理' },
  { key: 'network', label: '网络与存储' },
  { key: 'firmware', label: '固件与驱动' },
  { key: 'events', label: '事件' },
  { key: 'billing', label: '计费' },
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
          title="整机信息（采购单位：台）"
          items={[
            { label: '机型', value: spec.machine_type },
            { label: '台数', value: `${spec.machine_count} 台` },
            {
              label: '整机总卡数',
              value: `${totalGpu}（仅展示 = 台数 × ${gpuSpec.gpusPerNode}）`,
            },
            { label: 'CPU', value: platform.cpu },
            { label: '系统内存', value: `${platform.systemMemoryGb} GB` },
            { label: '本地 NVMe', value: spec.local_nvme_gb ? `${spec.local_nvme_gb} GB` : platform.localNvme },
            { label: 'RAID 级别', value: spec.raid_level.toUpperCase() },
            { label: '直通策略', value: spec.passthrough ? '整卡直通（passthrough）' : `MIG ${spec.mig_partition ?? '—'}` },
            {
              label: '区域',
              value: `${REGION_META[detail.region].label} ${REGION_META[detail.region].iso}`,
            },
            { label: '节点池', value: NODE_POOL_LABEL[detail.node_pool] },
            { label: '机架位', value: detail.placement?.rack_id ?? '—', mono: true },
            {
              label: '业务网络',
              value: platform.network,
            },
          ]}
        />
        <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <StatTile
            label="整机单价"
            value={`${perMachine} /台·时`}
            hint="来自 billing_rates(unit=per_machine_hour)，禁止按卡现算"
          />
          <StatTile
            label="当前 $/时"
            value={formatUsd(detail.cost.per_hour)}
            hint={`${spec.machine_count} 台 × ${perMachine}`}
          />
          <StatTile label="本月花费" value={formatUsd(detail.cost_summary.mtd)} />
          <StatTile
            label="运行时长"
            value={detail.running_since ? runningDuration(detail.running_since).text : '—'}
          />
        </div>
        <div className={s.muted} style={{ fontSize: 12 }}>
          计费口径：机器 {spec.machine_count} 台 × {perMachine}/台·时 ={' '}
          {formatUsd(detail.cost.per_hour)}/时。整机不支持按卡扩缩。
        </div>
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
          <EmptyState icon="🔧" title="暂无硬件指标" hint="资源已关机或正在供给" />
        )}
        <KeyValue
          items={[
            { label: 'GPU 型号', value: gpuSpec.productName },
            { label: '单卡显存', value: `${gpuSpec.vramGb} GB` },
            { label: '散热方式', value: gpuSpec.cooling === 'liquid' ? '液冷' : '风冷' },
            { label: '单卡 TDP', value: `${gpuSpec.tdpW} W` },
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
            { label: 'IPMI 纳管', value: spec.ipmi_enabled ? '已启用' : '未启用' },
            { label: 'BMC 网络', value: spec.bmc_network === 'dedicated' ? '独立管理网口' : '共享网口' },
            { label: 'BMC 地址', value: bmcIp, mono: true },
            { label: 'BMC 固件', value: fw.bmcFirmware },
          ]}
        />
        <div className={s.card} style={{ padding: 12 }}>
          <div className={s.metricLabel}>
            <Terminal size={15} />
            串行控制台（Serial-over-LAN）
          </div>
          <div className={s.mono} style={{ fontSize: 12, margin: '6px 0' }}>
            ipmitool -I lanplus -H {bmcIp} -U ADMIN -P ****** sol activate
          </div>
          <CopyButton text={`ipmitool -I lanplus -H ${bmcIp} -U ADMIN -P ****** sol activate`} />
          <div className={s.muted} style={{ fontSize: 11, marginTop: 6 }}>
            SEL 日志条目随节点事件（node_events）产生，可在运营&运维 · 事件与维护中查看完整记录。
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'network') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <InfoCard
          title="物理网络"
          items={[
            { label: '业务网卡', value: platform.network },
            { label: 'InfiniBand', value: spec.ib_enabled ? '8 × 400 Gb/s NDR（已启用）' : '未启用' },
            { label: '私网 IP', value: ep.privateIp, mono: true },
            { label: '公网 IP', value: ep.publicIp ?? '未绑定', mono: true },
          ]}
        />
        <InfoCard
          title="本地存储"
          items={[
            { label: '本地 NVMe 容量', value: `${spec.local_nvme_gb} GB` },
            { label: 'RAID 级别', value: spec.raid_level.toUpperCase() },
            { label: '成员盘', value: platform.localNvme },
            { label: '带外存储', value: '不占用业务存储' },
          ]}
        />
        <div className={s.muted} style={{ fontSize: 12 }}>
          裸金属的本地 NVMe 为整机自带，不单列存储计费行（§7.1）。
        </div>
      </div>
    );
  }

  if (tab === 'firmware') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <InfoCard
          title="版本基线"
          items={[
            { label: 'vBIOS', value: fw.vbios, mono: true },
            { label: '驱动版本', value: fw.driverVersion, mono: true },
            { label: 'CUDA 版本', value: fw.cudaVersion },
            { label: 'BMC 固件', value: fw.bmcFirmware },
            { label: '固件基线策略', value: spec.firmware_baseline === 'recommended' ? '推荐基线' : '最新' },
            {
              label: '合规性',
              value:
                <Badge tone="success">符合推荐基线</Badge>,
            },
          ]}
        />
        <div className={s.muted} style={{ fontSize: 12 }}>
          驱动版本需 ≥ 镜像 CUDA 版本要求；不合规将在供给时报 DriverVersionMismatch。
        </div>
      </div>
    );
  }

  if (tab === 'events') {
    return <EventsTimeline events={events} />;
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
          toast.error('复制失败，请手动选择');
        }
      }}
    >
      {copied ? '已复制' : '复制'}
    </Button>
  );
}
