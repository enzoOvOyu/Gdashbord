// 日志 Logs（PRD §4.7 运营）：结构化逐行日志，由节点/资源事件汇聚
// 与《指标》分离——日志关注离散事件与建议动作，指标关注连续采样（§11 契约分离）。
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Badge, Tabs } from '../../components/ui';
import { ui as s } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { formatTime, formatUtcTooltip } from '../../lib/date';
import type { NodeEvent } from '../../types/domain';

const LEVEL_TEXT: Record<string, string> = {
  info: 'INFO',
  warning: 'WARN',
  error: 'ERROR',
  success: 'OK',
};
const LEVEL_COLOR: Record<string, string> = {
  info: 'var(--rs-info)',
  warning: 'var(--rs-warning)',
  error: 'var(--rs-danger)',
  success: 'var(--rs-success)',
};

export default function LogsPage() {
  const [level, setLevel] = useState<'all' | 'info' | 'warning' | 'error'>('all');

  const { data: events = [], isLoading } = useQuery<NodeEvent[]>({
    queryKey: ['node-events', 'logs'],
    queryFn: () => api.get<NodeEvent[]>(`${EP.nodeEvents}?size=200`),
  });

  const rows = useMemo(
    () =>
      events
        .filter((e) => level === 'all' || e.level === level)
        .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt)),
    [events, level],
  );

  const counts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.level] = (acc[e.level] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s5)' }}>
      <Card
        title="系统日志"
        actions={isLoading ? <Badge tone="info">加载中…</Badge> : <Badge tone="muted">{rows.length} 行</Badge>}
      >
        <Tabs
          items={[
            { key: 'all', label: `全部 ${counts.info + (counts.warning ?? 0) + (counts.error ?? 0) + (counts.success ?? 0) || events.length}` },
            { key: 'info', label: `INFO ${counts.info ?? 0}` },
            { key: 'warning', label: `WARN ${counts.warning ?? 0}` },
            { key: 'error', label: `ERROR ${counts.error ?? 0}` },
          ]}
          value={level}
          onChange={(k) => setLevel(k as typeof level)}
        />

        <div
          style={{
            marginTop: 'var(--rs-s4)',
            background: 'var(--rs-surface-2)',
            border: '1px solid var(--rs-border)',
            borderRadius: 'var(--rs-r-md)',
            padding: 'var(--rs-s3)',
            maxHeight: 560,
            overflowY: 'auto',
            fontFamily: 'var(--rs-font-mono)',
            fontSize: 'var(--rs-fs-xs)',
          }}
        >
          {rows.map((e) => (
            <div
              key={e.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '150px 58px 1fr',
                gap: 'var(--rs-s3)',
                padding: '3px 0',
                borderBottom: '1px dashed var(--rs-border)',
                alignItems: 'baseline',
              }}
              title={formatUtcTooltip(e.occurredAt)}
            >
              <span style={{ color: 'var(--rs-text-muted)' }}>{formatTime(e.occurredAt)}</span>
              <span style={{ color: LEVEL_COLOR[e.level], fontWeight: 700 }}>
                {LEVEL_TEXT[e.level] ?? e.level.toUpperCase()}
              </span>
              <span style={{ color: 'var(--rs-text-secondary)' }}>
                [{e.source}] {e.code} — {e.title}
                {e.detail ? ` · ${e.detail}` : ''}
                {e.suggestedAction ? (
                  <span style={{ color: 'var(--rs-brand)' }}> → {e.suggestedAction}</span>
                ) : null}
              </span>
            </div>
          ))}
          {rows.length === 0 && <span className={s.muted}>当前筛选下无日志。</span>}
        </div>
      </Card>
    </div>
  );
}
