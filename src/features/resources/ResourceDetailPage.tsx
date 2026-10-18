// 资源详情页（PRD §5.3 强制：覆盖 创建中 provisioning → 就绪/异常 → 运行/停止 → 终止）
// 四类共用首屏与状态框架，再叠加各自专属区块（§4.3.1–4.3.4）。
// 监控指标集按 MOCK-DATA §6.2–§6.5；事件按 §9 契约（带 before/after 度量）。
import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Badge, Tabs } from '../../components/ui';
import { ui as s } from '../../components/ui';
import { LifecycleBadge } from '../../components/state-machine';
import { MetricChart } from '../../components/charts/MetricChart';
import type { MetricSeries } from '../../mocks/metrics';
import { kindOfRouteKey, KIND_META, NODE_POOL_LABEL, REGION_META } from '../../lib/ids';
import { EP, api } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth';
import { isResourceReadOnly } from '../../lib/rbac';
import { formatUsd, formatGb } from '../../lib/money';
import { formatDateTime, formatUtcTooltip, formatRelative, runningDuration } from '../../lib/date';
import type { ProvisioningStep, ResourceEvent } from '../../types/domain';

interface Detail {
  resource_uuid: string;
  display_id: string;
  kind: string;
  name: string;
  region: string;
  node_pool: string;
  gpu_count: number;
  storage_gb: number;
  status: string;
  running_since: string | null;
  spec_json: Record<string, unknown>;
  unit_price: number;
  cost: { gpu_hourly_cost: number; storage_monthly_cost: number; running_cost_per_hour: number; remaining_hours: number | null };
  placement: { rack_id: string | null; node_pool: string; gpu_indices: number[] } | null;
  order: { order_uuid: string; source_type: string; source_ref_id: number | null } | null;
  deleted_at: string | null;
}

