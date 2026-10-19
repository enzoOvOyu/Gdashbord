// 运营&运维 · 工单（§4.4.1 A 档：行 → Drawer → 整页 /ops/tickets/:id）
// 工单可关联资源，详情内可跳转关联资源详情页。
import { t, dt } from '../../i18n';
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
    { key: 'id', header: t('tickets.id'), width: 84, mono: true, render: (t) => `TK-${String(t.id)}` },
    { key: 'subject', header: t('common.title'), render: (row) => dt(row.subject) },
    {
      key: 'status',
      header: t('common.status'),
      width: 96,
      render: (t) => (
        <Badge tone={TICKET_STATUS_META[t.status]?.tone ?? 'neutral'}>
          {TICKET_STATUS_META[t.status]?.label ?? t.status}
        </Badge>
      ),
    },
    {
      key: 'priority',
      header: t('tickets.priority'),
      width: 88,
      render: (t) => (
        <Badge tone={TICKET_PRIORITY_META[t.priority]?.tone ?? 'neutral'}>
          {TICKET_PRIORITY_META[t.priority]?.label ?? t.priority}
        </Badge>
      ),
    },
    {
      key: 'resource',
      header: t('tickets.linkedResource'),
      render: (row) => row.resource_name ?? <span className={s.muted}>{t('tickets.unlinked')}</span>,
    },
    { key: 'created', header: t('common.createdAt'), render: (t) => formatRelative(t.created_at) },
    { key: 'updated', header: t('common.updatedAt'), render: (t) => formatRelative(t.updated_at) },
    {
      key: 'act',
      header: '',
      width: 84,
      render: (row) => (
        <Button size="sm" variant="ghost" onClick={() => setOpen(row)}>
          {t('common.expand')}
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
        title={t('nav.tickets')}
        desc={t('tickets.pageHint', { v0: REGION_META[region].label })}
        actions={
          <span className={s.row}>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
              {t('tickets.new')}
            </Button>
            <RegionSelect value={region} onChange={setRegion} />
          </span>
        }
      />

      <Toolbar>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('common.status')}>
          <option value="all">{t('common.allStatus')}</option>
          <option value="open">{t('ticket.pending')}</option>
          <option value="pending">{t('ticket.processing')}</option>
          <option value="resolved">{t('ticket.resolved')}</option>
          <option value="closed">{t('ticket.closed')}</option>
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label={t('tickets.priority')}>
          <option value="all">{t('tickets.allPriorities')}</option>
          <option value="low">{t('sev.low')}</option>
          <option value="normal">{t('sev.medium')}</option>
          <option value="high">{t('sev.high')}</option>
          <option value="urgent">{t('sev.critical')}</option>
        </Select>
        <span className={s.spacer} />
        <span className={s.muted} style={{ fontSize: 12 }}>
          {t('tickets.count', { v0: rows.length })}
        </span>
      </Toolbar>

      {isLoading ? (
        <div className={s.muted}>{t('common.loading')}</div>
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
              title={t('tickets.noMatch')}
              hint={t('tickets.noMatchHint')}
            />
          }
        />
      )}

      {/* 详情抽屉（A 档） */}
      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.subject ? dt(open.subject) : ''}
        subtitle={open ? t('tickets.scopeLine', { v0: String(open.id), v1: formatDateTime(open.created_at) }) : ''}
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
                {t('tickets.viewResource')}
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<ArrowUpRight size={14} />}
              onClick={() => {
                if (open) navigate(`/ops/tickets/${String(open.id)}`);
              }}
            >
              {t('common.viewDetail')}
            </Button>
          </span>
        }
      >
        {open && (
          <div className={s.col} style={{ gap: 12 }}>
            <KeyValue
              items={[
                { label: t('tickets.id'), value: `TK-${String(open.id)}`, mono: true },
                {
                  label: t('tickets.priority'),
                  value: TICKET_PRIORITY_META[open.priority]?.label ?? open.priority,
                },
                {
                  label: t('tickets.linkedResource'),
                  value: open.resource_name ?? t('tickets.unlinked'),
                },
                { label: t('common.region'), value: open.region ? REGION_META[open.region].label : t('tickets.noRegion') },
                { label: t('common.createdAtFull'), value: formatDateTime(open.created_at) },
                { label: t('tickets.updatedAt'), value: formatDateTime(open.updated_at) },
              ]}
            />
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{dt(open.description)}</div>
          </div>
        )}
      </Drawer>

      {/* 新建工单 */}
      <Drawer
        open={creating}
        onClose={() => setCreating(false)}
        title={t('tickets.new')}
        subtitle={t('tickets.linkHint')}
        footer={
          <span className={s.row}>
            <Button
              variant="ghost"
              onClick={() => {
                resetForm();
                setCreating(false);
              }}
            >
              {t('common.cancel')}
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
                      toast.success(t('tickets.submitted'));
                      resetForm();
                      setCreating(false);
                    },
                    onError: () => toast.error(t('tickets.submitFailed')),
                  },
                );
              }}
            >
              {isPending ? t('tickets.submitting') : t('tickets.submit')}
            </Button>
          </span>
        }
      >
        <div className={s.col} style={{ gap: 12 }}>
          <Field label={t('common.title')} required>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('tickets.subject')} />
          </Field>
          <Field label={t('tickets.description')}>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('tickets.descHint')}
            />
          </Field>
          <Field label={t('tickets.priority')}>
            <Select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
              <option value="low">{t('sev.low')}</option>
              <option value="normal">{t('sev.medium')}</option>
              <option value="high">{t('sev.high')}</option>
              <option value="urgent">{t('sev.critical')}</option>
            </Select>
          </Field>
          <Field label={t('tickets.linkOptional')}>
            <Select value={resourceUuid} onChange={(e) => setResourceUuid(e.target.value)}>
              <option value="">{t('tickets.noLink')}</option>
              {resources.map((r) => (
                <option key={r.resource_uuid} value={r.resource_uuid}>
                  {t('common.idParenPair', { v0: r.name, v1: r.display_id })}</option>
              ))}
            </Select>
          </Field>
          <div className={s.muted} style={{ fontSize: 12 }}>
            {t('tickets.regionContext', { v0: REGION_META[region].label })}
          </div>
        </div>
      </Drawer>
    </div>
  );
}
