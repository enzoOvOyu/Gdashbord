// 运营&运维 · 成本分析（§4.4.1 C 档：分组行内展开下钻）
// 每个金额都能由 billing_usage 的 quantity × unit_price 复算，禁止另设「展示用金额」。
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  ui as s,
  Card,
  Table,
  Progress,
  Badge,
  EmptyState,
  Segmented,
  Select,
  PageHeader,
  Toolbar,
  RegionSelect,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { formatNumber, formatUsd, formatPercent } from '../../lib/money';
import { formatDateTime } from '../../lib/date';
import { REGION_META } from '../../lib/ids';
import {
  usePageRegion,
  useCost,
  useProjects,
  useUsageSlice,
  useStatusBar,
  type UsageSliceRow,
} from '../shared/api';
import { TrendLine } from './shared';

const DIMENSIONS = [
  { value: 'project', label: '按项目' },
  { value: 'resource', label: '按资源' },
  { value: 'region', label: '按区域' },
  { value: 'kind', label: '按类型' },
];

const UNIT_LABEL: Record<string, string> = {
  per_gpu_hour: 'GPU·时',
  per_gb_hour: 'GB·时',
  per_machine_hour: '台·时',
  per_cluster_hour: '集群·时',
  per_instance_hour: '实例·时',
};

export default function CostPage() {
  const [region, setRegion] = usePageRegion();
  const [dimension, setDimension] = useState('project');
  const [projectId, setProjectId] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: cost, isLoading } = useCost({
    region,
    projectId: projectId === 'all' ? 'all' : Number(projectId),
    dimension,
  });
  const { data: projects = [] } = useProjects();
  const { data: bar } = useStatusBar(region);
  const slice = useUsageSlice({
    region,
    projectId: projectId === 'all' ? 'all' : Number(projectId),
    dimension,
    slice: expanded,
  });

  const usageColumns: Array<Column<UsageSliceRow>> = [
    { key: 'hour', header: '计费小时', mono: true, render: (r) => formatDateTime(r.usage_hour) },
    { key: 'res', header: '资源', render: (r) => r.resource_name },
    { key: 'proj', header: '项目', render: (r) => r.project_name },
    { key: 'unit', header: '计费单位', render: (r) => UNIT_LABEL[r.unit] ?? r.unit },
    { key: 'q', header: '用量', numeric: true, render: (r) => formatNumber(r.quantity, 2) },
    { key: 'price', header: '单价', numeric: true, render: (r) => formatUsd(r.unit_price) },
    { key: 'amt', header: '金额', numeric: true, render: (r) => formatUsd(r.amount) },
  ];

  const budget = bar?.budget ?? 0;
  const mtd = cost?.mtd ?? 0;
  const overBudget = budget > 0 && mtd > budget;

  return (
    <div>
      <PageHeader
        title="成本分析"
        desc={`当前 ${REGION_META[region].label} 区域口径；切换区域后按 billing_usage 重新聚合。所有金额 = Σ(quantity × unit_price)。`}
        actions={<RegionSelect value={region} onChange={setRegion} />}
      />

      <Toolbar>
        <Segmented
          options={DIMENSIONS}
          value={dimension}
          onChange={setDimension}
          ariaLabel="下钻维度"
        />
        <Select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label="项目筛选"
        >
          <option value="all">全部项目</option>
          {(projects as Array<{ id: number; name: string }>).map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </Select>
        <span className={s.spacer} />
        {cost && <span className={s.muted} style={{ fontSize: 12 }}>账期 {cost.billing_period}</span>}
      </Toolbar>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Card title="本月花费">
          <div style={{ fontSize: 24, fontWeight: 700 }}>{formatUsd(mtd)}</div>
          <div className={s.muted} style={{ fontSize: 12 }}>账期内累计（按当前区域口径）</div>
          {budget > 0 && (
            <div style={{ marginTop: 8 }}>
              <Progress
                label="预算"
                value={mtd}
                max={budget}
                right={`${formatUsd(mtd)} / ${formatUsd(budget)}`}
              />
              {overBudget && (
                <div style={{ marginTop: 4 }}>
                  <Badge tone="danger">已超预算 {formatUsd(mtd - budget)}</Badge>
                </div>
              )}
            </div>
          )}
        </Card>
        <Card title="今日花费">
          <div style={{ fontSize: 24, fontWeight: 700 }}>{formatUsd(cost?.today ?? 0)}</div>
          <div className={s.muted} style={{ fontSize: 12 }}>自然日 00:00 起累计</div>
        </Card>
        <Card title="趋势（近 48 小时）">
          {cost ? (
            <TrendLine points={cost.trend} width={520} height={96} />
          ) : (
            <div className={s.muted}>加载中…</div>
          )}
          <div className={s.muted} style={{ fontSize: 11 }}>
            形态含启停/扩容/折扣，非完美线性（G7）
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className={s.muted}>加载中…</div>
      ) : (cost?.slices ?? []).length === 0 ? (
        <EmptyState
          icon="💸"
          title="该区域/项目下暂无用量"
          hint="切换到已有资源的区域或取消项目筛选"
        />
      ) : (
        <Card title={`${DIMENSIONS.find((d) => d.value === dimension)?.label}下钻（点击行展开逐小时用量）`}>
          <div style={{ border: '1px solid var(--rs-border)', borderRadius: 8 }}>
            {(cost?.slices ?? []).map((sl) => {
              const isOpen = expanded === sl.key;
              return (
                <div key={sl.key} style={{ borderBottom: '1px solid var(--rs-border)' }}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : sl.key)}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: '28px minmax(160px,1.4fr) 1fr 120px 96px 96px 80px',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      background: 'var(--rs-bg)',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 13,
                    }}
                  >
                    <span>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                    <b>{sl.label}</b>
                    <span>
                      <Progress value={sl.share * 100} max={100} />
                    </span>
                    <b style={{ textAlign: 'right' }}>{formatUsd(sl.amount)}</b>
                    <span style={{ textAlign: 'right', color: 'var(--rs-text-muted)' }}>
                      {formatPercent(sl.share * 100, 1)}
                    </span>
                    <span style={{ textAlign: 'right', color: 'var(--rs-text-muted)' }}>
                      {formatNumber(sl.gpu_hours, 1)} GPU·时
                    </span>
                    <span style={{ textAlign: 'right', color: 'var(--rs-text-muted)' }}>
                      {sl.resources.length} 资源
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 12px 12px', background: 'var(--rs-surface)' }}>
                      {slice.isLoading ? (
                        <div className={s.muted} style={{ fontSize: 12 }}>
                          加载用量明细…
                        </div>
                      ) : (
                        <>
                          <div className={s.muted} style={{ fontSize: 12, marginBottom: 6 }}>
                            共 {slice.data?.count ?? 0} 条用量行 · 合计{' '}
                            {formatUsd(slice.data?.total ?? 0)}（由 quantity × unit_price 逐行累加）
                          </div>
                          <Table
                            columns={usageColumns}
                            rows={slice.data?.rows ?? []}
                            rowKey={(r) => String(r.id)}
                          />
                          {sl.resources.length > 0 && (
                            <div className={s.muted} style={{ fontSize: 12, marginTop: 8 }}>
                              Top 资源：
                              {sl.resources
                                .slice(0, 5)
                                .map((r) => `${r.name}（${formatUsd(r.amount)}）`)
                                .join('、')}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
