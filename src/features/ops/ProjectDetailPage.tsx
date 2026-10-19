// 运营&运维·项目详情（v0.7 · PRD §3.5.1：竞品风格六 Tab 整页详情）
// 六个 Tab：概览 / 资源 / 成员 / 配额 / 成本 / 设置。
// 区域选择器在本页为禁用 + tooltip（项目非区域维度，不做假控件，PRD §4.4.1）。
import { t } from '../../i18n';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import {
  Badge, Button, Card, PageHeader, Progress, RegionSelect, StatTile, Table, Tabs,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { EP, api, withQuery } from '../../lib/api-client';
import { ui as s } from '../../components/ui';
import { KIND_META, REGION_META } from '../../lib/ids';
import { formatUsd } from '../../lib/money';
import { formatRelative } from '../../lib/date';
import type {
  CostSlice,
  InternalId,
  ProjectSummary,
  Quota,
  Resource,
  ScalingPolicyRow,
} from '../../types/domain';

type TabKey = 'overview' | 'resources' | 'members' | 'quotas' | 'cost' | 'settings';

interface MemberRow {
  id: InternalId;
  display_name: string;
  email: string;
  role: string;
  status: string;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id) as InternalId;
  const [tab, setTab] = useState<TabKey>('overview');

  const { data: summary } = useQuery<ProjectSummary>({
    queryKey: ['project-summary', projectId],
    queryFn: () => api.get<ProjectSummary>(EP.projectSummary(projectId)),
    enabled: Number.isFinite(projectId),
  });

  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: ['project-resources', projectId],
    queryFn: () =>
      api.get<Resource[]>(withQuery(EP.resources, { project_id: projectId })),
    enabled: Number.isFinite(projectId) && tab === 'resources',
  });

  const { data: members = [] } = useQuery<MemberRow[]>({
    queryKey: ['project-members', projectId],
    queryFn: () => api.get<MemberRow[]>(`/api/projects/${projectId}/members`),
    enabled: Number.isFinite(projectId) && tab === 'members',
  });

  const { data: quotas = [] } = useQuery<Quota[]>({
    queryKey: ['project-quotas', projectId],
    queryFn: () => api.get<Quota[]>(EP.quotas),
    enabled: tab === 'quotas',
  });

  const { data: cost } = useQuery<{ slices: CostSlice[]; total: number; billing_period: string }>({
    queryKey: ['project-cost', projectId],
    queryFn: () =>
      api.get<{ slices: CostSlice[]; total: number; billing_period: string }>(
        withQuery(EP.cost, { project_id: projectId, dimension: 'kind' }),
      ),
    enabled: Number.isFinite(projectId) && tab === 'cost',
  });

  const { data: policies = [] } = useQuery<ScalingPolicyRow[]>({
    queryKey: ['project-scaling', projectId],
    queryFn: () => api.get<ScalingPolicyRow[]>(EP.scalingPolicies),
    enabled: tab === 'overview',
  });

  if (!summary) {
    return (
      <Card title={t('pr.title')}>
        <p className={s.muted}>{t('common.loading')}</p>
      </Card>
    );
  }

  const resourceColumns: Array<Column<Resource>> = [
    {
      key: 'id',
      header: t('common.displayId'),
      mono: true,
      render: (r) => (
        <Link to={`/resources/${KIND_META[r.kind].routeKey}/${r.resource_uuid}`}>
          <span className={s.mono}>{String(r.display_id)}</span>
        </Link>
      ),
    },
    { key: 'name', header: t('common.name'), render: (r) => r.name },
    {
      key: 'kind',
      header: t('common.type'),
      render: (r) => <Badge tone="muted">{KIND_META[r.kind].label}</Badge>,
    },
    {
      key: 'region',
      header: t('common.region'),
      render: (r) => REGION_META[r.region]?.label ?? r.region,
    },
    { key: 'gpu', header: t('common.gpuCount'), numeric: true, render: (r) => r.gpu_count },
    { key: 'status', header: t('common.status'), render: (r) => <Badge tone="muted">{r.status}</Badge> },
  ];

  const memberColumns: Array<Column<MemberRow>> = [
    { key: 'name', header: t('common.name'), render: (m) => m.display_name },
    { key: 'email', header: t('common.email'), render: (m) => <span className={s.mono}>{m.email}</span> },
    { key: 'role', header: t('common.role'), render: (m) => <Badge tone="muted">{m.role}</Badge> },
    { key: 'status', header: t('common.status'), render: (m) => <Badge tone="muted">{m.status}</Badge> },
  ];

  const quotaColumns: Array<Column<Quota>> = [
    {
      key: 'region',
      header: t('common.region'),
      render: (q) => (q.region ? (REGION_META[q.region]?.label ?? q.region) : t('rs.allRegions')),
    },
    { key: 'metric', header: t('common.metric'), render: (q) => <code>{q.metric}</code> },
    { key: 'used', header: t('common.used'), numeric: true, render: (q) => q.used_value },
    { key: 'limit', header: t('common.limit'), numeric: true, render: (q) => q.limit_value },
    {
      key: 'pct',
      header: t('common.usage'),
      render: (q) => (
        <Progress
          value={q.used_value}
          max={q.limit_value}
          right={`${Math.round((q.used_value / Math.max(1, q.limit_value)) * 100)}%`}
        />
      ),
    },
  ];

  const projectPolicies = policies.filter((p) =>
    resources.some((r) => r.id === p.resource_id),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s5)' }}>
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {summary.name}
            {summary.is_default && <Badge tone="info">{t('pr.default')}</Badge>}
          </span>
        }
        desc={`${t('pr.fieldRegion')}: ${REGION_META[summary.default_region]?.label ?? summary.default_region} · ${t('common.createdAt')} ${formatRelative(summary.created_at)}`}
        icon={<FolderKanban size={18} />}
        actions={
          <RegionSelect
            value="jp"
            onChange={() => undefined}
            disabledReason={t('pr.regionDisabledHint')}
          />
        }
      />

      <Tabs<TabKey>
        items={[
          { key: 'overview', label: t('pr.detailTabOverview') },
          { key: 'resources', label: t('pr.detailTabResources') },
          { key: 'members', label: t('pr.detailTabMembers') },
          { key: 'quotas', label: t('pr.detailTabQuotas') },
          { key: 'cost', label: t('pr.detailTabCost') },
          { key: 'settings', label: t('pr.detailTabSettings') },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <>
          <div className={s.cardGrid}>
            <StatTile label={t('pr.cardGpu')} value={`${summary.gpu_running} / ${summary.gpu_total}`} />
            <StatTile
              label={t('pr.cardResources')}
              value={String(Object.values(summary.kind_counts).reduce((a, b) => a + b, 0))}
            />
            <StatTile label={t('pr.cardCost')} value={formatUsd(summary.cost_mtd)} />
            <StatTile label={t('pr.cardQuota')} value={`${summary.quota_usage_pct}%`} />
          </div>
          <Card title={t('pr.recentResources')}>
            <p className={s.muted} style={{ marginTop: 0 }}>
              {t('pr.overviewHint')}
            </p>
            <Table<Resource>
              columns={resourceColumns}
              rows={summary.recent_resources as unknown as Resource[]}
              rowKey={(r) => String(r.resource_uuid)}
              zebra
              empty={<p className={s.muted}>{t('pr.noResource')}</p>}
            />
          </Card>
          {projectPolicies.length > 0 && (
            <Card title={t('sc.title')}>
              <p className={s.muted} style={{ marginTop: 0 }}>
                {t('sc.desc')}
              </p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {projectPolicies.map((p) => (
                  <li key={p.id} className={s.secondary}>
                    {String(p.display_id)} · {p.strategy_model} · {p.trigger_metric} · {p.min_size}~
                    {p.max_size}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {tab === 'resources' && (
        <Card title={t('pr.detailTabResources')}>
          <Table<Resource>
            columns={resourceColumns}
            rows={resources}
            rowKey={(r) => String(r.resource_uuid)}
            zebra
            empty={<p className={s.muted}>{t('pr.noResource')}</p>}
          />
        </Card>
      )}

      {tab === 'members' && (
        <Card title={t('pr.detailTabMembers')}>
          <Table<MemberRow>
            columns={memberColumns}
            rows={members}
            rowKey={(m) => String(m.id)}
            zebra
            empty={<p className={s.muted}>{t('pr.noResource')}</p>}
          />
        </Card>
      )}

      {tab === 'quotas' && (
        <Card title={t('pr.detailTabQuotas')}>
          <Table<Quota>
            columns={quotaColumns}
            rows={quotas.filter((q) => q.metric === 'gpu')}
            rowKey={(q) => `${q.region ?? 'all'}-${q.metric}`}
            zebra
            empty={<p className={s.muted}>{t('pr.noResource')}</p>}
          />
        </Card>
      )}

      {tab === 'cost' && (
        <Card title={t('pr.detailTabCost')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <span className={s.muted}>{t('pr.cardCost')}</span>{' '}
              <strong style={{ fontSize: 20 }}>{formatUsd(summary.cost_mtd)}</strong>
              <br />
              <span className={s.muted}>
                {t('cost.prevPeriod')}: {formatUsd(summary.cost_prev_mtd)}
              </span>
            </div>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{t('common.type')}</th>
                    <th>{t('cost.amount')}</th>
                    <th>{t('cost.share')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(cost?.slices ?? []).map((sl) => (
                    <tr key={sl.key}>
                      <td>{sl.label}</td>
                      <td className={s.num}>{formatUsd(sl.amount)}</td>
                      <td className={s.num}>
                        {cost && cost.total > 0
                          ? `${Math.round((sl.amount / cost.total) * 1000) / 10}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {tab === 'settings' && (
        <Card title={t('pr.detailTabSettings')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <span className={s.muted}>{t('common.name')}: </span>
              <strong>{summary.name}</strong>
            </div>
            <div>
              <span className={s.muted}>slug: </span>
              <span className={s.mono}>{summary.slug}</span>
            </div>
            <div>
              <span className={s.muted}>{t('pr.fieldRegion')}: </span>
              {REGION_META[summary.default_region]?.label ?? summary.default_region}
            </div>
            <div>
              <span className={s.muted}>{t('pr.default')}: </span>
              {summary.is_default ? t('common.yes') : t('common.no')}
            </div>
            <div style={{ marginTop: 8 }}>
              <Link to="/ops/projects">
                <Button variant="ghost">{t('common.backToList')}</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
