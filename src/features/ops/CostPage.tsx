// 运营&运维 · 成本分析（§4.4.1 C 档：分组行内展开下钻）
// 每个金额都能由 billing_usage 的 quantity × unit_price 复算，禁止另设「展示用金额」。
import { t } from '../../i18n';
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
  { value: 'project', get label() { return t('cost.byProject'); } },
  { value: 'resource', get label() { return t('cost.byResource'); } },
  { value: 'region', get label() { return t('cost.byRegion'); } },
  { value: 'kind', get label() { return t('cost.byType'); } },
];

const UNIT_LABEL: Record<string, string> = {
  get per_gpu_hour() { return t('unit.gpuHour'); },
  get per_gb_hour() { return t('unit.gbHour'); },
  get per_machine_hour() { return t('unit.machineHour'); },
  get per_cluster_hour() { return t('unit.clusterHour'); },
  get per_instance_hour() { return t('unit.instanceHour'); },
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
    { key: 'hour', header: t('cost.billedHours'), mono: true, render: (r) => formatDateTime(r.usage_hour) },
    { key: 'res', header: t('common.resource'), render: (r) => r.resource_name },
    { key: 'proj', header: t('common.project'), render: (r) => r.project_name },
    { key: 'unit', header: t('cost.billingUnit'), render: (r) => UNIT_LABEL[r.unit] ?? r.unit },
    { key: 'q', header: t('cost.usage'), numeric: true, render: (r) => formatNumber(r.quantity, 2) },
    { key: 'price', header: t('common.unitPrice'), numeric: true, render: (r) => formatUsd(r.unit_price) },
    { key: 'amt', header: t('cost.amount'), numeric: true, render: (r) => formatUsd(r.amount) },
  ];

  const budget = bar?.budget ?? 0;
  const mtd = cost?.mtd ?? 0;
  const overBudget = budget > 0 && mtd > budget;

  return (
    <div>
      <PageHeader
        title={t('nav.cost')}
        desc={t('cost.regionHint', { v0: REGION_META[region].label })}
        actions={<RegionSelect value={region} onChange={setRegion} />}
      />

      <Toolbar>
        <Segmented
          options={DIMENSIONS}
          value={dimension}
          onChange={setDimension}
          ariaLabel={t('cost.drilldown')}
        />
        <Select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label={t('cost.projectFilter')}
        >
          <option value="all">{t('common.allProjects')}</option>
          {(projects as Array<{ id: number; name: string }>).map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </Select>
        <span className={s.spacer} />
        {cost && <span className={s.muted} style={{ fontSize: 12 }}>{t('cost.period', { v0: cost.billing_period })}</span>}
      </Toolbar>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Card title={t('cost.mtd')}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{formatUsd(mtd)}</div>
          <div className={s.muted} style={{ fontSize: 12 }}>{t('cost.mtdHint')}</div>
          {budget > 0 && (
            <div style={{ marginTop: 8 }}>
              <Progress
                label={t('cost.budget')}
                value={mtd}
                max={budget}
                right={`${formatUsd(mtd)} / ${formatUsd(budget)}`}
              />
              {overBudget && (
                <div style={{ marginTop: 4 }}>
                  <Badge tone="danger">{t('cost.overBudget', { v0: formatUsd(mtd - budget) })}</Badge>
                </div>
              )}
            </div>
          )}
        </Card>
        <Card title={t('cost.today')}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{formatUsd(cost?.today ?? 0)}</div>
          <div className={s.muted} style={{ fontSize: 12 }}>{t('cost.todayHint')}</div>
        </Card>
        <Card title={t('cost.trend48')}>
          {cost ? (
            <TrendLine points={cost.trend} width={520} height={96} />
          ) : (
            <div className={s.muted}>{t('common.loading')}</div>
          )}
          <div className={s.muted} style={{ fontSize: 11 }}>
            {t('cost.trendHint')}
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className={s.muted}>{t('common.loading')}</div>
      ) : (cost?.slices ?? []).length === 0 ? (
        <EmptyState
          icon="💸"
          title={t('cost.noUsage')}
          hint={t('cost.noUsageHint')}
        />
      ) : (
        <Card title={t('cost.drilldownHint', { v0: DIMENSIONS.find((d) => d.value === dimension)?.label })}>
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
                      {t('cost.gpuHours', { v0: formatNumber(sl.gpu_hours, 1) })}
                    </span>
                    <span style={{ textAlign: 'right', color: 'var(--rs-text-muted)' }}>
                      {t('cost.resourceCount', { v0: sl.resources.length })}
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 12px 12px', background: 'var(--rs-surface)' }}>
                      {slice.isLoading ? (
                        <div className={s.muted} style={{ fontSize: 12 }}>
                          {t('cost.loadingUsage')}
                        </div>
                      ) : (
                        <>
                          <div className={s.muted} style={{ fontSize: 12, marginBottom: 6 }}>
                            {t('cost.usageSummary', { v0: slice.data?.count ?? 0, v1: ' ', v2: formatUsd(slice.data?.total ?? 0) })}
                          </div>
                          <Table
                            columns={usageColumns}
                            rows={slice.data?.rows ?? []}
                            rowKey={(r) => String(r.id)}
                          />
                          {sl.resources.length > 0 && (
                            <div className={s.muted} style={{ fontSize: 12, marginTop: 8 }}>
                              {t('cost.topResources')}{sl.resources
                                .slice(0, 5)
                                .map((r) => t('common.idParenPair', { v0: r.name, v1: formatUsd(r.amount) }))
                                .join(t('common.listSep'))}
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
