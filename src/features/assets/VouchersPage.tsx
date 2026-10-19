// 代金券（PRD §4.9：面额/余额/适用范围/有效期；结算优先消耗最先到期的券）
import { t } from '../../i18n';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Badge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { formatUsd } from '../../lib/money';
import { formatDateTime } from '../../lib/date';
import { KIND_META, REGION_META } from '../../lib/ids';
import type { RegionCode, ResourceKind } from '../../types/domain';

interface VoucherRow {
  id: number;
  code: string;
  amount: number;
  balance: number;
  applicable_kind: ResourceKind | null;
  applicable_region: RegionCode | null;
  status: string;
  valid_from: string;
  valid_to: string;
}

export default function VouchersPage() {
  const { data: vouchers = [] } = useQuery<VoucherRow[]>({
    queryKey: ['vouchers'],
    queryFn: () => api.get<VoucherRow[]>(EP.vouchers),
  });

  const columns: Array<Column<VoucherRow>> = [
    { key: 'code', header: t('asset.voucherCode'), mono: true, render: (v) => v.code },
    { key: 'amount', header: t('asset.faceValue'), numeric: true, mono: true, render: (v) => formatUsd(v.amount) },
    { key: 'balance', header: t('common.balance'), numeric: true, mono: true, render: (v) => formatUsd(v.balance) },
    {
      key: 'scope',
      header: t('asset.scope'),
      render: (v) => (
        <span style={{ fontSize: 13 }}>
          {v.applicable_kind ? KIND_META[v.applicable_kind].label : t('asset.anyKind')}
          {' · '}
          {v.applicable_region ? (REGION_META[v.applicable_region]?.label ?? v.applicable_region) : t('asset.anyRegion')}
        </span>
      ),
    },
    {
      key: 'valid',
      header: t('common.validity'),
      render: (v) => (
        <span style={{ fontSize: 12 }}>
          {formatDateTime(v.valid_from)} → {formatDateTime(v.valid_to)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (v) => (
        <Badge tone={v.status === 'unused' ? 'success' : v.status === 'partial' ? 'info' : v.status === 'expired' ? 'muted' : 'neutral'}>
          {v.status}
        </Badge>
      ),
    },
  ];

  const totalBalance = vouchers
    .filter((v) => v.status !== 'expired')
    .reduce((a, v) => a + v.balance, 0);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px' }}>{t('nav.vouchers')}</h1>
      <p style={{ color: 'var(--rs-text-secondary)', margin: '0 0 24px' }}>
        {t('asset.availableTotal')} <strong>{formatUsd(totalBalance)}</strong>{t('asset.redemptionHint')}</p>
      <Card title={t('asset.voucherList')} tight>
        <Table columns={columns} rows={vouchers} rowKey={(v) => String(v.id)} zebra />
      </Card>
    </div>
  );
}
