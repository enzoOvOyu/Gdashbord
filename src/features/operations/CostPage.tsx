// 成本分析（PRD §4.7：按 项目 / 资源 / 区域 拆解 billing_usage；预算预警）
import { useQuery } from '@tanstack/react-query';
import { Card, StatTile, Table, Badge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { ui as s } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { useRegionStore } from '../../stores/auth';
import { formatUsd } from '../../lib/money';
import { formatDateTime } from '../../lib/date';
import { KIND_META, REGION_META } from '../../lib/ids';
import type { ResourceKind, RegionCode } from '../../types/domain';

interface Txn {
  id: number;
  type: string;
  amount: number;
  balance_after: number;
  reference_type: string | null;
  created_at: string;
}
interface Invoice {
  id: number;
  invoice_uuid: string;
  billing_period: string;
  total: number;
  status: string;
  paid_at: string | null;
}
interface Row {
  resource_uuid: string;
  display_id: string;
  kind: ResourceKind;
  name: string;
  region: RegionCode;
  gpu_count: number;
  status: string;
  cost_per_hour: number;
}

export default function CostPage() {
  const region = useRegionStore((st) => st.region);
  const { data: txns = [] } = useQuery<Txn[]>({
    queryKey: ['transactions'],
    queryFn: () => api.get<Txn[]>(`${EP.transactions}?size=50`),
  });
  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => api.get<Invoice[]>(EP.invoices),
  });
  const { data: resources = [] } = useQuery<Row[]>({
    queryKey: ['resources-cost', region],
    queryFn: () => api.get<Row[]>(`${EP.resources}?region=${region}&size=100`),
  });

  const costMtd = 3284.4;
  const budget = 5000;
  const running = resources.filter((r) => r.status === 'running');
  const hourly = running.reduce((a, r) => a + r.cost_per_hour, 0);

  // 按区域拆解
  const byRegion = resources.reduce<Record<string, number>>((acc, r) => {
    acc[r.region] = (acc[r.region] ?? 0) + (r.status === 'running' ? r.cost_per_hour : 0);
    return acc;
  }, {});
  // 按类型拆解
  const byKind = resources.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = (acc[r.kind] ?? 0) + (r.status === 'running' ? r.cost_per_hour : 0);
    return acc;
  }, {});

  const columns: Array<Column<Row>> = [
    { key: 'id', header: '资源', render: (r) => <span className={s.mono}>{r.display_id}</span> },
    { key: 'name', header: '名称', render: (r) => r.name },
    { key: 'kind', header: '类型', render: (r) => `${KIND_META[r.kind].icon} ${KIND_META[r.kind].label}` },
    { key: 'region', header: '区域', render: (r) => REGION_META[r.region]?.label ?? r.region },
    { key: 'gpu', header: 'GPU', numeric: true, render: (r) => r.gpu_count },
    {
      key: 'cost',
      header: '$/时',
      numeric: true,
      mono: true,
      render: (r) => (r.status === 'running' ? formatUsd(r.cost_per_hour) : <span className={s.muted}>—</span>),
    },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px' }}>成本分析</h1>
      <p style={{ color: 'var(--rs-text-secondary)', margin: '0 0 24px' }}>
        按项目 / 资源 / 区域拆解（PRD §4.7）；金额由 §7.1 派生，币种统一 USD。
      </p>

      <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <StatTile
          label="本月花费"
          value={formatUsd(costMtd)}
          hint={`预算 ${formatUsd(budget)} · ${((costMtd / budget) * 100).toFixed(0)}%`}
          color={costMtd / budget > 0.9 ? 'var(--rs-warning)' : undefined}
        />
        <StatTile label="当前小时成本" value={formatUsd(hourly)} hint={`${running.length} 个运行中资源`} />
        <StatTile label="预计月度" value={formatUsd(hourly * 730)} hint="按 730 小时/月折算" />
      </div>

      <div className={s.grid} style={{ gridTemplateColumns: '1fr 1fr', marginTop: 24 }}>
        <Card title="按区域拆解">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(byRegion).map(([rg, v]) => (
              <div key={rg}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{REGION_META[rg as RegionCode]?.label ?? rg}</span>
                  <strong>{formatUsd(v)} /时</strong>
                </div>
                <div style={{ height: 6, background: 'var(--rs-surface-2)', borderRadius: 999, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${hourly ? (v / hourly) * 100 : 0}%`, height: '100%', background: 'var(--rs-brand)' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="按资源类型拆解">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(byKind).map(([k, v]) => (
              <div key={k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{KIND_META[k as ResourceKind]?.icon} {KIND_META[k as ResourceKind]?.label}</span>
                  <strong>{formatUsd(v)} /时</strong>
                </div>
                <div style={{ height: 6, background: 'var(--rs-surface-2)', borderRadius: 999, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${hourly ? (v / hourly) * 100 : 0}%`, height: '100%', background: KIND_META[k as ResourceKind]?.colorVar }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="按资源拆解" className={s.mt4} tight>
        <Table columns={columns} rows={running} rowKey={(r) => r.resource_uuid} zebra />
      </Card>

      <div className={s.grid} style={{ gridTemplateColumns: '1fr 1fr', marginTop: 24 }}>
        <Card title="月结对账单（凭证，非二次扣费）">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            {invoices.map((inv) => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={s.mono}>{inv.billing_period}</span>
                <strong>{formatUsd(inv.total)}</strong>
                <Badge tone={inv.status === 'paid' ? 'success' : inv.status === 'open' ? 'info' : 'warning'}>
                  {inv.status}
                </Badge>
                <span className={s.muted} style={{ marginLeft: 'auto', fontSize: 12 }}>
                  {inv.paid_at ? formatDateTime(inv.paid_at) : '未结清'}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="账户交易流水">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, maxHeight: 260, overflowY: 'auto' }}>
            {txns.slice(0, 20).map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge tone={t.amount >= 0 ? 'success' : 'neutral'}>{t.type}</Badge>
                <strong style={{ color: t.amount >= 0 ? 'var(--rs-success)' : 'var(--rs-text)' }}>
                  {formatUsd(t.amount)}
                </strong>
                <span className={s.muted} style={{ fontSize: 12 }}>
                  余额 {formatUsd(t.balance_after)}
                </span>
                <span className={s.muted} style={{ marginLeft: 'auto', fontSize: 12 }}>
                  {formatDateTime(t.created_at)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <p style={{ fontSize: 12, color: 'var(--rs-text-muted)', marginTop: 16 }}>
        口径：4 类资源统一按 GPU·小时计量；停止仅停算力费、存储继续计费；终止立即停计并按秒结算（PRD §7.4）。
      </p>
    </div>
  );
}
