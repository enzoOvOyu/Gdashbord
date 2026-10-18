// 工单 Tickets（PRD §4.7 运营）：优先级与状态双维度，链接到相关资源
import { useQuery } from '@tanstack/react-query';
import { Card, Table, StatTile, Badge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { formatRelative } from '../../lib/date';
import { ui as s } from '../../components/ui';
import type { Ticket, TicketPriority, TicketStatus } from '../../types/domain';

const STATUS_TONE: Record<TicketStatus, 'success' | 'warning' | 'info' | 'muted'> = {
  open: 'warning',
  pending: 'info',
  resolved: 'success',
  closed: 'muted',
};
const STATUS_LABEL: Record<TicketStatus, string> = {
  open: '待处理',
  pending: '处理中',
  resolved: '已解决',
  closed: '已关闭',
};
const PRIORITY_TONE: Record<TicketPriority, 'danger' | 'warning' | 'info' | 'muted'> = {
  urgent: 'danger',
  high: 'warning',
  normal: 'info',
  low: 'muted',
};
const PRIORITY_LABEL: Record<TicketPriority, string> = {
  urgent: '紧急',
  high: '高',
  normal: '普通',
  low: '低',
};

export default function TicketsPage() {
  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ['tickets'],
    queryFn: () => api.get<Ticket[]>(`${EP.tickets}?size=100`),
  });

  const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'pending').length;

  const columns: Array<Column<Ticket>> = [
    {
      key: 'subject',
      header: '主题',
      render: (r) => <strong style={{ color: 'var(--rs-text)' }}>{r.subject}</strong>,
    },
    {
      key: 'status',
      header: '状态',
      render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
    },
    {
      key: 'priority',
      header: '优先级',
      render: (r) => <Badge tone={PRIORITY_TONE[r.priority]}>{PRIORITY_LABEL[r.priority]}</Badge>,
    },
    {
      key: 'resource',
      header: '相关资源',
      render: (r) =>
        r.resource_id ? <span className={s.secondary}>#{String(r.resource_id)}</span> : <span className={s.muted}>无</span>,
    },
    {
      key: 'created',
      header: '创建于',
      render: (r) => <span className={s.secondary}>{formatRelative(r.created_at)}</span>,
    },
    {
      key: 'updated',
      header: '更新于',
      render: (r) => <span className={s.secondary}>{formatRelative(r.updated_at)}</span>,
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
        <StatTile label="工单总数" value={tickets.length} />
        <StatTile label="未关闭" value={openCount} />
        <StatTile label="紧急工单" value={tickets.filter((t) => t.priority === 'urgent').length} />
      </div>

      <Card
        title="工单"
        actions={isLoading ? <Badge tone="info">加载中…</Badge> : <Badge tone="muted">{tickets.length} 条</Badge>}
      >
        <Table columns={columns} rows={tickets} rowKey={(r) => String(r.id)} zebra />
      </Card>
    </div>
  );
}
