// 运营&运维 · 事件与维护（§4.4.1 B 档：行 → Drawer，含 before/after 度量与关联节点跳转）
// 数据来源 node_events（Xid） + 运维动作流（cordon/drain/evicted/fail/remediate/fixed/rejoin） + 维护窗口。
import { t, dt } from '../../i18n';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import {
  ui as s,
  Card,
  Table,
  Badge,
  Button,
  Drawer,
  EmptyState,
  Select,
  PageHeader,
  Toolbar,
  RegionSelect,
  KeyValue,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { formatDateTime, formatRelative } from '../../lib/date';
import { REGION_META, NODE_POOL_LABEL } from '../../lib/ids';
import {
  usePageRegion,
  useNodeEvents,
  useMaintenanceWindows,
  type NodeEventView,
} from '../shared/api';
import {
  EVENT_TYPE_GROUPS,
  EVENT_TYPE_META,
  MAINT_TYPES,
  WINDOW_STATUS_META,
  MetricDiff,
  XID_TYPES,
} from './shared';

export default function EventsPage() {
  const navigate = useNavigate();
  const [region, setRegion] = usePageRegion();
  const [group, setGroup] = useState('all');
  const [type, setType] = useState('all');
  const [open, setOpen] = useState<NodeEventView | null>(null);

  const { data: events = [], isLoading } = useNodeEvents(region, 'all');
  const { data: windows = [] } = useMaintenanceWindows(region);

  const byGroup = events.filter((e) => {
    if (group === 'xid') return e.type.startsWith('XID_');
    if (group === 'maint') return MAINT_TYPES.includes(e.type);
    return true;
  });
  const rows = byGroup.filter((e) => (type === 'all' ? true : e.type === type));

  const columns: Array<Column<NodeEventView>> = [
    { key: 'time', header: t('common.time'), width: 148, render: (e) => formatDateTime(e.occurredAt) },
    {
      key: 'level',
      header: t('common.severity'),
      width: 92,
      render: (e) => (
        <Badge tone={e.level === 'error' ? 'danger' : e.level === 'warning' ? 'warning' : 'info'}>
          {e.level.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'type',
      header: t('common.type'),
      render: (e) => (
        <span className={s.nowrap}>
          {EVENT_TYPE_META[e.type]?.label ?? e.type}
        </span>
      ),
    },
    {
      key: 'node',
      header: t('nav.nodes'),
      mono: true,
      render: (e) => e.node_uid ?? `node#${String(e.node_id)}`,
    },
    { key: 'title', header: t('common.summary'), render: (e) => dt(e.title) },
    {
      key: 'action',
      header: t('events.suggestedAction'),
      render: (e) => <span className={s.muted}>{e.suggestedAction ? dt(e.suggestedAction) : '—'}</span>,
    },
    {
      key: 'act',
      header: '',
      width: 84,
      render: (e) => (
        <Button size="sm" variant="ghost" onClick={() => setOpen(e)}>
          {t('common.expand')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('nav.events')}
        desc={t('events.pageHint', { v0: REGION_META[region].label })}
        actions={<RegionSelect value={region} onChange={setRegion} />}
      />

      <Toolbar>
        <Select value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t('events.grouping')}>
          {EVENT_TYPE_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label={t('events.type')}>
          <option value="all">{t('events.allTypes')}</option>
          {(group === 'maint' ? MAINT_TYPES : group === 'xid' ? XID_TYPES : [
            ...XID_TYPES,
            ...MAINT_TYPES,
          ]).map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_META[t]?.label ?? t}
            </option>
          ))}
        </Select>
        <span className={s.spacer} />
        <span className={s.muted} style={{ fontSize: 12 }}>
          {t('events.countSummary', { v0: rows.length, v1: windows.length })}
        </span>
      </Toolbar>

      <Card
        title={
          <span className={s.row}>
            <CalendarClock size={15} /> {t('events.maintenanceWindow')}
          </span>
        }
      >
        {windows.length === 0 ? (
          <EmptyState icon="🗓️" title={t('events.noWindows')} hint={t('events.noWindowsHint')} />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 10,
            }}
          >
            {windows.map((w) => (
              <div
                key={w.id}
                style={{ border: '1px solid var(--rs-border)', borderRadius: 8, padding: 10 }}
              >
                <div className={s.row} style={{ justifyContent: 'space-between' }}>
                  <b>{NODE_POOL_LABEL[w.pool_code]}</b>
                  <Badge tone={WINDOW_STATUS_META[w.status]?.tone ?? 'neutral'}>
                    {WINDOW_STATUS_META[w.status]?.label ?? w.status}
                  </Badge>
                </div>
                <div className={s.muted} style={{ fontSize: 12, marginTop: 4 }}>
                  {formatDateTime(w.starts_at)} → {formatDateTime(w.ends_at)}
                </div>
                <div className={s.muted} style={{ fontSize: 12 }}>
                  {t('events.impact', { v0: w.impacted_nodes, v1: w.impacted_gpu })}
                </div>
                <div className={s.muted} style={{ fontSize: 12 }}>
                  {t('events.reason', { v0: w.reason })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {isLoading ? (
        <div className={s.muted}>{t('common.loading')}</div>
      ) : (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(e) => e.id}
          zebra
          onRowClick={(e) => setOpen(e)}
          empty={
            <EmptyState
              icon="🔔"
              title={t('events.noMatch')}
              hint={t('events.noMatchHint')}
            />
          }
        />
      )}

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.title ?? ''}
        subtitle={open ? `${formatRelative(open.occurredAt)} · ${open.source}` : ''}
        badge={
          open ? (
            <Badge tone={open.level === 'error' ? 'danger' : 'warning'}>{open.code}</Badge>
          ) : null
        }
        footer={
          open?.node_uid ? (
            <Button
              variant="secondary"
              onClick={() => navigate(`/ops/nodes/${open.node_uid}`)}
            >
              {t('common.viewNodeDetail')}
            </Button>
          ) : null
        }
      >
        {open && (
          <div className={s.col} style={{ gap: 12 }}>
            <KeyValue
              items={[
                { label: t('events.id'), value: open.id, mono: true },
                { label: t('events.occurredAt'), value: formatDateTime(open.occurredAt) },
                { label: t('common.type'), value: EVENT_TYPE_META[open.type]?.label ?? open.type },
                { label: t('events.source'), value: open.source },
                {
                  label: t('nav.nodes'),
                  value: open.node_uid ?? `node#${String(open.node_id)}`,
                  mono: true,
                },
                { label: t('common.machineType'), value: open.node_pool ? NODE_POOL_LABEL[open.node_pool] : '—' },
                {
                  label: t('nodes.statusDist'),
                  value: open.node_state ?? '—',
                },
              ]}
            />
            <div style={{ fontSize: 13 }}>{dt(open.detail)}</div>
            <div>
              <div className={s.sectionTitle} style={{ fontSize: 13 }}>
                {t('events.evidence')}
              </div>
              <MetricDiff before={open.metricsBefore} after={open.metricsAfter} />
            </div>
            {open.suggestedAction && (
              <div className={`${s.notice} ${s.noticeInfo}`}>
                <div>{t('events.actionValue', { v0: dt(open.suggestedAction) })}</div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
