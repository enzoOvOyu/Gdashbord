// 总览 Overview（PRD §4.1）：核心指标卡 / 资源分布 / 节点健康概览 / 近期活动 / 快捷入口
import { t } from '../../i18n';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, StatTile, Button, Badge } from '../../components/ui';
import { LifecycleBadge } from '../../components/state-machine';
import { NODE_STATE_META } from '../../components/state-machine';
import { EP, api } from '../../lib/api-client';
import { useRegionStore } from '../../stores/auth';
import { formatUsd, formatPercent } from '../../lib/money';
import { KIND_META, KIND_LIST, REGION_META } from '../../lib/ids';
import { ui as s } from '../../components/ui';
import type { ResourceKind } from '../../types/domain';

interface ResourceRow {
  resource_uuid: string;
  display_id: string;
  kind: ResourceKind;
  name: string;
  region: string;
  status: string;
  gpu_count: number;
  cost_per_hour: number;
}

const NODE_COLORS: Record<string, string> = {
  ready: 'var(--rs-success)',
  cordoned: 'var(--rs-warning)',
  draining: 'var(--rs-info)',
  remediation: 'var(--rs-purple)',
  notready: 'var(--rs-danger)',
};

export default function OverviewPage() {
  const region = useRegionStore((st) => st.region);

  const { data: resources = [] } = useQuery<ResourceRow[]>({
    queryKey: ['resources', region],
    queryFn: () => api.get<ResourceRow[]>(`${EP.resources}?region=${region}&size=100`),
  });
  const { data: dist } = useQuery<Record<string, number>>({
    queryKey: ['cluster-dist', region],
    queryFn: () => api.get<Record<string, number>>(`${EP.clusterDist}?region=${region}`),
  });
  const { data: eff } = useQuery<Record<string, { current: number | null }>>({
    queryKey: ['cluster-eff', region],
    queryFn: () => api.get(`${EP.clusterEfficiency}?region=${region}`),
  });
  const { data: status } = useQuery<{ credit_balance: number; cost_mtd: number; running_total: number }>({
    queryKey: ['status-bar', region],
    queryFn: () => api.get(`${EP.statusBar}?region=${region}`),
  });

  const running = resources.filter((r) => r.status === 'running');
  const activeGpu = running.reduce((a, r) => a + r.gpu_count, 0);
  const goodput = eff?.goodput?.current ?? null;

  const pieData = Object.entries(dist ?? {}).map(([k, v]) => ({
    name: NODE_STATE_META[k as keyof typeof NODE_STATE_META]?.label ?? k,
    key: k,
    value: v,
  }));

  const byKind = KIND_LIST.map((k) => ({
    kind: k,
    total: resources.filter((r) => r.kind === k).length,
    running: running.filter((r) => r.kind === k).length,
  }));

  return (
    <div>
      <h1 className="rs-title" style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px' }}>
        {t('nav.overview')}
      </h1>
      <p style={{ color: 'var(--rs-text-secondary)', margin: '0 0 24px' }}>
        {t('ov.scopeLine', { v0: REGION_META[region].label })}
      </p>

      {/* 核心指标卡 */}
      <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <StatTile label={t('ov.activeGpus')} value={activeGpu} hint={t('ov.runningResources', { v0: running.length })} color="var(--rs-brand)" />
        <StatTile
          label={t('ov.runningResourcesTile')}
          value={running.length}
          hint={byKind.map((b) => `${KIND_META[b.kind].label} ${b.running}`).join(' · ')}
        />
        <StatTile label={t('ov.spend24h')} value={formatUsd(status?.cost_mtd ?? 0)} hint={t('ov.mtd')} />
        <StatTile
          label={t('ov.goodput')}
          value={goodput === null ? '–' : formatPercent(goodput)}
          hint={t('ov.goodputHealthy')}
          color={goodput && goodput < 0.85 ? 'var(--rs-warning)' : 'var(--rs-success)'}
        />
      </div>

      <div className={s.grid} style={{ gridTemplateColumns: '1fr 1fr', marginTop: 24 }}>
        {/* 节点健康概览（5 态环形图，DESIGN §7） */}
        <Card title={t('ov.nodeHealth')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2}>
                  {pieData.map((d) => (
                    <Cell key={d.key} fill={NODE_COLORS[d.key]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--rs-bg)',
                    border: '1px solid var(--rs-border)',
                    borderRadius: 'var(--rs-r-md)',
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pieData.map((d) => (
                <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: '50%', background: NODE_COLORS[d.key],
                    }}
                  />
                  <span style={{ color: 'var(--rs-text-secondary)' }}>
                    {NODE_STATE_META[d.key as keyof typeof NODE_STATE_META]?.icon}{' '}
                    {d.name}
                  </span>
                  <strong style={{ marginLeft: 'auto' }}>{d.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* 资源分布（按类型） */}
        <Card title={t('ov.resourceDist')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {byKind.map((b) => (
              <Link
                key={b.kind}
                to={`/resources/${KIND_META[b.kind].routeKey}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Badge color={KIND_META[b.kind].colorVar} icon={<span>{KIND_META[b.kind].icon}</span>}>
                    {KIND_META[b.kind].label}
                  </Badge>
                  <strong style={{ marginLeft: 'auto' }}>{b.total}</strong>
                </div>
                <div
                  style={{
                    height: 6,
                    background: 'var(--rs-surface-2)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${b.total ? (b.running / b.total) * 100 : 0}%`,
                      height: '100%',
                      background: KIND_META[b.kind].colorVar,
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, color: 'var(--rs-text-muted)', marginTop: 2 }}>
                  {t('inf.runningOf', { v0: b.running, v1: b.total })}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* 近期活动 + 快捷入口 */}
      <div className={s.grid} style={{ gridTemplateColumns: '1.4fr 1fr', marginTop: 24 }}>
        <Card title={t('ov.recentActivity')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {resources.slice(0, 6).map((r) => (
              <Link
                key={r.resource_uuid}
                to={`/resources/${KIND_META[r.kind].routeKey}/${r.resource_uuid}`}
                style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}
              >
                <span>{KIND_META[r.kind].icon}</span>
                <span className={s.mono} style={{ fontSize: 13 }}>{r.display_id}</span>
                <span style={{ color: 'var(--rs-text-secondary)' }}>{r.name}</span>
                <span style={{ marginLeft: 'auto' }}><LifecycleBadge status={r.status} showZh={false} /></span>
              </Link>
            ))}
            {resources.length === 0 && <span className={s.muted}>{t('ov.noResources')}</span>}
          </div>
        </Card>

        <Card title={t('ov.quickLinks')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {KIND_LIST.map((k) => (
              <Button
                key={k}
                variant="secondary"
                icon={<span>{KIND_META[k].icon}</span>}
                onClick={() => {
                  window.location.href =
                    k === 'gpu_vm' ? '/deployment/server' : `/deployment/${KIND_META[k].routeKey}`;
                }}
              >
                {t('deploy.createKind', { v0: KIND_META[k].label })}
              </Button>
            ))}
            <Link to="/workbench/images">
              <Button variant="primary" style={{ width: '100%' }}>{t('ov.browseImages')}</Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
