// 运营&运维 · 日志（§4.4.1 B 档：行 → Drawer，含上下文前后各 50 行）
// 支持按区域/级别/关键字检索，并能跳转到来源资源详情页。
import { t, dt } from '../../i18n';
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
        title={t('nav.logs')}
        desc={t('logs.pageHint', { v0: REGION_META[region].label })}
        actions={<RegionSelect value={region} onChange={setRegion} />}
      />

      <Toolbar>
        <LogFilters level={level} onLevel={setLevel} q={q} onQ={setQ} />
        <span className={s.spacer} />
        <span className={s.muted} style={{ fontSize: 12 }}>
          {t('logs.countSummary', { v0: logs.length, v1: errors })}
        </span>
      </Toolbar>

      <Card>
        {isLoading ? (
          <div className={s.muted}>{t('common.loading')}</div>
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
              {t('logs.jumpSource')}
            </Button>
          ) : null
        }
      >
        {open && (
          <div className={s.col} style={{ gap: 12 }}>
            <KeyValue
              items={[
                { label: t('logs.id'), value: open.id, mono: true },
                { label: t('common.time'), value: formatDateTime(open.ts) },
                { label: t('common.severity'), value: open.level.toUpperCase() },
                { label: t('events.source'), value: open.source },
                { label: t('common.region'), value: REGION_META[open.region].label },
                { label: 'request_id', value: open.request_id ?? '—', mono: true },
                { label: 'route', value: open.route ?? '—', mono: true },
                { label: 'status', value: open.status == null ? '—' : String(open.status) },
                { label: 'latency', value: open.latency_ms == null ? '—' : `${open.latency_ms} ms` },
              ]}
            />
            <div style={{ fontSize: 13 }}>{dt(open.message)}</div>
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
                {t('logs.context')}
              </div>
              <LogsList logs={ctxLogs} maxHeight={320} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
