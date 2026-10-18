// 运营&运维 · 工单详情（§4.4.1 A 档整页；由 /ops/tickets 抽屉进入）
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import {
  ui as s,
  Card,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  RegionSelect,
  KeyValue,
} from '../../components/ui';
import { formatDateTime } from '../../lib/date';
import { REGION_META } from '../../lib/ids';
import { usePageRegion, useTicket } from '../shared/api';
import { TICKET_PRIORITY_META, TICKET_STATUS_META } from './shared';

export default function TicketsDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [region] = usePageRegion();
  const { data, isLoading } = useTicket(id);

  if (isLoading) {
    return (
      <Card title="加载中…">
        <div className={s.muted}>正在读取工单</div>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card title="工单不存在">
        <EmptyState
          icon="🔍"
          title={`未找到工单 TK-${id ?? '—'}`}
          hint="请返回工单列表重新选择"
          action={<Button onClick={() => navigate('/ops/tickets')}>返回工单列表</Button>}
        />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title={
          <span className={s.row}>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={14} />}
              onClick={() => navigate('/ops/tickets')}
            />
            {data.subject}
          </span>
        }
        desc={`TK-${String(data.id)} · 创建于 ${formatDateTime(data.created_at)}`}
        actions={
          <span className={s.row}>
            <Badge tone={TICKET_STATUS_META[data.status]?.tone ?? 'neutral'}>
              {TICKET_STATUS_META[data.status]?.label ?? data.status}
            </Badge>
            <Badge tone={TICKET_PRIORITY_META[data.priority]?.tone ?? 'neutral'}>
              优先级 {TICKET_PRIORITY_META[data.priority]?.label ?? data.priority}
            </Badge>
            <RegionSelect
              value={data.region ?? region}
              onChange={() => undefined}
              disabledReason="工单区域由关联资源决定"
            />
          </span>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        <Card title="工单信息">
          <KeyValue
            items={[
              { label: '工单号', value: `TK-${String(data.id)}`, mono: true },
              { label: '状态', value: TICKET_STATUS_META[data.status]?.label ?? data.status },
              { label: '优先级', value: TICKET_PRIORITY_META[data.priority]?.label ?? data.priority },
              {
                label: '关联资源',
                value: data.resource_name ?? '未关联',
              },
              { label: '区域', value: data.region ? REGION_META[data.region].label : '不涉及' },
              { label: '创建时间', value: formatDateTime(data.created_at) },
              { label: '更新时间', value: formatDateTime(data.updated_at) },
            ]}
          />
          {data.resource_uuid && (
            <div style={{ marginTop: 8 }}>
              <Button
                icon={<ExternalLink size={14} />}
                onClick={() => navigate(`/resources/all/${data.resource_uuid}`)}
              >
                跳转到关联资源
              </Button>
            </div>
          )}
        </Card>
        <Card title="问题描述">
          <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {data.description || '（用户未填写描述）'}
          </div>
        </Card>
        <Card title="处理进度">
          <div className={s.timeline}>
            {(data.timeline ?? []).map((t, i) => (
              <div className={s.timelineItem} key={`${t.at}-${i}`}>
                <div className={s.timelineRail}>
                  <span
                    className={s.timelineDot}
                    style={{
                      background:
                        t.level === 'warning' ? 'var(--rs-warning)' : 'var(--rs-info)',
                    }}
                  />
                  {i < (data.timeline?.length ?? 0) - 1 && <span className={s.timelineLine} />}
                </div>
                <div className={s.timelineBody}>
                  <div className={s.timelineTitle}>{t.label}</div>
                  <div className={s.timelineTime}>{formatDateTime(t.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
