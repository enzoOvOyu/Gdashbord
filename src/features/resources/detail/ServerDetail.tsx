// GPU 云服务器详情（PRD §4.3.1：AutoDL 实例控制台 + 阿里云 ECS 详情分区）
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
import { useEvents, useMetrics, type ResourceDetail } from '../../shared/api';
import { NODE_POOL_LABEL, REGION_META } from '../../../lib/ids';
import { formatUsd } from '../../../lib/money';
import { formatDateTime, runningDuration } from '../../../lib/date';
import type { RangeKey } from '../../../mocks/lib/timeseries';
import type { GpuVmSpec } from '../../../types/domain';
import { endpointsOf, copyText } from './endpoints';

type TabKey = 'overview' | 'monitor' | 'console' | 'config' | 'events' | 'billing';

export const SERVER_TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'monitor', label: '监控' },
  { key: 'console', label: '控制台' },
  { key: 'config', label: '配置与存储' },
  { key: 'events', label: '事件' },
  { key: 'billing', label: '计费' },
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
          title="实例信息"
          items={[
            {
              label: '规格族',
              value: `gpu.${spec.gpu_count}x${spec.gpu_model.replace(/\s+/g, '')}.${spec.vcpu}c.${spec.memory_gb}g`,
              mono: true,
            },
            { label: 'GPU', value: `${spec.gpu_model} × ${spec.gpu_count}` },
            { label: 'vCPU', value: spec.vcpu },
            { label: '内存', value: `${spec.memory_gb} GB` },
            { label: '系统盘', value: `${spec.storage_gb} GB` },
            { label: '镜像', value: spec.image_ref, mono: true },
            {
              label: '区域 / 可用区',
              value: `${REGION_META[detail.region].label} ${REGION_META[detail.region].iso} / ${REGION_META[detail.region].iso.toLowerCase()}-az1`,
            },
            { label: '节点池', value: NODE_POOL_LABEL[detail.node_pool] },
            { label: '私网 IP', value: ep.privateIp, mono: true },
            { label: '公网 IP', value: ep.publicIp ?? '未绑定', mono: true },
            { label: '创建时间', value: formatDateTime(detail.created_at) },
            {
              label: '运行时长',
              value: detail.running_since ? runningDuration(detail.running_since).text : '—',
            },
          ]}
        />
        <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          <StatTile label="当前 $/时" value={formatUsd(detail.cost.per_hour)} hint={detail.cost.metering_note} />
          <StatTile label="今日花费" value={formatUsd(detail.cost_summary.today)} />
          <StatTile label="本月花费" value={formatUsd(detail.cost_summary.mtd)} />
          <StatTile
            label="预计可运行"
            value={
              detail.cost.remaining_hours === null
                ? '—'
                : `${detail.cost.remaining_hours.toFixed(1)} 小时`
            }
            hint="= 余额 / 当前时单价"
          />
        </div>
        <div>
          <h2 className={s.sectionTitle} style={{ marginBottom: 12 }}>
            算力概览（近 1h）
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
          <EmptyState icon="📉" title="暂无指标数据" hint="资源已停止或正在供给" />
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
            实例当前为 <b>{detail.status}</b>，Web 控制台不可用。启动实例后即可使用
            JupyterLab / Web Terminal / 文件管理器 / SSH。
          </div>
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
            title="文件管理器"
            value={ep.fileManager}
            disabled={!isRunning}
          />
          <AccessCard
            icon={<KeyRound size={16} />}
            title="SSH 连接串"
            value={ep.ssh}
            disabled={!isRunning}
          />
        </div>
        <KeyValue
          items={[
            { label: '登录方式', value: 'SSH 公钥（创建时注入）' },
            { label: '默认用户', value: 'ubuntu' },
            { label: '私网地址', value: ep.privateIp, mono: true },
            { label: 'Jupyter 端口', value: '8888' },
          ]}
        />
      </div>
    );
  }

  if (tab === 'config') {
    return (
      <div className={s.col} style={{ gap: 16 }}>
        <InfoCard
          title="镜像与存储"
          items={[
            { label: '来源镜像', value: spec.image_ref, mono: true },
            { label: '系统盘', value: `${spec.storage_gb} GB` },
            { label: '数据盘挂载点', value: '/data' },
          ]}
        />
        <InfoCard
          title="环境变量"
          items={Object.entries(spec.env ?? {}).map(([k, v]) => ({ label: k, value: v, mono: true }))}
        />
        <InfoCard
          title="端口与密钥"
          items={[
            { label: '开放端口', value: (spec.ports ?? []).join('、') || '—' },
            {
              label: 'SSH 公钥',
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
            toast.error('复制失败，请手动选择');
          }
        }}
      >
        {copied ? '已复制' : '复制'}
      </Button>
      {disabled && (
        <div className={s.muted} style={{ fontSize: 11, marginTop: 4 }}>
          启动后可用
        </div>
      )}
    </div>
  );
}

export { AccessCard };
export { Badge };
