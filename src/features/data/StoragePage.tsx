// 对象存储（PRD §4.6）：桶列表与Region 分布；按 $0.023/GB·月 计价（§4.3）
import { t } from '../../i18n';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, StatTile, Badge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { REGION_META } from '../../lib/ids';
import { formatRelative } from '../../lib/date';
import { formatUsd } from '../../lib/money';
import { ui as s } from '../../components/ui';
import type { Bucket } from '../../types/domain';
import { OBJECT_STORAGE_RATE_GB_MONTH } from '../../mocks/fixtures/pricing';

export default function StoragePage() {
  const { data: buckets = [], isLoading } = useQuery<Bucket[]>({
    queryKey: ['buckets'],
    queryFn: () => api.get<Bucket[]>(EP.buckets),
  });

  const byRegion = buckets.reduce<Record<string, number>>((acc, b) => {
    acc[b.region] = (acc[b.region] ?? 0) + 1;
    return acc;
  }, {});

  const columns: Array<Column<Bucket>> = [
    { key: 'name', header: t('dp.bucketName'), render: (r) => <span className={s.mono}>{r.name}</span> },
    {
      key: 'region',
      header: t('common.region'),
      render: (r) => (
        <span className={s.secondary}>
          {REGION_META[r.region]?.label ?? r.region}
        </span>
      ),
    },
    {
      key: 'endpoint',
      header: t('dp.endpoint'),
      render: (r) => <span className={s.mono}>s3.{r.region}.runsun.cloud</span>,
    },
    {
      key: 'created',
      header: t('common.createdAt'),
      render: (r) => <span className={s.secondary}>{formatRelative(r.created_at)}</span>,
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
        <StatTile label={t('dp.bucketCount')} value={buckets.length} />
        <StatTile label={t('dp.coveredRegions')} value={Object.keys(byRegion).length} hint={t('dp.regionCount')} />
        <StatTile label={t('dp.storageRate')} value={t('dp.storageRateValue', { v0: formatUsd(OBJECT_STORAGE_RATE_GB_MONTH) })} />
      </div>

      <Card
        title={t('dp.storageTitle')}
        actions={isLoading ? <Badge tone="info">{t('common.loading')}</Badge> : <Badge tone="muted">{t('dp.bucketCountValue', { v0: buckets.length })}</Badge>}
      >
        <Table columns={columns} rows={buckets} rowKey={(r) => String(r.id)} zebra />
      </Card>
    </div>
  );
}
