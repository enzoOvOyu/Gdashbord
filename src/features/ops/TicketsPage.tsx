// 运营&运维 · 工单（§4.4.1 A 档：行 → Drawer → 整页 /ops/tickets/:id）
// 工单可关联资源，详情内可跳转关联资源详情页。
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Plus } from 'lucide-react';
import {
  ui as s,
  Table,
  Badge,
  Button,
  Drawer,
  EmptyState,
  Field,
  Input,
  Select,
  PageHeader,
  Toolbar,
  RegionSelect,
  KeyValue,
  toast,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { formatDateTime, formatRelative } from '../../lib/date';
import { REGION_META } from '../../lib/ids';
import {
  usePageRegion,
  useTickets,
  useResources,
  useCreateTicket,
  type TicketView,
} from '../shared/api';
import { TICKET_PRIORITY_META, TICKET_STATUS_META } from './shared';

export default function TicketsPage() {
  const navigate = useNavigate();
  const [region, setRegion] = usePageRegion();
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [open, setOpen] = useState<TicketView | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [resourceUuid, setResourceUuid] = useState('');

  const { data: tickets = [], isLoading } = useTickets(region);
  const { data: resources = [] } = useResources({ region });

  const rows = tickets
    .filter((t) => (status === 'all' ? true : t.status === status))
    .filter((t) => (priority === 'all' ? true : t.priority === priority));

  const { mutate: submit, isPending } = useCreateTicket();

  const columns: Array<Column<TicketView>> = [
    { key: 'id', header: '工单号', width: 84, mono: true, render: (t) => `TK-${String(t.id)}` },
    { key: 'subject', header: '标题', render: (t) => t.subject },
    {
      key: 'status',
      header: '状态',
      width: 96,
      render: (t) => (
        <Badge tone={TICKET_STATUS_META[t.status]?.tone ?? 'neutral'}>
          {TICKET_STATUS_META[t.status]?.label ?? t.status}
        </Badge>
      ),
    },
    {
      key: 'priority',
      header: '优先级',
      width: 88,
      render: (t) => (
        <Badge tone={TICKET_PRIORITY_META[t.priority]?.tone ?? 'neutral'}>
          {TICKET_PRIORITY_META[t.priority]?.label ?? t.priority}
        </Badge>
      ),
    },
    {
      key: 'resource',
      header: '关联资源',
      render: (t) => t.resource_name ?? <span className={s.muted}>未关联</span>,
    },
    { key: 'created', header: '创建于', render: (t) => formatRelative(t.created_at) },
    { key: 'updated', header: '更新于', render: (t) => formatRelative(t.updated_at) },
    {
      key: 'act',
      header: '',
      width: 84,
      render: (t) => (
        <Button size="sm" variant="ghost" onClick={() => setOpen(t)}>
          展开
        </Button>
      ),
    },
  ];

  const resetForm = (): void => {
    setSubject('');
    setDescription('');
    setNewPriority('normal');
    setResourceUuid('');
  };

  return (
    <div>
      <PageHeader
        title="工单"
        desc={`技术支持工单，可关联资源。当前按 ${REGION_META[region].label} 区域筛选，切换区域后工单列表按 region 重算。`}
        actions={
          <span className={s.row}>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
              新建工单
            </Button>
            <RegionSelect value={region} onChange={setRegion} />
          </span>
        }
      />

      <Toolbar>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="状态">
          <option value="all">全部状态</option>
          <option value="open">待处理</option>
          <option value="pending">处理中</option>
          <option value="resolved">已解决</option>
          <option value="closed">已关闭</option>
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="优先级">
          <option value="all">全部优先级</option>
          <option value="low">低</option>
          <option value="normal">中</option>
          <option value="high">高</option>
          <option value="urgent">紧急</option>
        </Select>
        <span className={s.spacer} />
        <span className={s.muted} style={{ fontSize: 12 }}>
          {rows.length} 个工单
        </span>
      </Toolbar>

      {isLoading ? (
        <div className={s.muted}>加载中…</div>
      ) : (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(t) => String(t.id)}
          zebra
          onRowClick={(t) => setOpen(t)}
          empty={
            <EmptyState
              icon="🎫"
              title="该区域没有匹配的工单"
              hint="切换区域或调整筛选条件"
            />
          }
        />
      )}

      {/* 详情抽屉（A 档） */}
      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.subject ?? ''}
        subtitle={open ? `TK-${String(open.id)} · 创建于 ${formatDateTime(open.created_at)}` : ''}
        badge={
          open ? (
            <Badge tone={TICKET_STATUS_META[open.status]?.tone ?? 'neutral'}>
              {TICKET_STATUS_META[open.status]?.label ?? open.status}
            </Badge>
          ) : null
        }
        footer={
          <span className={s.row}>
            {open?.resource_uuid && (
              <Button
                variant="ghost"
                onClick={() => navigate(`/resources/all/${open.resource_uuid}`)}
              >
                查看关联资源
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<ArrowUpRight size={14} />}
              onClick={() => {
                if (open) navigate(`/ops/tickets/${String(open.id)}`);
              }}
            >
              查看完整详情
            </Button>
          </span>
        }
      >
        {open && (
          <div className={s.col} style={{ gap: 12 }}>
            <KeyValue
              items={[
                { label: '工单号', value: `TK-${String(open.id)}`, mono: true },
                {
                  label: '优先级',
                  value: TICKET_PRIORITY_META[open.priority]?.label ?? open.priority,
                },
                {
                  label: '关联资源',
                  value: open.resource_name ?? '未关联',
                },
                { label: '区域', value: open.region ? REGION_META[open.region].label : '不涉及' },
                { label: '创建时间', value: formatDateTime(open.created_at) },
                { label: '更新时间', value: formatDateTime(open.updated_at) },
              ]}
            />
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{open.description}</div>
          </div>
        )}
      </Drawer>

      {/* 新建工单 */}
      <Drawer
        open={creating}
        onClose={() => setCreating(false)}
        title="新建工单"
        subtitle="可关联具体资源，便于技术支持定位"
        footer={
          <span className={s.row}>
            <Button
              variant="ghost"
              onClick={() => {
                resetForm();
                setCreating(false);
              }}
            >
              取消
            </Button>
            <Button
              variant="primary"
              disabled={isPending || subject.trim().length === 0}
              onClick={() => {
                submit(
                  {
                    subject,
                    description,
                    priority: newPriority,
                    resource_uuid: resourceUuid || undefined,
                  },
                  {
                    onSuccess: () => {
                      toast.success('工单已提交');
                      resetForm();
                      setCreating(false);
                    },
                    onError: () => toast.error('提交失败，请重试'),
                  },
                );
              }}
            >
              {isPending ? '提交中…' : '提交工单'}
            </Button>
          </span>
        }
      >
        <div className={s.col} style={{ gap: 12 }}>
          <Field label="标题" required>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="简述问题" />
          </Field>
          <Field label="问题描述">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="补充复现步骤、报错信息或影响面"
            />
          </Field>
          <Field label="优先级">
            <Select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
              <option value="low">低</option>
              <option value="normal">中</option>
              <option value="high">高</option>
              <option value="urgent">紧急</option>
            </Select>
          </Field>
          <Field label="关联资源（可选）">
            <Select value={resourceUuid} onChange={(e) => setResourceUuid(e.target.value)}>
              <option value="">不关联</option>
              {resources.map((r) => (
                <option key={r.resource_uuid} value={r.resource_uuid}>
                  {r.name}（{r.display_id}）
                </option>
              ))}
            </Select>
          </Field>
          <div className={s.muted} style={{ fontSize: 12 }}>
            工单区域上下文：{REGION_META[region].label}。关联资源后工单会归入该资源所在区域。
          </div>
        </div>
      </Drawer>
    </div>
  );
}
