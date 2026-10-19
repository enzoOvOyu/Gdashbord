// 计费 Tab（PRD §7.8：四段结构 —— 实时费用卡 / 单价构成 / 用量明细 / 扣费流水）
import { t, dt } from '../../i18n';
import { useMemo, useState } from 'react';
import {
  ui as s,
  Card,
  Table,
  Segmented,
  EmptyState,
  Badge,
  StatTile,
} from '../../components/ui';
import { formatUsd, formatUsdRate, formatNumber } from '../../lib/money';
import { formatDateTime } from '../../lib/date';
import { useTransactions, useUsage, type ResourceDetail } from './api';
import type { UsageRow } from '../../types/domain';
import { regionMultiplierOf } from '../../mocks/fixtures/billing';

const UNIT_LABEL: Record<string, string> = {
  get per_gpu_hour() { return t('unit.gpuHourLong'); },
  get per_gb_hour() { return t('unit.gbHourLong'); },
  get per_instance_hour() { return t('unit.instanceHourLong'); },
  get per_machine_hour() { return t('unit.machineHourLong'); },
  get per_cluster_hour() { return t('unit.clusterHourLong'); },
};

/** 单位数量名词：裸金属叫「台」，其余叫「GPU」 */
const QTY_NOUN: Record<string, string> = {
  per_gpu_hour: 'GPU',
  per_gb_hour: 'GB',
  get per_instance_hour() { return t('unit.instance'); },
  get per_machine_hour() { return t('unit.machine'); },
  get per_cluster_hour() { return t('unit.cluster'); },
};

const AGG: Array<{ value: 'hour' | 'day'; label: string }> = [
  { value: 'hour', get label() { return t('bt.perHour'); } },
  { value: 'day', get label() { return t('bt.perDay'); } },
];

function aggregate(rows: UsageRow[], by: 'hour' | 'day'): UsageRow[] {
  if (by === 'hour') return rows;
  const map = new Map<string, UsageRow>();
  for (const r of rows) {
    const key = `${r.usage_hour.slice(0, 10)}|${r.unit}`;
    const prev = map.get(key);
    if (prev) {
      prev.quantity += r.quantity;
      prev.amount += r.amount;
    } else {
      map.set(key, { ...r, usage_hour: r.usage_hour.slice(0, 10) });
    }
  }
  return [...map.values()].sort((a, b) => (a.usage_hour < b.usage_hour ? -1 : 1));
}

