// 计费 Tab（PRD §7.8：四段结构 —— 实时费用卡 / 单价构成 / 用量明细 / 扣费流水）
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
  per_gpu_hour: 'GPU·小时',
  per_gb_hour: 'GB·小时',
  per_instance_hour: '实例·小时',
  per_machine_hour: '台·小时',
  per_cluster_hour: '集群·小时',
};

/** 单位数量名词：裸金属叫「台」，其余叫「GPU」 */
const QTY_NOUN: Record<string, string> = {
  per_gpu_hour: 'GPU',
  per_gb_hour: 'GB',
  per_instance_hour: '实例',
  per_machine_hour: '台',
  per_cluster_hour: '集群',
};

const AGG: Array<{ value: 'hour' | 'day'; label: string }> = [
  { value: 'hour', label: '按小时' },
  { value: 'day', label: '按天' },
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
          label: '机器（整机）',
          detail: `${cost.quantity} ${QTY_NOUN[cost.unit]} × ${formatUsdRate(cost.unit_price)}/${UNIT_LABEL[cost.unit]}`,
          hourly: cost.compute_per_hour,
        }
      : {
          label: `算力（${UNIT_LABEL[cost.unit]}）`,
          detail: `${cost.quantity} ${QTY_NOUN[cost.unit]} × ${formatUsdRate(cost.unit_price)}/${UNIT_LABEL[cost.unit]}`,
          hourly: cost.compute_per_hour,
        };

  const lines = [
    computeLine,
    ...(cost.control_plane_per_hour > 0
      ? [
          {
            label: '托管控制面',
            detail: `1 集群 × ${formatUsdRate(cost.control_plane_per_hour)}/集群·时`,
            hourly: cost.control_plane_per_hour,
          },
        ]
      : []),
    ...(cost.storage_per_hour > 0
      ? [
          {
            label: '块存储',
            detail: `${formatNumber(detail.storage_gb)} GB × ${formatUsdRate(cost.storage_per_month)}/月 → 折 ${formatUsdRate(cost.storage_per_hour)}/时`,
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
          label={`当前费用（${UNIT_LABEL[cost.unit]}）`}
          value={formatUsd(cost.per_hour)}
          hint={cost.metering_note}
        />
        <StatTile label="今日花费" value={formatUsd(summary.today)} />
        <StatTile label="本月花费" value={formatUsd(summary.mtd)} />
        <StatTile label="本资源累计" value={formatUsd(summary.total)} />
        <StatTile
          label="预计可运行"
          value={cost.remaining_hours === null ? '—' : `${formatNumber(cost.remaining_hours, 1)} 小时`}
          hint="= 账户余额 / 当前时单价"
        />
        <StatTile
          label="下单时预估 vs 当前"
          value={snapshot === null ? '—' : `${formatUsd(snapshot)} /时`}
          hint={
            snapshot === null
              ? '该资源无订单快照'
              : `当前 ${formatUsd(cost.per_hour)}/时 · 区域系数 ×${regionMultiplierOf(detail.region)}`
          }
        />
      </div>

      {/* ② 单价构成明细 */}
      <Card>
        <div className={s.cardHeader}>
          <div className={s.cardTitle}>单价构成明细</div>
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
              <span>{formatUsd(l.hourly)} /时</span>
            </div>
          ))}
          <div className={s.priceTotal}>
            <span>合计（按需）</span>
            <span>
              {formatUsd(cost.per_hour)} /时 · {formatUsd(cost.per_month)} /月(730h)
            </span>
          </div>
          <div className={s.muted} style={{ marginTop: 6, fontSize: 12 }}>
            展示口径：{UNIT_LABEL[cost.unit]}；计费数量 = {formatNumber(cost.quantity)}{' '}
            {QTY_NOUN[cost.unit]}。{cost.metering_note}。
          </div>
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
          <h2 className={s.sectionTitle}>用量明细</h2>
          <Segmented options={AGG} value={agg} onChange={setAgg} ariaLabel="聚合粒度" />
        </div>
        <Table
          rows={rows}
          rowKey={(r) => `${r.id}`}
          zebra
          empty={
            <EmptyState
              icon="🧾"
              title="该资源暂无用量记录"
              hint="资源处于供给中或尚未开始计量"
            />
          }
          columns={[
            { key: 'ts', header: '时间', render: (r) => formatDateTime(r.usage_hour) },
            { key: 'unit', header: '计费单位', render: (r) => UNIT_LABEL[r.unit] },
            {
              key: 'qty',
              header: '数量',
              numeric: true,
              mono: true,
              render: (r) => formatNumber(r.quantity, 4),
            },
            {
              key: 'price',
              header: '单价',
              numeric: true,
              mono: true,
              render: (r) => formatUsdRate(r.unit_price),
            },
            {
              key: 'amount',
              header: '金额',
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
          扣费流水
        </h2>
        <Table
          rows={txns}
          rowKey={(t) => `${t.id}`}
          zebra
          empty={<EmptyState icon="💳" title="暂无流水" hint="扣费按日汇总产生" />}
          columns={[
            { key: 'ts', header: '交易时间', render: (t) => formatDateTime(t.created_at) },
            {
              key: 'type',
              header: '类型',
              render: (t) => (
                <Badge tone={t.type === 'charge' ? 'warning' : 'success'}>
                  {t.type === 'charge' ? '扣费' : t.type === 'credit' ? '充值' : t.type}
                </Badge>
              ),
            },
            {
              key: 'amount',
              header: '金额',
              numeric: true,
              mono: true,
              render: (t) => formatUsd(t.amount),
            },
            {
              key: 'after',
              header: '余额（after）',
              numeric: true,
              mono: true,
              render: (t) => formatUsd(t.balance_after),
            },
            { key: 'summary', header: '摘要', render: (t) => t.summary },
          ]}
        />
      </div>
    </div>
  );
}
