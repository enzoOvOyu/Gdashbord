// 预留实例 Reservations（PRD §4.8 资产）：承诺用量换取折扣承诺价
// 折扣系数取自 pricing.DISCOUNT_FACTOR（§4.5），承诺价与之口径一致。
import { t } from '../../i18n';
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
  get active() { return t('status.active'); },
  get scheduled() { return t('status.pendingEffective'); },
  get expired() { return t('status.expired'); },
  get cancelled() { return t('status.cancelled'); },
  get refunded() { return t('status.refunded'); },
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
      header: t('asset.poolRegion'),
      render: (r) => (
        <span>
          <strong style={{ color: 'var(--rs-text)' }}>{NODE_POOL_LABEL[r.node_pool]}</strong>
          <br />
          <span className={s.muted}>{REGION_META[r.region]?.label ?? r.region}</span>
        </span>
      ),
    },
    { key: 'gpu', header: t('asset.committedGpu'), numeric: true, render: (r) => formatNumber(r.gpu_count) },
    {
      key: 'price',
      header: t('asset.committedRate'),
      numeric: true,
      render: (r) => (
        <span>
          {formatUsd(r.committed_price_per_gpu_hour)}
          <br />
          <span className={s.muted}>
            {t('asset.paygRate', { v0: formatUsd(effectiveRatePerGpuHour(r.node_pool, r.region)) })}
          </span>
        </span>
      ),
    },
    {
      key: 'save',
      header: t('asset.monthlyEquiv'),
      numeric: true,
      render: (r) =>
        formatUsd(r.committed_price_per_gpu_hour * r.gpu_count * HOURS_PER_MONTH),
    },
    {
      key: 'window',
      header: t('common.validity'),
      render: (r) => (
        <span className={s.secondary}>
          {formatRelative(r.start_at)} ~ {formatRelative(r.end_at)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
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
        <StatTile label={t('asset.reservedQty')} value={rows.length} />
        <StatTile label={t('asset.committedTotal')} value={formatNumber(committedGpu)} hint={t('asset.activePending')} />
      </div>

      <Card
        title={t('nav.reservations')}
        actions={isLoading ? <Badge tone="info">{t('common.loading')}</Badge> : <Badge tone="muted">{t('common.countItems', { v0: rows.length })}</Badge>}
      >
        <Table columns={columns} rows={rows} rowKey={(r) => String(r.id)} zebra />
      </Card>
    </div>
  );
}
