// 工作台·弹性伸缩（v0.7 · PRD §4.5.2 / §4.2.6 · DESIGN §5.10）
// 本页是弹性策略的**唯一写入口**：新建 / 编辑 / 暂停 / 解绑只在此完成；
// 资源详情「弹性」Tab 仅作只读视图，避免双入口混乱。
import { t, dt } from '../../i18n';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, Plus } from 'lucide-react';
import {
  Badge, Button, Card, ConfirmDialog, Drawer, Field, KeyValue, PageHeader,
  Segmented, Sparkline, SwitchRow, Table, Tabs, Toolbar, toast,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import type { KVItem } from '../../components/ui';
import { EP, api, withQuery } from '../../lib/api-client';
import { ui as s } from '../../components/ui';
import { KIND_META, REGION_META } from '../../lib/ids';
import { formatRelative, formatDuration } from '../../lib/date';
import { RegionSelect } from '../../components/ui';
import type {
  RegionCode,
  ScalingEvent,
  ScalingPolicyRow,
  ScalingTrigger,
  StrategyModel,
} from '../../types/domain';

type TabKey = 'policies' | 'compare' | 'events';
type ModelFilter = StrategyModel;

const STATUS_TONE: Record<string, 'success' | 'warning' | 'info' | 'muted'> = {
  active: 'success',
  paused: 'warning',
  cooldown: 'info',
};

const STATUS_LABEL: Record<string, () => string> = {
  active: () => t('sc.statusActive'),
  paused: () => t('sc.statusPaused'),
  cooldown: () => t('sc.statusCooldown'),
};

const METRIC_LABEL: Record<ScalingTrigger, () => string> = {
  queue_depth: () => t('sc.triggerMetric') + ' · queue_depth',
  pending_pods: () => t('sc.triggerMetric') + ' · pending_pods',
  qpm: () => t('sc.triggerMetric') + ' · qpm',
  gpu_allocation_rate: () => t('sc.triggerMetric') + ' · gpu_allocation_rate',
  concurrency: () => t('sc.triggerMetric') + ' · concurrency',
  ttft_p99: () => t('sc.triggerMetric') + ' · ttft_p99',
  kv_cache_usage: () => t('sc.triggerMetric') + ' · kv_cache_usage',
  requests_waiting: () => t('sc.triggerMetric') + ' · requests_waiting',
};

/** 四场景对比（教育性静态知识卡，内容走 i18n 字典 · PRD §4.5.2） */
const COMPARE_ROWS: Array<{ dim: () => string; cells: Array<() => string> }> = [
  {
    dim: () => t('sc.compareGranularity'),
    cells: [
      () => t('cmp.vmGranularity'),
      () => t('cmp.bmGranularity'),
      () => t('cmp.vgpuGranularity'),
      () => t('cmp.infGranularity'),
    ],
  },
  {
    dim: () => t('sc.compareColdStart'),
    cells: [
      () => t('cmp.vmCold'),
      () => t('cmp.bmCold'),
      () => t('cmp.vgpuCold'),
      () => t('cmp.infCold'),
    ],
  },
  {
    dim: () => t('sc.compareDriverLayer'),
    cells: [
      () => t('cmp.vmDriver'),
      () => t('cmp.bmDriver'),
      () => t('cmp.vgpuDriver'),
      () => t('cmp.infDriver'),
    ],
  },
  {
    dim: () => t('sc.compareScaleZero'),
    cells: [
      () => t('cmp.vmZero'),
      () => t('cmp.bmZero'),
      () => t('cmp.vgpuZero'),
      () => t('cmp.infZero'),
    ],
  },
  {
    dim: () => t('sc.compareCoreMetric'),
    cells: [
      () => t('cmp.vmMetric'),
      () => t('cmp.bmMetric'),
      () => t('cmp.vgpuMetric'),
      () => t('cmp.infMetric'),
    ],
  },
  {
    dim: () => t('sc.comparePitfall'),
    cells: [
      () => t('cmp.vmPitfall'),
      () => t('cmp.bmPitfall'),
      () => t('cmp.vgpuPitfall'),
      () => t('cmp.infPitfall'),
    ],
  },
];

const PICK_ROWS: Array<{ scenario: () => string; recommend: () => string }> = [
  { scenario: () => t('cmp.pick1'), recommend: () => t('cmp.pick1Rec') },
  { scenario: () => t('cmp.pick2'), recommend: () => t('cmp.pick2Rec') },
  { scenario: () => t('cmp.pick3'), recommend: () => t('cmp.pick3Rec') },
  { scenario: () => t('cmp.pick4'), recommend: () => t('cmp.pick4Rec') },
];

export default function ScalingPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('policies');
  const [region, setRegion] = useState<RegionCode | 'all'>('all');
  const [model, setModel] = useState<ModelFilter>('node_pool');
  const [drawerPolicy, setDrawerPolicy] = useState<ScalingPolicyRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [unbindTarget, setUnbindTarget] = useState<ScalingPolicyRow | null>(null);
  const [eventDrawer, setEventDrawer] = useState<ScalingEvent | null>(null);
  const [eventDir, setEventDir] = useState<'all' | 'scale_out' | 'scale_in'>('all');

  const policiesKey = ['scaling-policies', region, model];
  const { data: policies = [], isLoading } = useQuery<ScalingPolicyRow[]>({
    queryKey: policiesKey,
    queryFn: () =>
      api.get<ScalingPolicyRow[]>(
        withQuery(EP.scalingPolicies, { region, strategy_model: model }),
      ),
  });

  const { data: events = [] } = useQuery<ScalingEvent[]>({
    queryKey: ['scaling-events', region, eventDir],
    queryFn: () => api.get<ScalingEvent[]>(withQuery(EP.scalingEvents, { direction: eventDir })),
  });

  const regionEvents = useMemo(
    () =>
      region === 'all'
        ? events
        : events.filter((e) => policies.some((p) => p.resource_id === e.resource_id)),
    [events, policies, region],
  );

  const { data: policyEvents = [] } = useQuery<ScalingEvent[]>({
    queryKey: ['scaling-policy-events', drawerPolicy?.id ?? 0],
    queryFn: () => api.get<ScalingEvent[]>(`/api/scaling/policies/${drawerPolicy?.id ?? 0}/events`),
    enabled: Boolean(drawerPolicy),
  });

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ['scaling-policies'] });
    void qc.invalidateQueries({ queryKey: ['scaling-events'] });
  };

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'paused' }) =>
      api.patch(EP.scalingPolicy(id), { status }),
    onSuccess: (_d, v) => {
      toast.success(v.status === 'paused' ? t('sc.policyPaused') : t('sc.policyResumed'));
      invalidate();
    },
    onError: (e) => toast.error(String(e)),
  });

  const removePolicy = useMutation({
    mutationFn: (id: number) => api.del(EP.scalingPolicy(id)),
    onSuccess: () => {
      toast.success(t('sc.policyUnbound'));
      setUnbindTarget(null);
      setDrawerPolicy(null);
      invalidate();
    },
    onError: (e) => toast.error(String(e)),
  });

  const columns: Array<Column<ScalingPolicyRow>> = [
    {
      key: 'resource',
      header: t('sc.boundResource'),
      render: (r) => (
        <span>
          <Link to={`/resources/${KIND_META[r.resource_kind].routeKey}/${r.resource_uuid}`}>
            <strong style={{ color: 'var(--rs-text)' }}>{String(r.display_id)}</strong>
          </Link>{' '}
          <Badge tone="muted">{KIND_META[r.resource_kind].label}</Badge>
          <br />
          <span className={s.muted}>
            {r.resource_name} · {REGION_META[r.region]?.label ?? r.region}
          </span>
        </span>
      ),
    },
    {
      key: 'metric',
      header: t('sc.triggerMetric'),
      render: (r) => (
        <span>
          <code>{r.trigger_metric}</code>
          {r.target_value !== null && (
            <span className={s.muted}> ≤ {r.target_value}</span>
          )}
        </span>
      ),
    },
    {
      key: 'range',
      header: t('sc.minMax'),
      render: (r) => (
        <span className={s.mono}>
          {r.min_size} ~ {r.max_size}
          {r.scale_to_zero && <Badge tone="warning">0</Badge>}
        </span>
      ),
    },
    {
      key: 'current',
      header: t('sc.currentSize'),
      numeric: true,
      render: (r) => <strong>{r.current_size}</strong>,
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (r) => <Badge tone={STATUS_TONE[r.status] ?? 'muted'}>{(STATUS_LABEL[r.status] ?? (() => r.status))()}</Badge>,
    },
    {
      key: 'last',
      header: t('sc.lastEvent'),
      render: (r) => (
        <span className={s.secondary}>
          {r.last_event_at ? formatRelative(r.last_event_at) : '—'}
        </span>
      ),
    },
    {
      key: 'action',
      header: t('common.actions'),
      render: (r) => (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          {r.status === 'paused' ? (
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: r.id, status: 'active' })}>
              {t('sc.resume')}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: r.id, status: 'paused' })}>
              {t('sc.pause')}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setUnbindTarget(r)}>
            {t('sc.unbind')}
          </Button>
        </span>
      ),
    },
  ];

  const eventColumns: Array<Column<ScalingEvent>> = [
    {
      key: 'at',
      header: t('common.time'),
      render: (e) => <span className={s.secondary}>{formatRelative(e.created_at)}</span>,
    },
    {
      key: 'dir',
      header: t('sc.eventDirection'),
      render: (e) => (
        <Badge tone={e.direction === 'scale_out' ? 'danger' : 'info'}>
          {e.direction === 'scale_out' ? t('sc.eventOut') : t('sc.eventIn')}
        </Badge>
      ),
    },
    {
      key: 'size',
      header: t('sc.eventFromTo'),
      render: (e) => (
        <span className={s.mono}>
          {e.from_size} → {e.to_size}
        </span>
      ),
    },
    {
      key: 'snapshot',
      header: t('sc.eventSnapshot'),
      render: (e) => (
        <span className={s.muted}>
          {e.trigger_snapshot.metric} {e.trigger_snapshot.value} / {t('sc.targetValue')}{' '}
          {e.trigger_snapshot.target} · {e.trigger_snapshot.windowS}s
        </span>
      ),
    },
    {
      key: 'duration',
      header: t('sc.eventDuration'),
      render: (e) => (
        <span>
          {formatDuration(e.duration_s)}
          <br />
          <span className={s.muted}>
            {e.warm_pool_hit === true
              ? t('sc.eventWarmHit')
              : e.warm_pool_hit === false
                ? t('sc.eventCold')
                : '—'}
          </span>
        </span>
      ),
    },
    {
      key: 'reason',
      header: t('sc.eventReason'),
      render: (e) => <span className={s.muted}>{dt(e.reason) || '—'}</span>
    },
  ];

  const drawerItems: KVItem[] = drawerPolicy
    ? [
        { label: t('sc.boundResource'), value: `${String(drawerPolicy.display_id)} · ${drawerPolicy.resource_name}` },
        { label: t('sc.strategyModel'), value: drawerPolicy.strategy_model },
        { label: t('sc.triggerMetric'), value: `${drawerPolicy.trigger_metric} ≤ ${drawerPolicy.target_value ?? '—'}` },
        { label: t('sc.minMax'), value: `${drawerPolicy.min_size} ~ ${drawerPolicy.max_size}` },
        { label: t('sc.currentSize'), value: String(drawerPolicy.current_size) },
        { label: t('sc.cooldown'), value: `${drawerPolicy.cooldown_s} s` },
        { label: t('sc.drainTimeout'), value: `${drawerPolicy.drain_timeout_s} s` },
        { label: t('sc.fallback'), value: drawerPolicy.fallback_enabled ? t('common.enabled') : t('common.disabled') },
        { label: t('sc.scaleToZero'), value: drawerPolicy.scale_to_zero ? t('common.enabled') : t('common.disabled') },
      ]
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s5)' }}>
      <PageHeader
        title={t('sc.title')}
        desc={t('sc.desc')}
        icon={<Activity size={18} />}
        actions={
          <>
            <RegionSelect value={region as RegionCode} includeAll onChange={(r) => setRegion(r as RegionCode | 'all')} />
            <Button
              variant="primary"
              icon={<Plus size={14} />}
              onClick={() => setCreateOpen(true)}
            >
              {t('sc.newPolicy')}
            </Button>
          </>
        }
      />

      <Tabs<TabKey>
        items={[
          { key: 'policies', label: t('sc.tabPolicies') },
          { key: 'compare', label: t('sc.tabCompare') },
          { key: 'events', label: t('sc.tabEvents') },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'policies' && (
        <Card
          title={t('sc.tabPolicies')}
          actions={
            <Segmented<ModelFilter>
              options={[
                { value: 'node_pool', label: t('sc.modelNodePool') },
                { value: 'replica', label: t('sc.modelReplica') },
              ]}
              value={model}
              onChange={setModel}
              ariaLabel={t('sc.selectModel')}
            />
          }
        >
          <p className={s.muted} style={{ marginTop: 0 }}>
            {model === 'node_pool' ? t('sc.modelNodePoolHint') : t('sc.modelReplicaHint')}
          </p>
          <Table<ScalingPolicyRow>
            columns={columns}
            rows={policies}
            rowKey={(r) => String(r.id)}
            zebra
            onRowClick={setDrawerPolicy}
            empty={
              <div style={{ padding: 24, textAlign: 'center' }}>
                <p className={s.muted}>{t('sc.emptyPolicies')}</p>
                <Link to="/deployment/server">
                  <Button variant="primary">{t('sc.emptyPoliciesAction')}</Button>
                </Link>
              </div>
            }
          />
          {isLoading && <p className={s.muted}>{t('common.loading')}</p>}
        </Card>
      )}

      {tab === 'compare' && (
        <>
          <Card title={t('sc.compareTitle')}>
            <p className={s.muted} style={{ marginTop: 0 }}>
              {t('sc.compareHint')}
            </p>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{t('sc.compareDimension')}</th>
                    <th>{KIND_META.gpu_vm.label}</th>
                    <th>{KIND_META.gpu_baremetal.label}</th>
                    <th>{KIND_META.vgpu.label}</th>
                    <th>{KIND_META.inference.label}</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <strong>{row.dim()}</strong>
                      </td>
                      {row.cells.map((c, j) => (
                        <td key={j} className={s.secondary}>
                          {c()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={t('sc.recTitle')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--rs-s4)' }}>
              {[
                { k: t('sc.recLayer1'), d: t('sc.recLayer1Desc') },
                { k: t('sc.recLayer2'), d: t('sc.recLayer2Desc') },
                { k: t('sc.recLayer3'), d: t('sc.recLayer3Desc') },
              ].map((layer) => (
                <div key={layer.k} className={s.card} style={{ padding: 'var(--rs-s4)' }}>
                  <strong style={{ color: 'var(--rs-text)' }}>{layer.k}</strong>
                  <p className={s.muted} style={{ marginBottom: 0 }}>
                    {layer.d}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card title={t('sc.pickTitle')}>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{t('sc.pickScenario')}</th>
                    <th>{t('sc.pickRecommend')}</th>
                  </tr>
                </thead>
                <tbody>
                  {PICK_ROWS.map((row, i) => (
                    <tr key={i}>
                      <td className={s.secondary}>{row.scenario()}</td>
                      <td>{row.recommend()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === 'events' && (
        <Card
          title={t('sc.tabEvents')}
          actions={
            <Segmented<'all' | 'scale_out' | 'scale_in'>
              options={[
                { value: 'all', label: t('sc.filterAll') },
                { value: 'scale_out', label: t('sc.eventOut') },
                { value: 'scale_in', label: t('sc.eventIn') },
              ]}
              value={eventDir}
              onChange={setEventDir}
              ariaLabel={t('sc.filterDirection')}
            />
          }
        >
          <Toolbar>
            <RegionSelect value={region as RegionCode} includeAll onChange={(r) => setRegion(r as RegionCode | 'all')} />
          </Toolbar>
          <Table<ScalingEvent>
            columns={eventColumns}
            rows={regionEvents}
            rowKey={(e) => e.event_uuid}
            zebra
            onRowClick={setEventDrawer}
            empty={
              <div style={{ padding: 24, textAlign: 'center' }}>
                <p className={s.muted}>{t('sc.emptyEvents')}</p>
              </div>
            }
          />
        </Card>
      )}

      {/* A 档：策略行 → Drawer（含触发历史迷你图）；编辑/暂停在本页完成，不设整页详情 */}
      <Drawer
        open={Boolean(drawerPolicy)}
        onClose={() => setDrawerPolicy(null)}
        title={t('sc.policyDetailTitle')}
        subtitle={drawerPolicy ? String(drawerPolicy.display_id) : undefined}
        badge={
          drawerPolicy ? (
            <Badge tone={STATUS_TONE[drawerPolicy.status] ?? 'muted'}>
              {(STATUS_LABEL[drawerPolicy.status] ?? (() => drawerPolicy.status))()}
            </Badge>
          ) : undefined
        }
        footer={
          drawerPolicy && (
            <span style={{ display: 'inline-flex', gap: 8 }}>
              {drawerPolicy.status === 'paused' ? (
                <Button onClick={() => setStatus.mutate({ id: drawerPolicy.id, status: 'active' })}>
                  {t('sc.resume')}
                </Button>
              ) : (
                <Button onClick={() => setStatus.mutate({ id: drawerPolicy.id, status: 'paused' })}>
                  {t('sc.pause')}
                </Button>
              )}
              <Button variant="danger" onClick={() => setUnbindTarget(drawerPolicy)}>
                {t('sc.unbind')}
              </Button>
            </span>
          )
        }
      >
        {drawerPolicy && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {drawerPolicy.resource_kind === 'gpu_baremetal' && (
              <p className={s.muted} style={{ margin: 0 }}>
                ⚠ {t('sc.baremetalColdStart')} {t('sc.warmFloorHint')}
              </p>
            )}
            <KeyValue items={drawerItems} />
            <div>
              <div className={s.sectionTitle}>{t('sc.triggerHistory')}</div>
              <Sparkline
                points={policyEvents
                  .slice()
                  .reverse()
                  .map((e, i) => ({ t: i, v: e.to_size }))}
                color="var(--rs-brand)"
              />
              <p className={s.muted} style={{ marginBottom: 0 }}>
                {t('sc.currentSize')}: <strong>{drawerPolicy.current_size}</strong> ·{' '}
                {policyEvents.length} {t('sc.tabEvents')}
              </p>
            </div>
          </div>
        )}
      </Drawer>

      {/* B 档：伸缩事件 → Drawer（事件详情 + 跳转关联资源） */}
      <Drawer
        open={Boolean(eventDrawer)}
        onClose={() => setEventDrawer(null)}
        title={eventDrawer ? (eventDrawer.direction === 'scale_out' ? t('sc.eventOut') : t('sc.eventIn')) : ''}
        subtitle={eventDrawer ? formatRelative(eventDrawer.created_at) : undefined}
      >
        {eventDrawer && (
          <KeyValue
            items={[
              { label: t('sc.eventFromTo'), value: `${eventDrawer.from_size} → ${eventDrawer.to_size}` },
              { label: t('sc.eventDuration'), value: formatDuration(eventDrawer.duration_s) },
              {
                label: t('sc.eventWarmHit'),
                value:
                  eventDrawer.warm_pool_hit === true
                    ? t('common.yes')
                    : eventDrawer.warm_pool_hit === false
                      ? t('sc.eventCold')
                      : '—',
              },
              {
                label: t('sc.eventSnapshot'),
                value: `${eventDrawer.trigger_snapshot.metric} = ${eventDrawer.trigger_snapshot.value} / ${eventDrawer.trigger_snapshot.target} (${eventDrawer.trigger_snapshot.windowS}s)`,
              },
              { label: t('sc.eventReason'), value: dt(eventDrawer.reason) || '—' },
            ]}
          />
        )}
      </Drawer>

      <CreatePolicyDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        model={model}
        onCreated={() => {
          setCreateOpen(false);
          toast.success(t('sc.policyCreated'));
          invalidate();
        }}
      />

      <ConfirmDialog
        open={Boolean(unbindTarget)}
        title={t('sc.unbindConfirmTitle')}
        description={t('sc.unbindConfirmBody')}
        confirmLabel={t('sc.unbind')}
        pending={removePolicy.isPending}
        onCancel={() => setUnbindTarget(null)}
        onConfirm={() => unbindTarget && removePolicy.mutate(unbindTarget.id)}
      />
    </div>
  );
}

// ─────────── 新建策略（Drawer 表单；§4.2.6.1 完整字段） ───────────
function CreatePolicyDrawer({
  open,
  onClose,
  model,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  model: StrategyModel;
  onCreated: () => void;
}) {
  const [resourceId, setResourceId] = useState<number | null>(null);
  const [minSize, setMinSize] = useState(1);
  const [maxSize, setMaxSize] = useState(4);
  const [metric, setMetric] = useState<ScalingTrigger>('queue_depth');
  const [target, setTarget] = useState(20);
  const [scaleToZero, setScaleToZero] = useState(false);
  const [cooldown, setCooldown] = useState(model === 'replica' ? 300 : 600);
  const [drain, setDrain] = useState(300);

  const { data: candidates = [] } = useQuery<Array<{ id: number; display_id: string; name: string; kind: string; region: string }>>({
    queryKey: ['scaling-candidates'],
    queryFn: () => api.get<Array<{ id: number; display_id: string; name: string; kind: string; region: string }>>('/api/workbench/attachable-resources'),
    enabled: open,
  });

  const matchKind = (kind: string): boolean =>
    model === 'replica' ? kind === 'inference' : kind !== 'inference';

  const options = candidates.filter((c) => matchKind(c.kind));
  const selected = options.find((c) => c.id === resourceId) ?? null;
  const isBareMetal = selected?.kind === 'gpu_baremetal';

  const create = useMutation({
    mutationFn: () =>
      api.post(EP.scalingPolicies, {
        resource_id: resourceId,
        strategy_model: model,
        trigger_metric: metric,
        target_value: target,
        min_size: scaleToZero ? 0 : minSize,
        max_size: maxSize,
        scale_to_zero: scaleToZero,
        drain_timeout_s: drain,
        cooldown_s: cooldown,
        fallback_enabled: true,
      }),
    onSuccess: onCreated,
    onError: (e) => toast.error(String(e)),
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t('sc.newPolicyTitle')}
      subtitle={model === 'node_pool' ? t('sc.modelNodePool') : t('sc.modelReplica')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={resourceId === null || create.isPending}
            onClick={() => create.mutate()}
          >
            {t('common.create')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label={t('sc.selectResource')} required>
          <select
            className={s.select}
            value={resourceId ?? ''}
            onChange={(e) => setResourceId(Number(e.target.value) || null)}
          >
            <option value="">{t('sc.selectResource')}</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {String(c.display_id)} · {c.name} · {c.region.toUpperCase()}
              </option>
            ))}
          </select>
          {options.length === 0 && <span className={s.fieldHint}>{t('sc.noUnboundResource')}</span>}
        </Field>

        <Field label={t('sc.triggerMetric')} required>
          <select
            className={s.select}
            value={metric}
            onChange={(e) => setMetric(e.target.value as ScalingTrigger)}
          >
            {model === 'replica' ? (
              <>
                <option value="ttft_p99">ttft_p99</option>
                <option value="kv_cache_usage">kv_cache_usage</option>
                <option value="requests_waiting">queue_depth</option>
                <option value="concurrency">concurrency</option>
                <option value="qpm">qpm</option>
              </>
            ) : (
              <>
                <option value="queue_depth">queue_depth</option>
                <option value="pending_pods">pending_pods</option>
                <option value="qpm">qpm</option>
                <option value="gpu_allocation_rate">gpu_allocation_rate</option>
              </>
            )}
          </select>
        </Field>

        <Field label={t('sc.fieldTarget')} hint={METRIC_LABEL[metric]()}>
          <input
            className={s.input}
            type="number"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field
            label={t('sc.fieldMinSize')}
            required
            hint={isBareMetal ? t('sc.warmFloorHint') : undefined}
          >
            <input
              className={s.input}
              type="number"
              min={isBareMetal ? 1 : 0}
              value={minSize}
              onChange={(e) => setMinSize(Number(e.target.value))}
            />
          </Field>
          <Field label={t('sc.fieldMaxSize')} required>
            <input
              className={s.input}
              type="number"
              min={1}
              value={maxSize}
              onChange={(e) => setMaxSize(Number(e.target.value))}
            />
          </Field>
        </div>

        {isBareMetal && (
          <p className={s.muted} style={{ margin: 0 }}>
            ⚠ {t('sc.baremetalColdStart')}
          </p>
        )}

        {model === 'replica' && (
          <SwitchRow
            label={t('sc.scaleToZero')}
            checked={scaleToZero}
            onChange={setScaleToZero}
            hint={t('sc.scaleToZeroHint')}
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={t('sc.cooldown')}>
            <input
              className={s.input}
              type="number"
              value={cooldown}
              onChange={(e) => setCooldown(Number(e.target.value))}
            />
          </Field>
          <Field label={t('sc.drainTimeout')}>
            <input
              className={s.input}
              type="number"
              value={drain}
              onChange={(e) => setDrain(Number(e.target.value))}
            />
          </Field>
        </div>
      </div>
    </Drawer>
  );
}
