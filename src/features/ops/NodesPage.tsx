// 运营&运维 · 节点（§4.4.1 A 档：行 → Drawer → 整页 /ops/nodes/:nodeUid）
// 每个非 Ready 节点都能展开看到对应 Xid 事件（G7 不完美即真实 + 事件必须有证据）。
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
  { value: 'all', label: '全部状态' },
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
      header: '节点',
      mono: true,
      render: (n) => n.node_uid,
    },
    {
      key: 'pool',
      header: '机型',
      render: (n) => n.pool_display_name,
    },
    { key: 'rack', header: '机架位', mono: true, render: (n) => n.rack_id ?? '—' },
    { key: 'sw', header: '交换机组', mono: true, render: (n) => n.switch_group ?? '—' },
    {
      key: 'state',
      header: '状态',
      render: (n) => (
        <span className={s.row} style={{ gap: 6 }}>
          <Badge tone={NODE_STATE_META[n.state]?.tone ?? 'neutral'}>
            {NODE_STATE_META[n.state]?.label.split('（')[0] ?? n.state}
          </Badge>
          {n.straggler && <Badge tone="warning">慢节点</Badge>}
        </span>
      ),
    },
    {
      key: 'gpu',
      header: 'GPU',
      numeric: true,
      render: (n) => `${n.gpu_count} 卡`,
    },
    {
      key: 'hosted',
      header: '承载资源',
      numeric: true,
      render: (n) => n.hosted_resources,
    },
    {
      key: 'updated',
      header: '更新于',
      render: (n) => formatRelative(n.updated_at),
    },
    {
      key: 'act',
      header: '',
      width: 92,
      render: (n) => (
        <Button size="sm" variant="ghost" onClick={() => setOpenUid(n.node_uid)}>
          查看
        </Button>
      ),
    },
  ];

  const notReady = nodes.filter((n) => n.state !== 'ready');

  return (
    <div>
      <PageHeader
        title="节点"
        desc={`平台物理节点（rack / switch / GPU）。当前 ${REGION_META[region].label} 区域，切换区域后节点清单与状态分布必须重算。`}
        actions={<RegionSelect value={region} onChange={setRegion} />}
      />

      <Toolbar>
        <Select value={state} onChange={(e) => setState(e.target.value)} aria-label="节点状态">
          {STATE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <span className={s.spacer} />
        <span className={s.muted} style={{ fontSize: 12 }}>
          {nodes.length} 个节点{notReady.length > 0 ? ` · ${notReady.length} 个非 Ready` : ''}
        </span>
      </Toolbar>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <Card title="五态分布">
          {dist ? <StateRing dist={dist} /> : <div className={s.muted}>加载中…</div>}
        </Card>
        <Card title="非 Ready 节点">
          {notReady.length === 0 ? (
            <EmptyState icon="✅" title="该区域全部节点 Ready" hint="切换区域查看其它区域运维状态" />
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
                    展开看 Xid →
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {isLoading ? (
        <div className={s.muted}>加载中…</div>
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
              title="该区域没有匹配的节点"
              hint="切换区域或调整状态筛选"
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
            查看完整详情
          </Button>
        }
      >
        {detail ? (
          <div className={s.col} style={{ gap: 12 }}>
            <DrawerTabs<DrawerTab>
              items={[
                { key: 'overview', label: '概览' },
                { key: 'events', label: `事件（${detail.events.length}）` },
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === 'overview' ? (
              <KeyValue
                items={[
                  { label: '节点 UID', value: detail.node.node_uid, mono: true },
                  { label: '机型', value: detail.node.pool_display_name },
                  { label: 'GPU', value: `${detail.node.gpu_count} 卡` },
                  { label: '机架位', value: detail.node.rack_id ?? '—', mono: true },
                  { label: '交换机组', value: detail.node.switch_group ?? '—', mono: true },
                  {
                    label: '状态',
                    value: NODE_STATE_META[detail.node.state]?.label ?? detail.node.state,
                  },
                  { label: '慢节点', value: detail.node.straggler ? '是' : '否' },
                  { label: '承载资源', value: `${detail.node.hosted_resources} 个` },
                  { label: '更新时间', value: formatDateTime(detail.node.updated_at) },
                ]}
              />
            ) : detail.events.length === 0 ? (
              <EmptyState icon="📄" title="该节点暂无事件" hint="Ready 且无历史告警的节点不产生事件" />
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
                        {e.title}
                        <Badge tone={e.level === 'error' ? 'danger' : 'warning'}>{e.code}</Badge>
                      </div>
                      <div className={s.timelineTime}>{formatDateTime(e.occurredAt)}</div>
                      <div className={s.timelineDetail}>{e.detail}</div>
                      <MetricDiff before={e.metricsBefore} after={e.metricsAfter} />
                      {e.suggestedAction && (
                        <div className={s.muted} style={{ fontSize: 11 }}>
                          建议动作：{e.suggestedAction}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={s.muted}>加载中…</div>
        )}
      </Drawer>
    </div>
  );
}
