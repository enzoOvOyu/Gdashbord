// 存储包 Storage Packs（PRD §4.8 资产）：容量包及其消耗进度
import { useQuery } from '@tanstack/react-query';
import { Card, Table, StatTile, Badge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { formatGb, formatPercent } from '../../lib/money';
import { formatRelative } from '../../lib/date';
import type { StoragePack } from '../../types/domain';

/** 已用 = 总量 − 剩余（派生，禁止硬编码） */
const usedGb = (p: StoragePack): number => p.size_gb - p.remaining_gb;

export default function StoragePacksPage() {
  const { data: packs = [], isLoading } = useQuery<StoragePack[]>({
    queryKey: ['storage-packs'],
    queryFn: () => api.get<StoragePack[]>(EP.storagePacks),
  });

  const totalSize = packs.reduce((a, p) => a + p.size_gb, 0);
  const totalRemaining = packs.reduce((a, p) => a + p.remaining_gb, 0);

  const columns: Array<Column<StoragePack>> = [
    { key: 'size', header: '容量', numeric: true, render: (r) => formatGb(r.size_gb) },
    { key: 'used', header: '已用', numeric: true, render: (r) => formatGb(usedGb(r)) },
    { key: 'remaining', header: '剩余', numeric: true, render: (r) => formatGb(r.remaining_gb) },
    {
      key: 'progress',
      header: '消耗进度',
      render: (r) => {
        const pct = r.size_gb > 0 ? (usedGb(r) / r.size_gb) * 100 : 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rs-s2)' }}>
            <div
              style={{
                flex: 1,
                height: 6,
                borderRadius: 'var(--rs-r-pill)',
                background: 'var(--rs-surface-2)',
                overflow: 'hidden',
                minWidth: 80,
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, pct)}%`,
                  height: '100%',
                  background: pct > 90 ? 'var(--rs-danger)' : 'var(--rs-brand)',
                }}
              />
            </div>
            <span className="num" style={{ fontSize: 'var(--rs-fs-xs)' }}>
              {formatPercent(pct, 0)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'valid',
      header: '有效期',
      render: (r) => (
        <span className="secondary">
          {formatRelative(r.valid_from)} ~ {formatRelative(r.valid_to)}
        </span>
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
        <StatTile label="存储包数量" value={packs.length} />
        <StatTile label="总容量" value={formatGb(totalSize)} />
        <StatTile label="剩余容量" value={formatGb(totalRemaining)} />
      </div>

      <Card
        title="存储包"
        actions={isLoading ? <Badge tone="info">加载中…</Badge> : <Badge tone="muted">{packs.length} 项</Badge>}
      >
        <Table columns={columns} rows={packs} rowKey={(r) => String(r.id)} zebra />
      </Card>
    </div>
  );
}
