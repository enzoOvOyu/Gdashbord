// 运营&运维 · 事件与维护（§4.4.1 B 档：行 → Drawer，含 before/after 度量与关联节点跳转）
// 数据来源 node_events（Xid） + 运维动作流（cordon/drain/evicted/fail/remediate/fixed/rejoin） + 维护窗口。
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
    { key: 'time', header: '时间', width: 148, render: (e) => formatDateTime(e.occurredAt) },
    {
      key: 'level',
      header: '级别',
      width: 92,
      render: (e) => (
        <Badge tone={e.level === 'error' ? 'danger' : e.level === 'warning' ? 'warning' : 'info'}>
          {e.level.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'type',
      header: '类型',
      render: (e) => (
        <span className={s.nowrap}>
          {EVENT_TYPE_META[e.type]?.label ?? e.type}
        </span>
      ),
    },
    {
      key: 'node',
      header: '节点',
      mono: true,
      render: (e) => e.node_uid ?? `node#${String(e.node_id)}`,
    },
    { key: 'title', header: '摘要', render: (e) => e.title },
    {
      key: 'action',
      header: '建议动作',
      render: (e) => <span className={s.muted}>{e.suggestedAction ?? '—'}</span>,
    },
    {
      key: 'act',
      header: '',
      width: 84,
      render: (e) => (
        <Button size="sm" variant="ghost" onClick={() => setOpen(e)}>
          展开
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="事件与维护"
        desc={`节点基础设施运维事件流与维护窗口。当前 ${REGION_META[region].label} 区域，切换区域后事件与窗口按 region 重算。`}
        actions={<RegionSelect value={region} onChange={setRegion} />}
      />

      <Toolbar>
        <Select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="事件分组">
          {EVENT_TYPE_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="事件类型">
          <option value="all">全部类型</option>
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
          {rows.length} 条事件 · {windows.length} 个维护窗口
        </span>
      </Toolbar>

      <Card
        title={
          <span className={s.row}>
            <CalendarClock size={15} /> 维护窗口
          </span>
        }
      >
        {windows.length === 0 ? (
          <EmptyState icon="🗓️" title="该区域暂无维护窗口" hint="切换区域查看其它区域的计划维护" />
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
                  影响 {w.impacted_nodes} 节点 / {w.impacted_gpu} 卡
                </div>
                <div className={s.muted} style={{ fontSize: 12 }}>
                  原因：{w.reason}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {isLoading ? (
        <div className={s.muted}>加载中…</div>
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
              title="该区域没有匹配的事件"
              hint="切换区域或放宽筛选条件"
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
              查看节点详情
            </Button>
          ) : null
        }
      >
        {open && (
          <div className={s.col} style={{ gap: 12 }}>
            <KeyValue
              items={[
                { label: '事件 ID', value: open.id, mono: true },
                { label: '发生时间', value: formatDateTime(open.occurredAt) },
                { label: '类型', value: EVENT_TYPE_META[open.type]?.label ?? open.type },
                { label: '来源', value: open.source },
                {
                  label: '节点',
                  value: open.node_uid ?? `node#${String(open.node_id)}`,
                  mono: true,
                },
                { label: '机型', value: open.node_pool ? NODE_POOL_LABEL[open.node_pool] : '—' },
                {
                  label: '节点状态',
                  value: open.node_state ?? '—',
                },
              ]}
            />
            <div style={{ fontSize: 13 }}>{open.detail}</div>
            <div>
              <div className={s.sectionTitle} style={{ fontSize: 13 }}>
                证据（before → after）
              </div>
              <MetricDiff before={open.metricsBefore} after={open.metricsAfter} />
            </div>
            {open.suggestedAction && (
              <div className={`${s.notice} ${s.noticeInfo}`}>
                <div>建议动作：{open.suggestedAction}</div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
