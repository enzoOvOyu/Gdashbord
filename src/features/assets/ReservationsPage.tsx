// 预留实例 Reservations（PRD §4.8 资产）：承诺用量换取折扣承诺价
// 折扣系数取自 pricing.DISCOUNT_FACTOR（§4.5），承诺价与之口径一致。
import { useQuery } from '@tanstack/react-query';
import { Card, Table, StatTile, Badge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { NODE_POOL_LABEL, REGION_META } from '../../lib/ids';
import { formatUsd, formatNumber } from '../../lib/money';
import { formatRelative } from '../../lib/date';
import { ui as s } from '../../components/ui';
import type { Reservation, ReservationStatus } from '../../types/domain';
import { effectiveRatePerGpuHour, HOURS_PER_MONTH } from '../../mocks/fixtures/pricing';

const STATUS_TONE: Record<ReservationStatus, 'success' | 'info' | 'muted' | 'danger'> = {
  active: 'success',
  scheduled: 'info',
  expired: 'muted',
  cancelled: 'danger',
  refunded: 'muted',
};
const STATUS_LABEL: Record<ReservationStatus, string> = {
  active: '生效中',
  scheduled: '待生效',
  expired: '已过期',
  cancelled: '已取消',
  refunded: '已退款',
};

export default function ReservationsPage() {
  const { data: rows = [], isLoading } = useQuery<Reservation[]>({
    queryKey: ['reservations'],
    queryFn: () => api.get<Reservation[]>(EP.reservations),
  });

  const committedGpu = rows
    .filter((r) => r.status === 'active' || r.status === 'scheduled')
    .reduce((a, r) => a + r.gpu_count, 0);

  const columns: Array<Column<Reservation>> = [
    {
      key: 'pool',
      header: '节点池 / 区域',
      render: (r) => (
        <span>
          <strong style={{ color: 'var(--rs-text)' }}>{NODE_POOL_LABEL[r.node_pool]}</strong>
          <br />
          <span className={s.muted}>{REGION_META[r.region]?.label ?? r.region}</span>
        </span>
      ),
    },
    { key: 'gpu', header: '承诺 GPU', numeric: true, render: (r) => formatNumber(r.gpu_count) },
    {
      key: 'price',
      header: '承诺单价',
      numeric: true,
      render: (r) => (
        <span>
          {formatUsd(r.committed_price_per_gpu_hour)}
          <br />
          <span className={s.muted}>
            按量 {formatUsd(effectiveRatePerGpuHour(r.node_pool, r.region))}
          </span>
        </span>
      ),
    },
    {
      key: 'save',
      header: '月度折算',
      numeric: true,
      render: (r) =>
        formatUsd(r.committed_price_per_gpu_hour * r.gpu_count * HOURS_PER_MONTH),
    },
    {
      key: 'window',
      header: '有效期',
      render: (r) => (
        <span className={s.secondary}>
          {formatRelative(r.start_at)} ~ {formatRelative(r.end_at)}
        </span>
      ),
    },
    {
      key: 'status',
      header: '状态',
      render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
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
        <StatTile label="预留数量" value={rows.length} />
        <StatTile label="承诺 GPU 合计" value={formatNumber(committedGpu)} hint="生效+待生效" />
      </div>

      <Card
        title="预留实例"
        actions={isLoading ? <Badge tone="info">加载中…</Badge> : <Badge tone="muted">{rows.length} 项</Badge>}
      >
        <Table columns={columns} rows={rows} rowKey={(r) => String(r.id)} zebra />
      </Card>
    </div>
  );
}
