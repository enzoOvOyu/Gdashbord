// 运营&运维 · 节点（§4.4.1 A 档：行 → Drawer → 整页 /ops/nodes/:nodeUid）
// 每个非 Ready 节点都能展开看到对应 Xid 事件（G7 不完美即真实 + 事件必须有证据）。
import { t, dt } from '../../i18n';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, AlertTriangle } from 'lucide-react';
import {
  ui as s,
  Card,
  Table,
  Badge,
  Button,
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
import { formatDateTime, formatRelative } from '../../lib/date';
import { REGION_META } from '../../lib/ids';
import {
  usePageRegion,
  useNode,
  useNodeStateDist,
  useNodes,
  type NodeView,
} from '../shared/api';
import { NODE_STATE_META, StateRing, MetricDiff } from './shared';

const STATE_FILTERS = [
  { value: 'all', get label() { return t('common.allStatus'); } },
  { value: 'ready', label: 'Ready' },
  { value: 'cordoned', label: 'Cordoned' },
  { value: 'draining', label: 'Draining' },
  { value: 'remediation', label: 'Remediation' },
  { value: 'notready', label: 'NotReady' },
];

type DrawerTab = 'overview' | 'events';

export default function NodesPage() {
  const navigate = useNavigate();
  const [region, setRegion] = usePageRegion();
  const [state, setState] = useState('all');
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [tab, setTab] = useState<DrawerTab>('overview');

  const { data: nodes = [], isLoading } = useNodes(region, state);
  const { data: dist } = useNodeStateDist(region);
  const { data: detail } = useNode(openUid ?? undefined);

  const columns: Array<Column<NodeView>> = [
    {
      key: 'uid',
      header: t('nav.nodes'),
      mono: true,
      render: (n) => n.node_uid,
    },
    {
      key: 'pool',
      header: t('common.machineType'),
      render: (n) => n.pool_display_name,
    },
    { key: 'rack', header: t('common.rack'), mono: true, render: (n) => n.rack_id ?? '—' },
    { key: 'sw', header: t('common.switchGroup'), mono: true, render: (n) => n.switch_group ?? '—' },
    {
      key: 'state',
      header: t('common.status'),
      render: (n) => (
        <span className={s.row} style={{ gap: 6 }}>
          <Badge tone={NODE_STATE_META[n.state]?.tone ?? 'neutral'}>
            {NODE_STATE_META[n.state]?.label.split('（')[0] ?? n.state}
          </Badge>
          {n.straggler && <Badge tone="warning">{t('nodes.slowNode')}</Badge>}
        </span>
      ),
    },
    {
      key: 'gpu',
      header: 'GPU',
      numeric: true,
      render: (n) => t('common.gpuCountValue', { v0: n.gpu_count }),
    },
    {
      key: 'hosted',
      header: t('pools.bearingResources'),
      numeric: true,
      render: (n) => n.hosted_resources,
    },
    {
      key: 'updated',
      header: t('common.updatedAt'),
      render: (n) => formatRelative(n.updated_at),
    },
    {
      key: 'act',
      header: '',
      width: 92,
      render: (n) => (
        <Button size="sm" variant="ghost" onClick={() => setOpenUid(n.node_uid)}>
          {t('common.view')}
        </Button>
      ),
    },
  ];

  const notReady = nodes.filter((n) => n.state !== 'ready');

  return (
    <div>
      <PageHeader
        title={t('nav.nodes')}
        desc={t('nodes.pageHint', { v0: REGION_META[region].label })}
        actions={<RegionSelect value={region} onChange={setRegion} />}
      />

      <Toolbar>
        <Select value={state} onChange={(e) => setState(e.target.value)} aria-label={t('nodes.statusDist')}>
          {STATE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <span className={s.spacer} />
        <span className={s.muted} style={{ fontSize: 12 }}>
          {t('nodes.countLabel', { v0: nodes.length })}{notReady.length > 0 ? t('nodes.notReadySuffix', { v0: notReady.length }) : ''}
        </span>
      </Toolbar>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <Card title={t('nodes.fiveStates')}>
          {dist ? <StateRing dist={dist} /> : <div className={s.muted}>{t('common.loading')}</div>}
        </Card>
        <Card title={t('nodes.nonReady')}>
          {notReady.length === 0 ? (
            <EmptyState icon="✅" title={t('nodes.allReady')} hint={t('nodes.allReadyHint')} />
          ) : (
            <div className={s.col} style={{ gap: 8 }}>
              {notReady.slice(0, 5).map((n) => (
                <button
                  key={n.node_uid}
                  type="button"
                  onClick={() => setOpenUid(n.node_uid)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: '1px solid var(--rs-border)',
                    borderRadius: 8,
                    padding: '6px 8px',
                    background: 'var(--rs-bg)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <AlertTriangle size={14} color="var(--rs-warning)" style={{ flex: 'none' }} />
                  <span style={{ fontFamily: 'var(--rs-font-mono)', fontSize: 12 }}>
                    {n.node_uid}
                  </span>
                  <Badge tone={NODE_STATE_META[n.state]?.tone ?? 'neutral'}>
                    {NODE_STATE_META[n.state]?.label.split('（')[0] ?? n.state}
                  </Badge>
                  <span className={s.spacer} />
                  <span className={s.muted} style={{ fontSize: 11 }}>
                    {t('nodes.expandXid')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {isLoading ? (
        <div className={s.muted}>{t('common.loading')}</div>
      ) : (
        <Table
          columns={columns}
          rows={nodes}
          rowKey={(n) => n.node_uid}
          zebra
          onRowClick={(n) => setOpenUid(n.node_uid)}
          empty={
            <EmptyState
              icon="🖥️"
              title={t('nodes.noMatch')}
              hint={t('nodes.noMatchHint')}
            />
          }
        />
      )}

      <Drawer
        open={Boolean(openUid)}
        onClose={() => setOpenUid(null)}
        title={detail?.node.node_uid ?? openUid ?? ''}
        subtitle={detail ? `${detail.node.pool_display_name} · ${detail.node.rack_id}` : ''}
        badge={
          detail ? (
            <Badge tone={NODE_STATE_META[detail.node.state]?.tone ?? 'neutral'}>
              {NODE_STATE_META[detail.node.state]?.label ?? detail.node.state}
            </Badge>
          ) : null
        }
        footer={
          <Button
            variant="secondary"
            icon={<ArrowUpRight size={14} />}
            onClick={() => {
              if (openUid) navigate(`/ops/nodes/${openUid}`);
            }}
          >
            {t('common.viewDetail')}
          </Button>
        }
      >
        {detail ? (
          <div className={s.col} style={{ gap: 12 }}>
            <DrawerTabs<DrawerTab>
              items={[
                { key: 'overview', label: t('detail.overview') },
                { key: 'events', label: t('nodes.eventsCount', { v0: detail.events.length }) },
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === 'overview' ? (
              <KeyValue
                items={[
                  { label: t('nodes.uid'), value: detail.node.node_uid, mono: true },
                  { label: t('common.machineType'), value: detail.node.pool_display_name },
                  { label: 'GPU', value: t('common.gpuCountValue', { v0: detail.node.gpu_count }) },
                  { label: t('common.rack'), value: detail.node.rack_id ?? '—', mono: true },
                  { label: t('common.switchGroup'), value: detail.node.switch_group ?? '—', mono: true },
                  {
                    label: t('common.status'),
                    value: NODE_STATE_META[detail.node.state]?.label ?? detail.node.state,
                  },
                  { label: t('nodes.slowNode'), value: detail.node.straggler ? t('common.yes') : t('common.no') },
                  { label: t('pools.bearingResources'), value: t('common.countGeneric', { v0: detail.node.hosted_resources }) },
                  { label: t('tickets.updatedAt'), value: formatDateTime(detail.node.updated_at) },
                ]}
              />
            ) : detail.events.length === 0 ? (
              <EmptyState icon="📄" title={t('nodes.noEvents')} hint={t('nodes.noEventsHint')} />
            ) : (
              <div className={s.timeline}>
                {detail.events.map((e) => (
                  <div className={s.timelineItem} key={e.id}>
                    <div className={s.timelineRail}>
                      <span
                        className={s.timelineDot}
                        style={{
                          background:
                            e.level === 'error'
                              ? 'var(--rs-danger)'
                              : e.level === 'warning'
                                ? 'var(--rs-warning)'
                                : 'var(--rs-info)',
                        }}
                      />
                      <span className={s.timelineLine} />
                    </div>
                    <div className={s.timelineBody}>
                      <div className={s.timelineTitle}>
                        {dt(e.title)}
                        <Badge tone={e.level === 'error' ? 'danger' : 'warning'}>{e.code}</Badge>
                      </div>
                      <div className={s.timelineTime}>{formatDateTime(e.occurredAt)}</div>
                      <div className={s.timelineDetail}>{dt(e.detail)}</div>
                      <MetricDiff before={e.metricsBefore} after={e.metricsAfter} />
                      {e.suggestedAction && (
                        <div className={s.muted} style={{ fontSize: 11 }}>
                          {t('events.actionValue', { v0: dt(e.suggestedAction) })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={s.muted}>{t('common.loading')}</div>
        )}
      </Drawer>
    </div>
  );
}
