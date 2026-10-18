// 数据集（PRD §4.6）：版本化数据集，容量与 Trainium/GPU 资源挂载结合
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
    { key: 'name', header: '名称', render: (r) => <strong style={{ color: 'var(--rs-text)' }}>{r.name}</strong> },
    { key: 'version', header: '版本', render: (r) => <span className={s.mono}>{r.version}</span> },
    { key: 'size', header: '容量', numeric: true, render: (r) => formatGb(r.size_gb) },
    {
      key: 'created',
      header: '创建于',
      render: (r) => <span className={s.secondary}>{formatRelative(r.created_at)}</span>,
    },
    {
      key: 'mount',
      header: '挂载',
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
        <StatTile label="数据集总数" value={datasets.length} />
        <StatTile label="累计容量" value={formatGb(totalGb)} />
        <StatTile label="最新版本数" value={new Set(datasets.map((d) => d.version)).size} hint="去重版本" />
      </div>

      <Card
        title="数据集"
        actions={isLoading ? <Badge tone="info">加载中…</Badge> : <Badge tone="muted">{datasets.length} 项</Badge>}
      >
        <Table columns={columns} rows={datasets} rowKey={(r) => String(r.id)} zebra />
      </Card>
    </div>
  );
}
