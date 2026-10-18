// 运营&运维 · 节点池（§4.4.1 A 档：行 → Drawer → 整页 /ops/pools/:code）
// 容量一律按 region 真实聚合：可用 GPU = 该区域该池（总 GPU − 已分配），不同区域数值必须不同（G9）。
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
  { value: 'all', label: '全部单价' },
  { value: 'b1', label: '< $2 / GPU·时' },
  { value: 'b2', label: '$2 – $4' },
  { value: 'b3', label: '$4 – $8' },
  { value: 'b4', label: '≥ $8' },
];

const SORTS = [
  { value: 'price', label: '单价升序' },
  { value: 'available', label: '空闲 GPU 降序' },
  { value: 'rate', label: '分配率升序' },
  { value: 'vram', label: '单卡显存降序' },
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
      header: '机型',
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <b>{p.display_name}</b>
          {!p.available_in_region && <Badge tone="muted">该区域未提供</Badge>}
          {p.supply && (p.supply.availableGpu ?? 0) === 0 && p.available_in_region && (
            <Badge tone="danger">无空闲</Badge>
          )}
        </div>
      ),
    },
    { key: 'gpu', header: 'GPU 型号', render: (p) => p.gpu_model },
    { key: 'vram', header: '单卡显存', numeric: true, render: (p) => `${p.vram_gb} GB` },
    { key: 'inter', header: '互连', render: (p) => p.interconnect },
    {
      key: 'nodes',
      header: '节点数',
      numeric: true,
      render: (p) => formatNumber(p.supply?.nodeCount ?? 0),
    },
    {
      key: 'total',
      header: '总 GPU',
      numeric: true,
      render: (p) => formatNumber(p.supply?.totalGpu ?? 0),
    },
    {
      key: 'avail',
      header: '可用 GPU',
      numeric: true,
      render: (p) => (
        <b style={{ color: (p.supply?.availableGpu ?? 0) > 0 ? undefined : 'var(--rs-danger)' }}>
          {formatNumber(p.supply?.availableGpu ?? 0)}
        </b>
      ),
    },
    {
      key: 'rate',
      header: '分配率',
      render: (p) => (
        <div style={{ minWidth: 96 }}>
          <Progress value={p.supply?.allocatedGpu ?? 0} max={p.supply?.totalGpu ?? 0} />
        </div>
      ),
    },
    {
      key: 'price',
      header: '单价',
      numeric: true,
      render: (p) => `${formatUsd(p.unit_price)}/GPU·时`,
    },
    {
      key: 'act',
      header: '',
      width: 92,
      render: (p) => (
        <Button size="sm" variant="ghost" onClick={() => setOpen(p)}>
          查看
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="节点池"
        desc={`平台供给侧物理节点池（非用户资源）。当前按 ${REGION_META[region].label} 区域聚合，切换区域后容量与单价必须由接口重算。`}
        actions={<RegionSelect value={region} onChange={setRegion} />}
      />

      <Toolbar>
        <Segmented
          options={[
            { value: 'card', label: '卡片' },
            { value: 'list', label: '列表' },
          ]}
          value={view}
          onChange={setView}
          ariaLabel="视图"
        />
        <Select value={band} onChange={(e) => setBand(e.target.value)} aria-label="单价区间">
          {PRICE_BANDS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </Select>
        <Select value={gpuModel} onChange={(e) => setGpuModel(e.target.value)} aria-label="GPU 型号">
          <option value="all">全部 GPU 型号</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="排序">
          {SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <label className={s.row} style={{ gap: 6, fontSize: 12 }}>
          <input type="checkbox" checked={onlyIdle} onChange={(e) => setOnlyIdle(e.target.checked)} />
          仅显示有空闲
        </label>
        <span className={s.spacer} />
        <span className={s.muted} style={{ fontSize: 12 }}>
          <SlidersHorizontal size={13} /> 共 {list.length} 个机型 · {REGION_META[region].iso}
        </span>
      </Toolbar>

      {isLoading ? (
        <div className={s.muted}>加载中…</div>
      ) : view === 'card' ? (
        list.length === 0 ? (
          <EmptyState
            icon="📭"
            title="该筛选条件下没有节点池"
            hint="调整单价区间或取消「仅显示有空闲」，也可切换到其它区域"
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
                      <Badge tone="muted">该区域未提供</Badge>
                    ) : avail === 0 ? (
                      <Badge tone="danger">无空闲</Badge>
                    ) : (
                      <Badge tone="success">有空闲</Badge>
                    )}
                  </div>
                  <div className={s.muted} style={{ fontSize: 12, marginTop: 2 }}>
                    {p.gpu_model} · {p.vram_gb} GB · {p.interconnect}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Progress
                      value={p.supply?.allocatedGpu ?? 0}
                      max={total}
                      right={`${formatNumber(avail)} / ${formatNumber(total)} 卡空闲`}
                    />
                  </div>
                  <div
                    className={s.row}
                    style={{ justifyContent: 'space-between', marginTop: 8, fontSize: 13 }}
                  >
                    <b>{formatUsd(p.unit_price)}/GPU·时</b>
                    <span className={s.muted} style={{ fontSize: 11 }}>
                      市场 {formatUsd(p.market_range[0])}–{formatUsd(p.market_range[1])}
                    </span>
                  </div>
                  {missing && (
                    <div className={s.muted} style={{ fontSize: 11, marginTop: 6 }}>
                      可用区域：
                      {p.available_regions.map((r) => REGION_META[r].iso).join(' / ')}
                    </div>
                  )}
                  {!missing && (
                    <div className={s.muted} style={{ fontSize: 11, marginTop: 6 }}>
                      {p.supply?.nodeCount ?? 0} 节点 · {p.gpus_per_node} 卡/节点 · 整机{' '}
                      {formatUsd(p.machine_unit_price)}/台·时
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
              title="该筛选条件下没有节点池"
              hint="调整筛选条件或切换区域"
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
              {open.available_in_region ? `${REGION_META[region].iso} 可提供` : '该区域未提供'}
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
            查看完整详情
          </Button>
        }
      >
        {open && (
          <div className={s.col} style={{ gap: 12 }}>
            <DrawerTabs<DrawerTab>
              items={[
                { key: 'overview', label: '概览' },
                { key: 'supply', label: '供给' },
                { key: 'pricing', label: '定价' },
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === 'overview' && (
              <>
                <KeyValue
                  items={[
                    { label: '机型编码', value: open.code, mono: true },
                    { label: 'GPU 型号', value: open.gpu_model },
                    { label: '单卡显存', value: `${open.vram_gb} GB` },
                    { label: '单节点卡数', value: `${open.gpus_per_node} 卡` },
                    { label: '互连', value: open.interconnect },
                    { label: 'CPU', value: open.platform.cpu },
                    { label: '本地 NVMe', value: open.platform.localNvme },
                    { label: '网络', value: open.platform.network },
                  ]}
                />
                <div className={s.muted} style={{ fontSize: 12 }}>
                  可用区域：{open.available_regions.map((r) => REGION_META[r].label).join(' / ')}
                </div>
              </>
            )}
            {tab === 'supply' && (
              <>
                <KeyValue
                  items={[
                    { label: '节点数', value: formatNumber(open.supply?.nodeCount ?? 0) },
                    { label: '总 GPU', value: formatNumber(open.supply?.totalGpu ?? 0) },
                    { label: '可用 GPU', value: formatNumber(open.supply?.availableGpu ?? 0) },
                    { label: '已分配 GPU', value: formatNumber(open.supply?.allocatedGpu ?? 0) },
                    {
                      label: '分配率',
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
                  label="容量水位"
                  value={open.supply?.allocatedGpu ?? 0}
                  max={open.supply?.totalGpu ?? 0}
                  right={`空闲 ${formatNumber(open.supply?.availableGpu ?? 0)} 卡`}
                />
                {!open.available_in_region && (
                  <div className={`${s.notice} ${s.noticeWarn}`}>
                    <div>
                      该机型在 {REGION_META[region].label} 未提供，可切换至{' '}
                      {open.fallback_regions.map((r) => REGION_META[r].label).join(' / ')}。
                    </div>
                  </div>
                )}
              </>
            )}
            {tab === 'pricing' && (
              <>
                <KeyValue
                  items={[
                    { label: 'GPU·小时', value: `${formatUsd(open.unit_price)} / GPU·时` },
                    { label: '裸金属台·小时', value: `${formatUsd(open.machine_unit_price)} / 台·时` },
                    {
                      label: '市场区间',
                      value: `${formatUsd(open.market_range[0])} – ${formatUsd(open.market_range[1])}`,
                    },
                    {
                      label: '单节点整机价',
                      value: `${formatUsd(
                        Math.round(open.machine_unit_price * 100) / 100,
                      )} / 台·时（${open.gpus_per_node} 卡）`,
                    },
                  ]}
                />
                <div className={s.muted} style={{ fontSize: 12 }}>
                  价格取自 billing_rates × 区域系数；与部署向导右侧费用明细同源，禁止页面自行硬编码。
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