export function BillingTab({ detail }: { detail: ResourceDetail }) {
  const { data: usage = [] } = useUsage(detail.resource_uuid as string);
  const { data: txns = [] } = useTransactions(detail.resource_uuid as string);
  const [agg, setAgg] = useState<'hour' | 'day'>('hour');
  const cost = detail.cost;
  const summary = detail.cost_summary;

  const rows = useMemo(() => aggregate(usage, agg), [usage, agg]);
  const snapshot = detail.order?.price_snapshot ?? null;

  const computeLine =
    detail.kind === 'gpu_baremetal'
      ? {
          label: t('price.machine'),
          detail: `${cost.quantity} ${QTY_NOUN[cost.unit]} × ${formatUsdRate(cost.unit_price)}/${UNIT_LABEL[cost.unit]}`,
          hourly: cost.compute_per_hour,
        }
      : {
          label: t('bt.computeLine', { v0: UNIT_LABEL[cost.unit] }),
          detail: `${cost.quantity} ${QTY_NOUN[cost.unit]} × ${formatUsdRate(cost.unit_price)}/${UNIT_LABEL[cost.unit]}`,
          hourly: cost.compute_per_hour,
        };

  const lines = [
    computeLine,
    ...(cost.control_plane_per_hour > 0
      ? [
          {
            label: t('price.controlPlane'),
            detail: t('bt.cpLine', { v0: formatUsdRate(cost.control_plane_per_hour) }),
            hourly: cost.control_plane_per_hour,
          },
        ]
      : []),
    ...(cost.storage_per_hour > 0
      ? [
          {
            label: t('quotas.blockStorage'),
            detail: t('bt.storageLine', { v0: formatNumber(detail.storage_gb), v1: formatUsdRate(cost.storage_per_month), v2: formatUsdRate(cost.storage_per_hour) }),
            hourly: cost.storage_per_hour,
          },
        ]
      : []),
  ];

  return (
    <div className={s.col} style={{ gap: 16 }}>
      {/* ① 实时费用卡 */}
      <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        <StatTile
          label={t('bt.currentCost', { v0: UNIT_LABEL[cost.unit] })}
          value={formatUsd(cost.per_hour)}
          hint={cost.metering_note}
        />
        <StatTile label={t('cost.today')} value={formatUsd(summary.today)} />
        <StatTile label={t('cost.mtd')} value={formatUsd(summary.mtd)} />
        <StatTile label={t('bt.resourceTotal')} value={formatUsd(summary.total)} />
        <StatTile
          label={t('server.estRuntime')}
          value={cost.remaining_hours === null ? '—' : t('common.hoursValue', { v0: formatNumber(cost.remaining_hours, 1) })}
          hint={t('bt.estRuntimeHint')}
        />
        <StatTile
          label={t('bt.estimateVsCurrent')}
          value={snapshot === null ? '—' : t('bt.ratePerHour', { v0: formatUsd(snapshot) })}
          hint={
            snapshot === null
              ? t('bt.noSnapshot')
              : t('bt.rateBreakdown', { v0: formatUsd(cost.per_hour), v1: regionMultiplierOf(detail.region) })
          }
        />
      </div>

      {/* ② 单价构成明细 */}
      <Card>
        <div className={s.cardHeader}>
          <div className={s.cardTitle}>{t('bt.rateDetail')}</div>
          <div className={s.cardActions}>
            <Badge tone="info">{UNIT_LABEL[cost.unit]}</Badge>
          </div>
        </div>
        <div className={s.cardBody}>
          {lines.map((l) => (
            <div className={s.priceLine} key={l.label}>
              <span>
                <b>{l.label}</b>
                <span className={s.muted}> · {l.detail}</span>
              </span>
              <span>{t('bt.ratePerHour', { v0: formatUsd(l.hourly) })}</span>
            </div>
          ))}
          <div className={s.priceTotal}>
            <span>{t('bt.totalPayg')}</span>
            <span>
              {t('bt.rateSummary', { v0: formatUsd(cost.per_hour), v1: formatUsd(cost.per_month) })}
            </span>
          </div>
          <div className={s.muted} style={{ marginTop: 6, fontSize: 12 }}>
            {t('bt.displayBasis', { v0: UNIT_LABEL[cost.unit], v1: formatNumber(cost.quantity), v2: QTY_NOUN[cost.unit], v3: cost.metering_note })}</div>
        </div>
      </Card>

      {/* ③ 用量明细 */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <h2 className={s.sectionTitle}>{t('bt.usageDetail')}</h2>
          <Segmented options={AGG} value={agg} onChange={setAgg} ariaLabel={t('bt.granularity')} />
        </div>
        <Table
          rows={rows}
          rowKey={(r) => `${r.id}`}
          zebra
          empty={
            <EmptyState
              icon="🧾"
              title={t('bt.noUsage')}
              hint={t('bt.noUsageHint')}
            />
          }
          columns={[
            { key: 'ts', header: t('common.time'), render: (r) => formatDateTime(r.usage_hour) },
            { key: 'unit', header: t('cost.billingUnit'), render: (r) => UNIT_LABEL[r.unit] },
            {
              key: 'qty',
              header: t('bt.quantity'),
              numeric: true,
              mono: true,
              render: (r) => formatNumber(r.quantity, 4),
            },
            {
              key: 'price',
              header: t('common.unitPrice'),
              numeric: true,
              mono: true,
              render: (r) => formatUsdRate(r.unit_price),
            },
            {
              key: 'amount',
              header: t('cost.amount'),
              numeric: true,
              mono: true,
              render: (r) => formatUsd(r.amount),
            },
          ]}
        />
      </div>

      {/* ④ 扣费流水 */}
      <div>
        <h2 className={s.sectionTitle} style={{ marginBottom: 12 }}>
          {t('bt.deductions')}
        </h2>
        <Table
          rows={txns}
          rowKey={(t) => `${t.id}`}
          zebra
          empty={<EmptyState icon="💳" title={t('bt.noDeductions')} hint={t('bt.deductionsHint')} />}
          columns={[
            { key: 'ts', header: t('bt.txnTime'), render: (t) => formatDateTime(t.created_at) },
            {
              key: 'type',
              header: t('common.type'),
              render: (row) => (
                <Badge tone={row.type === 'charge' ? 'warning' : 'success'}>
                  {row.type === 'charge' ? t('bt.charge') : row.type === 'credit' ? t('bt.credit') : row.type}
                </Badge>
              ),
            },
            {
              key: 'amount',
              header: t('cost.amount'),
              numeric: true,
              mono: true,
              render: (t) => formatUsd(t.amount),
            },
            {
              key: 'after',
              header: t('bt.balanceAfter'),
              numeric: true,
              mono: true,
              render: (t) => formatUsd(t.balance_after),
            },
            { key: 'summary', header: t('common.summary'), render: (row) => dt(row.summary) },
          ]}
        />
      </div>
    </div>
  );
}
