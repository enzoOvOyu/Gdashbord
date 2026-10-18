// 结构化逐行日志（Modal 风格：ts / level / request_id / route / status / latency）
import { useState } from 'react';
import { ui as s, EmptyState, Select, Input, Button } from '../../components/ui';
import { formatTime } from '../../lib/date';
import type { LogEntry } from '../../types/domain';

const LEVEL_COLOR: Record<string, string> = {
  debug: 'var(--rs-text-muted)',
  info: 'var(--rs-text-secondary)',
  warning: 'var(--rs-warning)',
  error: 'var(--rs-danger)',
};

const LABEL: Record<string, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warning: 'WARN',
  error: 'ERROR',
};

export function LogFilters({
  level,
  onLevel,
  q,
  onQ,
}: {
  level: string;
  onLevel: (v: string) => void;
  q: string;
  onQ: (v: string) => void;
}) {
  return (
    <div className={s.toolbar}>
      <Select value={level} onChange={(e) => onLevel(e.target.value)} aria-label="级别">
        <option value="all">全部级别</option>
        <option value="error">ERROR</option>
        <option value="warning">WARNING</option>
        <option value="info">INFO</option>
        <option value="debug">DEBUG</option>
      </Select>
      <Input
        value={q}
        onChange={(e) => onQ(e.target.value)}
        placeholder="搜索关键字 / 来源"
        style={{ minWidth: 220 }}
      />
    </div>
  );
}

function LogRow({
  log,
  onRowClick,
}: {
  log: LogEntry;
  onRowClick?: (log: LogEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => onRowClick?.(log)}
      style={{
        borderBottom: '1px solid var(--rs-border)',
        padding: '6px 0',
        fontFamily: 'var(--rs-font-mono)',
        fontSize: 12,
        cursor: onRowClick ? 'pointer' : undefined,
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className={s.muted}>{formatTime(log.ts)}</span>
        <span style={{ color: LEVEL_COLOR[log.level], width: 48, flex: 'none' }}>
          {LABEL[log.level]}
        </span>
        <span className={s.secondary} style={{ width: 110, flex: 'none' }}>
          {log.source}
        </span>
        <span style={{ flex: 1, minWidth: 200, color: log.level === 'error' ? 'var(--rs-danger)' : undefined }}>
          {log.message}
        </span>
        {log.request_id && <span className={s.muted}>{log.request_id}</span>}
        {log.route && <span className={s.muted}>{log.route}</span>}
        {log.status != null && (
          <span style={{ color: log.status >= 500 ? 'var(--rs-danger)' : 'var(--rs-text-muted)' }}>
            {log.status}
          </span>
        )}
        {log.latency_ms != null && <span className={s.muted}>{log.latency_ms}ms</span>}
        {log.traceback && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            {open ? '收起堆栈' : '展开堆栈'}
          </Button>
        )}
      </div>
      {open && log.traceback && (
        <pre
          style={{
            margin: '6px 0 0',
            padding: 10,
            background: 'var(--rs-surface-2)',
            borderRadius: 6,
            color: 'var(--rs-danger)',
            overflowX: 'auto',
            fontSize: 11,
          }}
        >
          {log.traceback}
        </pre>
      )}
    </div>
  );
}

export function LogsList({
  logs,
  onRowClick,
  maxHeight = 520,
}: {
  logs: LogEntry[];
  onRowClick?: (log: LogEntry) => void;
  maxHeight?: number;
}) {
  if (!logs || logs.length === 0) {
    return <EmptyState icon="📄" title="没有匹配的日志" hint="调整级别或关键字筛选" />;
  }
  return (
    <div
      style={{
        border: '1px solid var(--rs-border)',
        borderRadius: 8,
        padding: '8px 12px',
        background: 'var(--rs-bg)',
        maxHeight,
        overflowY: 'auto',
      }}
    >
      {logs.map((l) => (
        <LogRow key={l.id} log={l} onRowClick={onRowClick} />
      ))}
    </div>
  );
}

export const LOG_LEVELS = ['error', 'warning', 'info', 'debug'];
