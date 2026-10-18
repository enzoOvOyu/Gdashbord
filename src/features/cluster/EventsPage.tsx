// 事件与维护（PRD §4.4）：cordon / drain 操作记录、维护窗口与 Remediation 历史
// 操作人来自 node_events.actor_user_id；Xid 故障按处置动作映射（§6.6）。
import { useQuery } from '@tanstack/react-query';
import { Card, Table, StatTile, Badge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { StateMachineBadge } from '../../components/state-machine';
import { formatRelative, formatTime } from '../../lib/date';
import { ui as s } from '../../components/ui';
import type { NodeEvent } from '../../types/domain';

const LEVEL_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
};

export default function EventsPage() {
  const { data: events = [], isLoading } = useQuery<NodeEvent[]>({
    queryKey: ['node-events'],
    queryFn: () => api.get<NodeEvent[]>(`${EP.nodeEvents}?size=100`),
  });

  const maintCount = events.filter((e) => e.type.startsWith('maintenance') || e.code.startsWith('cord') || e.code.startsWith('drain')).length;
  const remediation = events.filter((e) => e.type === 'remediation').length;

  const columns: Array<Column<NodeEvent>> = [
    {
      key: 'time',
      header: '时间',
      render: (e) => <span className={s.secondary}>{formatRelative(e.occurredAt)}<br /><span className={s.mono} style={{ fontSize: 'var(--rs-fs-xs)' }}>{formatTime(e.occurredAt)}</span></span>,
    },
    {
      key: 'level',
      header: '级别',
      render: (e) => <Badge tone={LEVEL_TONE[e.level] ?? 'muted'}>{e.level}</Badge>,
    },
    { key: 'type', header: '事件类型', render: (e) => <span className={s.mono}>{e.type}</span> },
    {
      key: 'title',
      header: '说明',
      render: (e) => (
        <span>
          <strong style={{ color: 'var(--rs-text)' }}>{e.title}</strong>
          {e.detail && (
            <>
              <br />
              <span className={s.muted}>{e.detail}</span>
            </>
          )}
        </span>
      ),
    },
    {
      key: 'actor',
      header: '操作人',
      render: (e) =>
        e.actor_user_id ? (
          <span className={s.secondary}>user#{String(e.actor_user_id)}</span>
        ) : (
          <span className={s.muted}>系统自动</span>
        ),
    },
    {
      key: 'node',
      header: '节点',
      render: (e) => <span className={s.mono}>{String(e.node_id)}</span>,
    },
    {
      key: 'suggestedAction',
      header: '建议动作',
      render: (e) =>
        e.suggestedAction ? (
          <Badge tone="purple">{e.suggestedAction}</Badge>
        ) : (
          <span className={s.muted}>—</span>
        ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s5)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--rs-s4)',
        }}
      >
        <StatTile label="事件总数" value={events.length} />
        <StatTile label="维护操作" value={maintCount} hint="cordon / drain" />
        <StatTile label="自愈历史" value={remediation} />
      </div>

      <Card title="节点状态机说明">
        <div className={s.row} style={{ flexWrap: 'wrap', gap: 'var(--rs-s3)' }}>
          {(['ready', 'cordoned', 'draining', 'remediation', 'notready'] as const).map((st) => (
            <StateMachineBadge key={st} state={st} />
          ))}
        </div>
        <p className={s.muted} style={{ marginBottom: 0 }}>
          五态为 Ready / Cordoned / Draining / Remediation / NotReady；徽标同时以颜色、图标与文本表达状态。
        </p>
      </Card>

      <Card
        title="事件与维护"
        actions={isLoading ? <Badge tone="info">加载中…</Badge> : <Badge tone="muted">{events.length} 条</Badge>}
      >
        <Table columns={columns} rows={events} rowKey={(e) => e.id} zebra />
      </Card>
    </div>
  );
}
