// 运营&运维 · 日志（§4.4.1 B 档：行 → Drawer，含上下文前后各 50 行）
// 支持按区域/级别/关键字检索，并能跳转到来源资源详情页。
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ui as s,
  Card,
  Button,
  Drawer,
  PageHeader,
  Toolbar,
  RegionSelect,
  KeyValue,
  Badge,
} from '../../components/ui';
import { formatDateTime } from '../../lib/date';
import { REGION_META, KIND_META } from '../../lib/ids';
import { LogFilters, LogsList } from '../shared/LogsView';
import {
  usePageRegion,
  useLogList,
  useLogContext,
  useResources,
} from '../shared/api';
import type { LogEntry } from '../../types/domain';

export default function LogsPage() {
  const navigate = useNavigate();
  const [region, setRegion] = usePageRegion();
  const [level, setLevel] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<LogEntry | null>(null);

  const { data: logs = [], isLoading } = useLogList({ region, level, q });
  const { data: ctxLogs = [] } = useLogContext(open?.id ?? null);
  const { data: resources = [] } = useResources({ region });
  const kindOf = (uuid: string | null): string | null =>
    uuid ? (resources.find((r) => r.resource_uuid === uuid)?.kind ?? null) : null;

  const errors = logs.filter((l) => l.level === 'error').length;

  return (
    <div>
      <PageHeader
        title="日志"
        desc={`结构化逐行日志（ts / level / request_id / route / status / latency）。当前 ${REGION_META[region].label} 区域，切换区域后日志集按 region 重算。`}
        actions={<RegionSelect value={region} onChange={setRegion} />}
      />

      <Toolbar>
        <LogFilters level={level} onLevel={setLevel} q={q} onQ={setQ} />
        <span className={s.spacer} />
        <span className={s.muted} style={{ fontSize: 12 }}>
          {logs.length} 行 · 其中 {errors} 行 ERROR
        </span>
      </Toolbar>

      <Card>
        {isLoading ? (
          <div className={s.muted}>加载中…</div>
        ) : (
          <LogsList logs={logs} onRowClick={(l) => setOpen(l)} />
        )}
      </Card>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.message ?? ''}
        subtitle={open ? formatDateTime(open.ts) : ''}
        badge={
          open ? (
            <Badge
              tone={
                open.level === 'error'
                  ? 'danger'
                  : open.level === 'warning'
                    ? 'warning'
                    : 'info'
              }
            >
              {open.level.toUpperCase()}
            </Badge>
          ) : null
        }
        footer={
          open && open.resource_uuid && kindOf(open.resource_uuid) ? (
            <Button
              variant="secondary"
              onClick={() => {
                const kind = kindOf(open.resource_uuid);
                if (kind) {
                  navigate(`/resources/${KIND_META[kind as keyof typeof KIND_META].routeKey}/${open.resource_uuid}`);
                }
              }}
            >
              跳转到来源资源
            </Button>
          ) : null
        }
      >
        {open && (
          <div className={s.col} style={{ gap: 12 }}>
            <KeyValue
              items={[
                { label: '日志 ID', value: open.id, mono: true },
                { label: '时间', value: formatDateTime(open.ts) },
                { label: '级别', value: open.level.toUpperCase() },
                { label: '来源', value: open.source },
                { label: '区域', value: REGION_META[open.region].label },
                { label: 'request_id', value: open.request_id ?? '—', mono: true },
                { label: 'route', value: open.route ?? '—', mono: true },
                { label: 'status', value: open.status == null ? '—' : String(open.status) },
                { label: 'latency', value: open.latency_ms == null ? '—' : `${open.latency_ms} ms` },
              ]}
            />
            <div style={{ fontSize: 13 }}>{open.message}</div>
            {open.traceback && (
              <pre
                style={{
                  margin: 0,
                  padding: 10,
                  background: 'var(--rs-surface-2)',
                  borderRadius: 6,
                  color: 'var(--rs-danger)',
                  fontSize: 11,
                  overflowX: 'auto',
                }}
              >
                {open.traceback}
              </pre>
            )}
            <div>
              <div className={s.sectionTitle} style={{ fontSize: 13 }}>
                上下文（前后各 50 行）
              </div>
              <LogsList logs={ctxLogs} maxHeight={320} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
