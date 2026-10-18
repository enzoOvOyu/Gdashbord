// 计算资产（PRD §4.8 资产）：把运行中/停止的资源按资产视角汇总，含月度折算费用
import { useQuery } from '@tanstack/react-query';
import { Card, Table, StatTile, Badge, Tabs } from '../../components/ui';
import type { Column } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { KIND_META, KIND_LIST, NODE_POOL_LABEL } from '../../lib/ids';
import { LifecycleBadge } from '../../components/state-machine';
import { formatUsd, formatNumber } from '../../lib/money';
import { runningDuration } from '../../lib/date';
import { ui as s } from '../../components/ui';
import { HOURS_PER_MONTH } from '../../mocks/fixtures/pricing';
import type { ResourceKind, ResourceStatus } from '../../types/domain';
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface AssetRow {
  resource_uuid: string;
  display_id: string;
  kind: ResourceKind;
  name: string;
  region: string;
  node_pool: string;
  status: ResourceStatus;
  gpu_count: number;
  cost_per_hour: number;
  running_since: string | null;
}

export default function ComputeAssetsPage() {
  const [kindFilter, setKindFilter] = useState<ResourceKind | 'all'>('all');

  const { data: resources = [], isLoading } = useQuery<AssetRow[]>({
    queryKey: ['resources', 'assets'],
    queryFn: () => api.get<AssetRow[]>(`${EP.resources}?size=100`),
  });

  const filtered = resources.filter(
    (r) => kindFilter === 'all' || r.kind === kindFilter,
  );
  const active = filtered.filter((r) => r.status === 'running');
  const totalGpu = filtered
    .filter((r) => r.status !== 'terminating')
    .reduce((a, r) => a + r.gpu_count, 0);
  const hourly = active.reduce((a, r) => a + r.cost_per_hour, 0);

  const columns: Array<Column<AssetRow>> = [
    {
      key: 'name',
      header: '资产',
      render: (r) => (
        <span>
          <Link
            to={`/resources/${KIND_META[r.kind].routeKey}/${r.resource_uuid}`}
            style={{ color: 'var(--rs-brand)', fontWeight: 600 }}
          >
            {r.name}
          </Link>
          <br />
          <span className={s.mono}>{r.display_id}</span>
        </span>
      ),
    },
    {
      key: 'kind',
      header: '类型',
      render: (r) => (
        <span className={s.row}>
          <span>{KIND_META[r.kind].icon}</span>
          <span className={s.secondary}>{KIND_META[r.kind].label}</span>
        </span>
      ),
    },
    {
      key: 'pool',
      header: '节点池',
      render: (r) => <span className={s.secondary}>{NODE_POOL_LABEL[r.node_pool as keyof typeof NODE_POOL_LABEL] ?? r.node_pool}</span>,
    },
    { key: 'gpu', header: 'GPU', numeric: true, render: (r) => formatNumber(r.gpu_count) },
    { key: 'status', header: '状态', render: (r) => <LifecycleBadge status={r.status} /> },
    {
      key: 'cost',
      header: '小时费用',
      numeric: true,
      render: (r) => formatUsd(r.cost_per_hour),
    },
    {
      key: 'monthly',
      header: '月度折算',
      numeric: true,
      render: (r) => formatUsd(r.cost_per_hour * HOURS_PER_MONTH),
    },
    {
      key: 'uptime',
      header: '运行时长',
      render: (r) =>
        r.running_since ? (
          <span className={s.secondary}>{runningDuration(r.running_since).text}</span>
        ) : (
          <span className={s.muted}>—</span>
        ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s5)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--rs-s4)',
        }}
      >
        <StatTile label="资产实例" value={filtered.length} hint="含停止态" />
        <StatTile label="GPU 合计" value={formatNumber(totalGpu)} />
        <StatTile label="运行中" value={active.length} />
        <StatTile label="月度折算费用" value={formatUsd(hourly * HOURS_PER_MONTH)} />
      </div>

      <Card
        title="计算资产"
        actions={isLoading ? <Badge tone="info">加载中…</Badge> : <Badge tone="muted">{filtered.length} 项</Badge>}
      >
        <Tabs
          items={[
            { key: 'all', label: '全部' },
            ...KIND_LIST.map((k) => ({ key: k, label: KIND_META[k].label })),
          ]}
          value={kindFilter}
          onChange={(k) => setKindFilter(k as ResourceKind | 'all')}
        />
        <div style={{ marginTop: 'var(--rs-s4)' }}>
          <Table columns={columns} rows={filtered} rowKey={(r) => r.resource_uuid} zebra />
        </div>
      </Card>
    </div>
  );
}
