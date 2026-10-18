// 运营&运维 · 节点详情（§4.4.1 A 档整页；由 /ops/nodes 抽屉进入）
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
import { useNode } from '../shared/api';
import { NODE_STATE_META, MetricDiff } from './shared';

export default function NodesDetailPage() {
  const navigate = useNavigate();
  const { nodeUid } = useParams<{ nodeUid: string }>();
  const { data, isLoading } = useNode(nodeUid);

  if (isLoading) {
    return (
      <Card title="加载中…">
        <div className={s.muted}>正在读取节点详情</div>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card title="节点不存在">
        <EmptyState
          icon="🔍"
          title={`未找到节点 ${nodeUid ?? '—'}`}
          hint="请返回节点列表重新选择"
          action={<Button onClick={() => navigate('/ops/nodes')}>返回节点列表</Button>}
        />
      </Card>
    );
  }

  const n = data.node;

  return (
    <div>
      <PageHeader
        title={
          <span className={s.row}>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={14} />}
              onClick={() => navigate('/ops/nodes')}
            />
            <span style={{ fontFamily: 'var(--rs-font-mono)', fontSize: 18 }}>{n.node_uid}</span>
          </span>
        }
        desc={`${n.pool_display_name} · ${REGION_META[n.region].label} 区域 · 机架 ${n.rack_id} / 交换机组 ${n.switch_group}`}
        actions={
          <span className={s.row}>
            <Badge tone={NODE_STATE_META[n.state]?.tone ?? 'neutral'}>
              {NODE_STATE_META[n.state]?.label ?? n.state}
            </Badge>
            <RegionSelect
              value={n.region}
              onChange={() => undefined}
              disabledReason="节点固定归属其所在区域"
            />
          </span>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Card title="节点信息">
          <KeyValue
            items={[
              { label: '节点 UID', value: n.node_uid, mono: true },
              { label: '机型', value: n.pool_display_name },
              { label: 'GPU', value: `${n.gpu_count} 卡` },
              { label: '机架位', value: n.rack_id ?? '—', mono: true },
              { label: '交换机组', value: n.switch_group ?? '—', mono: true },
              { label: '区域', value: REGION_META[n.region].label },
              { label: '慢节点', value: n.straggler ? '是（step_time p99/p50 偏高）' : '否' },
              { label: '承载资源', value: `${n.hosted_resources} 个` },
              { label: '状态更新时间', value: formatDateTime(n.updated_at) },
            ]}
          />
        </Card>
        <Card title="运维建议">
          {n.state === 'ready' ? (
            <div className={s.muted} style={{ fontSize: 13 }}>
              节点健康，可正常参与调度
              {n.straggler ? '；但存在慢节点标记，建议观察 step_time p99/p50 比值。' : '。'}
            </div>
          ) : (
            <div className={`${s.notice} ${s.noticeWarn}`}>
              <div>
                {NODE_STATE_META[n.state]?.label ?? n.state}：
                {n.state === 'notready'
                  ? '节点不可调度，等待自愈完成后重新加入。'
                  : n.state === 'remediation'
                    ? '正在自愈/换卡，完成后自动回到 Ready。'
                    : n.state === 'draining'
                      ? '正在驱逐存量实例，驱逐完成后进入 Remediation。'
                      : '已禁止新调度，等待维护窗口处理。'}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card title={`节点事件（${data.events.length}）`}>
        {data.events.length === 0 ? (
          <EmptyState icon="📄" title="该节点暂无事件" hint="Ready 且无历史告警的节点不产生事件" />
        ) : (
          <div className={s.timeline}>
            {data.events.map((e) => (
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
      </Card>
    </div>
  );
}