export default function ResourceDetailPage() {
  const { routeKey = '', resourceUuid = '' } = useParams();
  const kind = kindOfRouteKey(routeKey);
  const role = useAuthStore((st) => st.role);
  const readOnly = isResourceReadOnly(role);
  const [tab, setTab] = useState('overview');
  const [range, setRange] = useState('1h');

  const { data: r, isLoading } = useQuery<Detail>({
    queryKey: ['resource', resourceUuid],
    queryFn: () => api.get<Detail>(EP.resource(resourceUuid)),
    enabled: Boolean(resourceUuid),
  });
  const { data: steps = [] } = useQuery<ProvisioningStep[]>({
    queryKey: ['resource-steps', resourceUuid],
    queryFn: () => api.get<ProvisioningStep[]>(EP.resourceSteps(resourceUuid)),
    enabled: Boolean(resourceUuid),
  });
  const { data: events = [] } = useQuery<ResourceEvent[]>({
    queryKey: ['resource-events', resourceUuid],
    queryFn: () => api.get<ResourceEvent[]>(EP.resourceEvents(resourceUuid)),
    enabled: Boolean(resourceUuid),
  });
  const { data: metrics = [] } = useQuery<MetricSeries[]>({
    queryKey: ['resource-metrics', resourceUuid, range],
    queryFn: () => api.get<MetricSeries[]>(`${EP.metrics(resourceUuid)}?range=${range}`),
    enabled: Boolean(resourceUuid),
  });

  if (!kind) return <Navigate to="/overview" replace />;
  if (isLoading || !r) return <div style={{ padding: 24, color: 'var(--rs-text-muted)' }}>加载中…</div>;

  const meta = KIND_META[r.kind as keyof typeof KIND_META] ?? KIND_META.gpu_vm;
  const isProvisioning = r.status === 'provisioning';
  const isError = r.status === 'error';

  // 推理服务两个标签页（PRD §4.3.4）
  const tabs = r.kind === 'inference'
    ? [
        { key: 'overview', label: '概览' },
        { key: 'instances', label: '实例管理' },
        { key: 'serving', label: '服务治理（Serving）' },
        { key: 'events', label: '事件时间线' },
      ]
    : [
        { key: 'overview', label: '概览' },
        { key: 'metrics', label: '监控' },
        { key: 'events', label: '事件时间线' },
      ];

  const specEntries = Object.entries(r.spec_json ?? {});

  return (
    <div>
      {/* 面包屑：资源 / GPU 云服务器 / srv-a1b2c3（PRD §5.5 统一 display_id） */}
      <div style={{ fontSize: 13, color: 'var(--rs-text-muted)', marginBottom: 8 }}>
        <Link to="/overview" style={{ color: 'inherit', textDecoration: 'none' }}>资源</Link>
        {' / '}
        <Link to={`/resources/${routeKey}`} style={{ color: 'inherit', textDecoration: 'none' }}>{meta.label}</Link>
        {' / '}
        <span className={s.mono}>{r.display_id}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 26 }}>{meta.icon}</span>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>
            {r.name} <span className={s.mono} style={{ fontSize: 16, color: 'var(--rs-text-muted)' }}>{r.display_id}</span>
          </h1>
          <div className={s.row} style={{ marginTop: 4 }}>
            <LifecycleBadge status={r.status} deleted={Boolean(r.deleted_at)} />
            <Badge>{REGION_META[r.region as keyof typeof REGION_META]?.label ?? r.region}</Badge>
            <Badge>{NODE_POOL_LABEL[r.node_pool as keyof typeof NODE_POOL_LABEL] ?? r.node_pool}</Badge>
          </div>
        </div>
        <div className={s.row} style={{ marginLeft: 'auto' }}>
          {!readOnly && r.status === 'running' && <Button variant="secondary" disabled>停止</Button>}
          {!readOnly && r.status === 'stopped' && <Button variant="secondary" disabled>启动</Button>}
          {isError && <Button variant="secondary" disabled>重试</Button>}
          {!readOnly && <Button variant="danger" disabled>删除</Button>}
        </div>
      </div>

      {/* ① 创建中：Provisioning 进度（PRD §5.3.1，由 resource_provisioning_steps 派生） */}
      {isProvisioning && (
        <Card title="创建中 · Provisioning 进度" className={s.mb4}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((st) => (
              <div key={st.step_key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 18, textAlign: 'center' }}>
                  {st.state === 'done' ? '✓' : st.state === 'running' ? '⟳' : st.state === 'failed' ? '✕' : '○'}
                </span>
                <span style={{ minWidth: 130 }}>{st.step_key}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--rs-surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: st.state === 'done' ? '100%' : st.state === 'running' ? '55%' : '0%',
                      height: '100%',
                      background: st.state === 'failed' ? 'var(--rs-danger)' : 'var(--rs-brand)',
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, color: 'var(--rs-text-muted)', minWidth: 90 }}>
                  {st.state}
                  {st.finished_at ? ` · ${formatRelative(st.finished_at)}` : ''}
                </span>
              </div>
            ))}
            {steps.length === 0 && <span className={s.muted}>等待供给子任务…</span>}
          </div>
        </Card>
      )}

      {/* ③ 异常：展示失败原因 + 重试/工单 */}
      {isError && (
        <Card title="供给失败" className={s.mb4}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ color: 'var(--rs-danger)' }}>
              ✕ {events.find((e) => e.level === 'error')?.detail ?? '供给失败，请查看事件时间线。'}
            </div>
            <div className={s.row}>
              <Button variant="secondary" disabled>重试供给（幂等，复用同一订单）</Button>
              <Link to="/operations/tickets"><Button variant="ghost">提交工单</Button></Link>
            </div>
          </div>
        </Card>
      )}

      <Tabs items={tabs} value={tab} onChange={setTab} className={s.mb4} />

      {/* ② 就绪/运行：概览 */}
      {tab === 'overview' && (
        <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
          <Card title="规格">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
              {specEntries.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: 'var(--rs-text-secondary)' }}>{k}</span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </strong>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--rs-text-secondary)' }}>gpu_count</span>
                <strong>{r.gpu_count}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--rs-text-secondary)' }}>storage_gb</span>
                <strong>{formatGb(r.storage_gb)}</strong>
              </div>
            </div>
          </Card>

          <Card title="运行时与费用">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--rs-text-secondary)' }}>状态</span>
                <span>{r.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--rs-text-secondary)' }}>运行时长</span>
                <span>
                  {r.running_since ? runningDuration(r.running_since).text : <span className={s.muted}>—</span>}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--rs-text-secondary)' }}>单价</span>
                <span className={s.mono}>{formatUsd(r.unit_price)} / GPU·时</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--rs-text-secondary)' }}>实时费用</span>
                <strong className={s.mono}>
                  {r.status === 'running' ? `${formatUsd(r.cost.running_cost_per_hour)} /时` : <span className={s.muted}>—</span>}
                </strong>
              </div>
              {r.cost.remaining_hours !== null && (
                <div style={{ fontSize: 12, color: 'var(--rs-text-muted)' }}>
                  按当前余额预计可运行 {r.cost.remaining_hours} 小时（§7.1 派生）
                </div>
              )}
              {r.status === 'stopped' && (
                <div style={{ fontSize: 12, color: 'var(--rs-warning)' }}>
                  算力费停计，仅计存储 {formatUsd(r.cost.storage_monthly_cost)} /月（PRD §7.4）
                </div>
              )}
            </div>
          </Card>

          <Card title="关联与来源">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--rs-text-secondary)' }}>落位机架</span>
                <span className={s.mono}>{r.placement?.rack_id ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--rs-text-secondary)' }}>占用 GPU</span>
                <span className={s.mono}>{r.placement?.gpu_indices?.join(',') ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--rs-text-secondary)' }}>来源订单</span>
                <span className={s.mono}>{r.order?.order_uuid?.slice(0, 13) ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--rs-text-secondary)' }}>来源类型</span>
                <span>{r.order?.source_type ?? 'direct'}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 监控（§6.2–§6.5 指标集） */}
      {(tab === 'metrics' || tab === 'instances') && (
        <Card
          title="监控"
          actions={
            <select
              className={s.input}
              value={range}
              onChange={(e) => setRange(e.target.value)}
              style={{ height: 30 }}
              aria-label="时间范围"
            >
              <option value="1h">近 1 小时</option>
              <option value="6h">近 6 小时</option>
              <option value="24h">近 24 小时</option>
              <option value="7d">近 7 天</option>
            </select>
          }
        >
          {metrics.length === 0 || (r.status !== 'running' && r.status !== 'error') ? (
            <div className={s.muted} style={{ padding: 12 }}>
              {r.status === 'provisioning'
                ? '供给中，暂无运行时指标（G4：不显示 0 或随机数）。'
                : '资源未运行，指标为空（非 0）。'}
            </div>
          ) : (
            <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
              {metrics
                .filter((m) => m.points.length > 0)
                .map((m) => (
                  <div key={m.key} style={{ border: '1px solid var(--rs-border)', borderRadius: 'var(--rs-r-lg)', padding: 12 }}>
                    <MetricChart series={m} height={150} />
                    {m.meta && (
                      <div style={{ fontSize: 11, color: 'var(--rs-text-muted)', marginTop: 6 }}>
                        {Object.entries(m.meta).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </Card>
      )}

      {/* 服务治理（推理服务 §4.3.4） */}
      {tab === 'serving' && (
        <Card title="服务治理（Serving）">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14, color: 'var(--rs-text-secondary)' }}>
              发布为在线端点（Endpoints）、推理网关（鉴权/限流/灰度）、基于 QPS/延迟的弹性策略。
              通过「发布为服务」动作生成。
            </div>
            <div className={s.row}>
              <Button variant="primary" disabled>发布为服务</Button>
              <Button variant="secondary" disabled>灰度切流</Button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--rs-text-muted)' }}>
              计费口径：推理服务按 GPU·小时计费，不按调用量/令牌计费（v1）；QPS/延迟仅用于服务治理观测（PRD §7.1）。
            </div>
          </div>
        </Card>
      )}

      {/* 事件时间线（§9：携带 before/after 度量） */}
      {tab === 'events' && (
        <Card title="事件时间线">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {events.map((e) => (
              <div key={e.id} style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span
                    style={{
                      width: 10, height: 10, borderRadius: '50%', marginTop: 4,
                      background:
                        e.level === 'error' ? 'var(--rs-danger)'
                        : e.level === 'warning' ? 'var(--rs-warning)'
                        : e.level === 'success' ? 'var(--rs-success)' : 'var(--rs-info)',
                    }}
                  />
                  <span style={{ flex: 1, width: 1, background: 'var(--rs-border)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className={s.row}>
                    <strong style={{ fontSize: 14 }}>{e.title}</strong>
                    <Badge tone={e.level === 'error' ? 'danger' : e.level === 'warning' ? 'warning' : e.level === 'success' ? 'success' : 'info'}>
                      {e.code}
                    </Badge>
                    <span style={{ fontSize: 12, color: 'var(--rs-text-muted)', marginLeft: 'auto' }}>
                      {formatDateTime(e.occurredAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--rs-text-secondary)', marginTop: 2 }}>{e.detail}</div>
                  {(e.metricsBefore || e.metricsAfter) && (
                    <div className={s.row} style={{ marginTop: 6, fontSize: 12 }}>
                      {e.metricsBefore && (
                        <span className={s.mono} style={{ color: 'var(--rs-text-muted)' }}>
                          before {JSON.stringify(e.metricsBefore)}
                        </span>
                      )}
                      {e.metricsAfter && (
                        <>
                          <span style={{ color: 'var(--rs-text-muted)' }}>→</span>
                          <span className={s.mono}>after {JSON.stringify(e.metricsAfter)}</span>
                        </>
                      )}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--rs-text-muted)', marginTop: 4 }}>
                    来源 {e.source}
                    {e.correlationId ? ` · trace ${e.correlationId}` : ''}
                    {e.suggestedAction ? ` · 建议：${e.suggestedAction}` : ''}
                    {' · '}
                    <span title={formatUtcTooltip(e.occurredAt)}>{formatRelative(e.occurredAt)}</span>
                  </div>
                </div>
              </div>
            ))}
            {events.length === 0 && <span className={s.muted}>暂无事件</span>}
          </div>
        </Card>
      )}
    </div>
  );
}
