// 运营&运维 · 节点池（§4.4.1 A 档：行 → Drawer → 整页 /ops/pools/:code）
// 容量一律按 region 真实聚合：可用 GPU = 该区域该池（总 GPU − 已分配），不同区域数值必须不同（G9）。
import { t, dt } from '../../i18n';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import {
  ui as s,
  Table,
  Badge,
  Button,
  Segmented,
  Progress,
  Drawer,
  DrawerTabs,
  EmptyState,
  Select,
  PageHeader,
  Toolbar,
  RegionSelect,
  KeyValue,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { formatNumber, formatPercent, formatUsd } from '../../lib/money';
import { REGION_META } from '../../lib/ids';
import {
  usePageRegion,
  useNodePools,
  type NodePoolView,
} from '../shared/api';

type DrawerTab = 'overview' | 'supply' | 'pricing';

const PRICE_BANDS = [
  { value: 'all', get label() { return t('pools.allPrices'); } },
  { value: 'b1', get label() { return t('pools.under2'); } },
  { value: 'b2', label: '$2 – $4' },
  { value: 'b3', label: '$4 – $8' },
  { value: 'b4', label: '≥ $8' },
];

const SORTS = [
  { value: 'price', get label() { return t('pools.sortPriceAsc'); } },
  { value: 'available', get label() { return t('pools.sortFreeDesc'); } },
  { value: 'rate', get label() { return t('pools.sortAllocAsc'); } },
  { value: 'vram', get label() { return t('pools.sortMemDesc'); } },
];

const inBand = (price: number, band: string): boolean => {
  if (band === 'b1') return price < 2;
  if (band === 'b2') return price >= 2 && price < 4;
  if (band === 'b3') return price >= 4 && price < 8;
  if (band === 'b4') return price >= 8;
  return true;
};

export default function NodePoolsPage() {
  const navigate = useNavigate();
  const [region, setRegion] = usePageRegion();
  const [view, setView] = useState<'card' | 'list'>('card');
  const [band, setBand] = useState('all');
  const [gpuModel, setGpuModel] = useState('all');
  const [onlyIdle, setOnlyIdle] = useState(false);
  const [sort, setSort] = useState('price');
  const [open, setOpen] = useState<NodePoolView | null>(null);
  const [tab, setTab] = useState<DrawerTab>('overview');

  const { data: pools = [], isLoading } = useNodePools(region);

  const models = Array.from(new Set(pools.map((p) => p.gpu_model)));
  const list = pools
    .filter((p) => inBand(p.unit_price, band))
    .filter((p) => (gpuModel === 'all' ? true : p.gpu_model === gpuModel))
    .filter((p) => (onlyIdle ? (p.supply?.availableGpu ?? 0) > 0 : true))
    .slice()
    .sort((a, b) => {
      if (sort === 'available') return (b.supply?.availableGpu ?? 0) - (a.supply?.availableGpu ?? 0);
      if (sort === 'rate') return rate(a) - rate(b);
      if (sort === 'vram') return b.vram_gb - a.vram_gb;
      return a.unit_price - b.unit_price;
    });

  function rate(p: NodePoolView): number {
    const total = p.supply?.totalGpu ?? 0;
    return total > 0 ? (p.supply?.allocatedGpu ?? 0) / total : 0;
  }

  const columns: Array<Column<NodePoolView>> = [
    {
      key: 'name',
      header: t('common.machineType'),
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <b>{p.display_name}</b>
          {!p.available_in_region && <Badge tone="muted">{t('pools.notOffered')}</Badge>}
          {p.supply && (p.supply.availableGpu ?? 0) === 0 && p.available_in_region && (
            <Badge tone="danger">{t('pools.noFree')}</Badge>
          )}
        </div>
      ),
    },
    { key: 'gpu', header: t('common.gpuModel'), render: (p) => p.gpu_model },
    { key: 'vram', header: t('common.memPerGpu'), numeric: true, render: (p) => `${p.vram_gb} GB` },
    { key: 'inter', header: t('pools.interconnect'), render: (p) => p.interconnect },
    {
      key: 'nodes',
      header: t('common.nodeCount'),
      numeric: true,
      render: (p) => formatNumber(p.supply?.nodeCount ?? 0),
    },
    {
      key: 'total',
      header: t('common.totalGpu'),
      numeric: true,
      render: (p) => formatNumber(p.supply?.totalGpu ?? 0),
    },
    {
      key: 'avail',
      header: t('common.availableGpu'),
      numeric: true,
      render: (p) => (
        <b style={{ color: (p.supply?.availableGpu ?? 0) > 0 ? undefined : 'var(--rs-danger)' }}>
          {formatNumber(p.supply?.availableGpu ?? 0)}
        </b>
      ),
    },
    {
      key: 'rate',
      header: t('common.allocRate'),
      render: (p) => (
        <div style={{ minWidth: 96 }}>
          <Progress value={p.supply?.allocatedGpu ?? 0} max={p.supply?.totalGpu ?? 0} />
        </div>
      ),
    },
    {
      key: 'price',
      header: t('common.unitPrice'),
      numeric: true,
      render: (p) => t('common.ratePerGpuHour', { v0: formatUsd(p.unit_price) }),
    },
    {
      key: 'act',
      header: '',
      width: 92,
      render: (p) => (
        <Button size="sm" variant="ghost" onClick={() => setOpen(p)}>
          {t('common.view')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('common.nodePool')}
        desc={t('pools.pageHint', { v0: REGION_META[region].label })}
        actions={<RegionSelect value={region} onChange={setRegion} />}
      />

      <Toolbar>
        <Segmented
          options={[
            { value: 'card', label: t('pools.cardView') },
            { value: 'list', label: t('pools.listView') },
          ]}
          value={view}
          onChange={setView}
          ariaLabel={t('pools.view')}
        />
        <Select value={band} onChange={(e) => setBand(e.target.value)} aria-label={t('pools.priceRange')}>
          {PRICE_BANDS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </Select>
        <Select value={gpuModel} onChange={(e) => setGpuModel(e.target.value)} aria-label={t('common.gpuModel')}>
          <option value="all">{t('pools.allGpuModels')}</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('pools.sort')}>
          {SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <label className={s.row} style={{ gap: 6, fontSize: 12 }}>
          <input type="checkbox" checked={onlyIdle} onChange={(e) => setOnlyIdle(e.target.checked)} />
          {t('pools.onlyFree')}
        </label>
        <span className={s.spacer} />
        <span className={s.muted} style={{ fontSize: 12 }}>
          <SlidersHorizontal size={13} /> {t('pools.countSummary', { v0: list.length, v1: REGION_META[region].iso })}
        </span>
      </Toolbar>

      {isLoading ? (
        <div className={s.muted}>{t('common.loading')}</div>
      ) : view === 'card' ? (
        list.length === 0 ? (
          <EmptyState
            icon="📭"
            title={t('pools.noMatch')}
            hint={t('pools.noMatchHint')}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 12,
            }}
          >
            {list.map((p) => {
              const total = p.supply?.totalGpu ?? 0;
              const avail = p.supply?.availableGpu ?? 0;
              const missing = !p.available_in_region;
              return (
                <div
                  key={p.code}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpen(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setOpen(p);
                  }}
                  style={{
                    border: `1px solid ${missing ? 'var(--rs-border)' : 'var(--rs-border)'}`,
                    borderRadius: 10,
                    padding: 12,
                    cursor: 'pointer',
                    opacity: missing ? 0.55 : 1,
                    background: 'var(--rs-bg)',
                  }}
                >
                  <div className={s.row} style={{ justifyContent: 'space-between' }}>
                    <b>{p.display_name}</b>
                    {missing ? (
                      <Badge tone="muted">{t('pools.notOffered')}</Badge>
                    ) : avail === 0 ? (
                      <Badge tone="danger">{t('pools.noFree')}</Badge>
                    ) : (
                      <Badge tone="success">{t('pools.hasFree')}</Badge>
                    )}
                  </div>
                  <div className={s.muted} style={{ fontSize: 12, marginTop: 2 }}>
                    {p.gpu_model} · {p.vram_gb} GB · {p.interconnect}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Progress
                      value={p.supply?.allocatedGpu ?? 0}
                      max={total}
                      right={t('pools.freeOf', { v0: formatNumber(avail), v1: formatNumber(total) })}
                    />
                  </div>
                  <div
                    className={s.row}
                    style={{ justifyContent: 'space-between', marginTop: 8, fontSize: 13 }}
                  >
                    <b>{t('common.ratePerGpuHour', { v0: formatUsd(p.unit_price) })}</b>
                    <span className={s.muted} style={{ fontSize: 11 }}>
                      {t('pools.marketValue', { v0: formatUsd(p.market_range[0]), v1: formatUsd(p.market_range[1]) })}
                    </span>
                  </div>
                  {missing && (
                    <div className={s.muted} style={{ fontSize: 11, marginTop: 6 }}>
                      {t('pools.availableRegions', { v0: p.available_regions.map((r) => REGION_META[r].iso).join(' / ') })}</div>
                  )}
                  {!missing && (
                    <div className={s.muted} style={{ fontSize: 11, marginTop: 6 }}>
                      {t('pools.machineSummary', { v0: p.supply?.nodeCount ?? 0, v1: p.gpus_per_node, v2: ' ', v3: formatUsd(p.machine_unit_price) })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <Table
          columns={columns}
          rows={list}
          rowKey={(p) => p.code}
          zebra
          onRowClick={(p) => setOpen(p)}
          empty={
            <EmptyState
              icon="📭"
              title={t('pools.noMatch')}
              hint={t('common.adjustFilters')}
            />
          }
        />
      )}

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.display_name ?? ''}
        subtitle={open ? `${open.gpu_model} · ${open.interconnect}` : ''}
        badge={
          open ? (
            <Badge tone={open.available_in_region ? 'success' : 'muted'}>
              {open.available_in_region ? t('pools.regionProvides', { v0: REGION_META[region].iso }) : t('pools.regionNotProvided')}
            </Badge>
          ) : null
        }
        footer={
          <Button
            variant="secondary"
            icon={<ArrowUpRight size={14} />}
            onClick={() => {
              if (open) navigate(`/ops/pools/${open.code}`);
            }}
          >
            {t('common.viewDetail')}
          </Button>
        }
      >
        {open && (
          <div className={s.col} style={{ gap: 12 }}>
            <DrawerTabs<DrawerTab>
              items={[
                { key: 'overview', label: t('detail.overview') },
                { key: 'supply', label: t('nodes.supply') },
                { key: 'pricing', label: t('pools.pricing') },
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === 'overview' && (
              <>
                <KeyValue
                  items={[
                    { label: t('pools.modelCode'), value: open.code, mono: true },
                    { label: t('common.gpuModel'), value: open.gpu_model },
                    { label: t('common.memPerGpu'), value: `${open.vram_gb} GB` },
                    { label: t('pools.gpuPerNode'), value: t('common.gpuCountValue', { v0: open.gpus_per_node }) },
                    { label: t('pools.interconnect'), value: open.interconnect },
                    { label: 'CPU', value: dt(open.platform.cpu) },
                    { label: t('pools.localNvme'), value: open.platform.localNvme },
                    { label: t('common.network'), value: open.platform.network },
                  ]}
                />
                <div className={s.muted} style={{ fontSize: 12 }}>
                  {t('pools.availableRegionsInline', { v0: open.available_regions.map((r) => REGION_META[r].label).join(' / ') })}</div>
              </>
            )}
            {tab === 'supply' && (
              <>
                <KeyValue
                  items={[
                    { label: t('common.nodeCount'), value: formatNumber(open.supply?.nodeCount ?? 0) },
                    { label: t('common.totalGpu'), value: formatNumber(open.supply?.totalGpu ?? 0) },
                    { label: t('common.availableGpu'), value: formatNumber(open.supply?.availableGpu ?? 0) },
                    { label: t('common.allocatedGpu'), value: formatNumber(open.supply?.allocatedGpu ?? 0) },
                    {
                      label: t('common.allocRate'),
                      value: formatPercent(
                        (open.supply && open.supply.totalGpu > 0
                          ? open.supply.allocatedGpu / open.supply.totalGpu
                          : 0) * 100,
                        1,
                      ),
                    },
                  ]}
                />
                <Progress
                  label={t('nodes.capacityLevel')}
                  value={open.supply?.allocatedGpu ?? 0}
                  max={open.supply?.totalGpu ?? 0}
                  right={t('pools.freeGpus', { v0: formatNumber(open.supply?.availableGpu ?? 0) })}
                />
                {!open.available_in_region && (
                  <div className={`${s.notice} ${s.noticeWarn}`}>
                    <div>
                      {t('pools.modelSwitchHint', { v0: REGION_META[region].label, v1: open.fallback_regions.map((r) => REGION_META[r].label).join(' / ') })}</div>
                  </div>
                )}
              </>
            )}
            {tab === 'pricing' && (
              <>
                <KeyValue
                  items={[
                    { label: t('unit.gpuHourLong'), value: t('pools.ratePerGpu', { v0: formatUsd(open.unit_price) }) },
                    { label: t('pools.bmMachineHour'), value: t('pools.ratePerMachine', { v0: formatUsd(open.machine_unit_price) }) },
                    {
                      label: t('pools.marketRange'),
                      value: `${formatUsd(open.market_range[0])} – ${formatUsd(open.market_range[1])}`,
                    },
                    {
                      label: t('pools.machinePriceNode'),
                      value: t('pools.machineRateValue', { v0: formatUsd(
                        Math.round(open.machine_unit_price * 100) / 100,
                      ), v1: open.gpus_per_node }),
                    },
                  ]}
                />
                <div className={s.muted} style={{ fontSize: 12 }}>
                  {t('pools.priceSource')}
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
