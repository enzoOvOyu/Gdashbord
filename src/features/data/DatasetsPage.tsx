// 数据集（PRD §4.6）：版本化数据集，容量与 Trainium/GPU 资源挂载结合
import { t } from '../../i18n';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, StatTile, Badge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { formatRelative } from '../../lib/date';
import { formatGb } from '../../lib/money';
import { ui as s } from '../../components/ui';
import type { Dataset } from '../../types/domain';

export default function DatasetsPage() {
  const { data: datasets = [], isLoading } = useQuery<Dataset[]>({
    queryKey: ['datasets'],
    queryFn: () => api.get<Dataset[]>(`${EP.datasets}?size=100`),
  });

  const totalGb = datasets.reduce((a, d) => a + d.size_gb, 0);

  const columns: Array<Column<Dataset>> = [
    { key: 'name', header: t('common.name'), render: (r) => <strong style={{ color: 'var(--rs-text)' }}>{r.name}</strong> },
    { key: 'version', header: t('dp.version'), render: (r) => <span className={s.mono}>{r.version}</span> },
    { key: 'size', header: t('common.capacity'), numeric: true, render: (r) => formatGb(r.size_gb) },
    {
      key: 'created',
      header: t('common.createdAt'),
      render: (r) => <span className={s.secondary}>{formatRelative(r.created_at)}</span>,
    },
    {
      key: 'mount',
      header: t('dp.mount'),
      render: () => (
        <span className={s.muted}>/mnt/datasets</span>
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
        <StatTile label={t('dp.datasetCount')} value={datasets.length} />
        <StatTile label={t('dp.totalSize')} value={formatGb(totalGb)} />
        <StatTile label={t('dp.latestVersions')} value={new Set(datasets.map((d) => d.version)).size} hint={t('dp.dedupVersions')} />
      </div>

      <Card
        title={t('dp.datasetTitle')}
        actions={isLoading ? <Badge tone="info">{t('common.loading')}</Badge> : <Badge tone="muted">{t('common.countItems', { v0: datasets.length })}</Badge>}
      >
        <Table columns={columns} rows={datasets} rowKey={(r) => String(r.id)} zebra />
      </Card>
    </div>
  );
}
