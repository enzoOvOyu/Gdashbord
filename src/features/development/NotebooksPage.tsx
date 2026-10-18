// Notebook / IDE（PRD §4.5）：托管开发环境，可挂靠或创建于「资源·GPU 云服务器」
// notebooks.resource_id 指向宿主资源；运行态归资源菜单，本模块只提供入口。
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { Card, Table, Badge, Button } from '../../components/ui';
import type { Column } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { formatRelative } from '../../lib/date';
import { ui as s } from '../../components/ui';
import type { NotebookItem } from '../../types/domain';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  running: 'success',
  starting: 'info',
  stopping: 'warning',
  stopped: 'muted',
  error: 'danger',
};

export default function NotebooksPage() {
  const { data: notebooks = [], isLoading } = useQuery<NotebookItem[]>({
    queryKey: ['notebooks'],
    queryFn: () => api.get<NotebookItem[]>(EP.notebooks),
  });

  const columns: Array<Column<NotebookItem>> = [
    {
      key: 'type',
      header: '类型',
      render: (r) => (
        <Badge tone={r.type === 'jupyter' ? 'warning' : 'info'}>
          {r.type === 'jupyter' ? 'JupyterLab' : 'VS Code'}
        </Badge>
      ),
    },
    { key: 'status', header: '状态', render: (r) => <Badge tone={STATUS_TONE[r.status] ?? 'muted'}>{r.status}</Badge> },
    {
      key: 'resource',
      header: '挂靠资源',
      render: (r) => (r.resource_id ? <span className={s.secondary}>#{String(r.resource_id)}</span> : <span className={s.muted}>未挂靠</span>),
    },
    {
      key: 'url',
      header: '访问路径',
      render: (r) => <span className={s.mono}>{r.url_path}</span>,
    },
    {
      key: 'created',
      header: '创建于',
      render: (r) => <span className={s.secondary}>{formatRelative(r.created_at)}</span>,
    },
    {
      key: 'action',
      header: '操作',
      render: (r) => (
        <Button size="sm" variant="ghost" disabled={r.status !== 'running'} icon={<ExternalLink size={13} />}>
          打开
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s5)' }}>
      <Card title="Notebook / IDE" actions={isLoading ? <Badge tone="info">加载中…</Badge> : <Badge tone="muted">{notebooks.length} 个实例</Badge>}>
        <p className={s.muted} style={{ marginTop: 0 }}>
          托管开发环境可挂靠到 GPU 云服务器资源；实例的运行态（启停、费用）在「资源」中管理。
        </p>
        <Table columns={columns} rows={notebooks} rowKey={(r) => String(r.id)} zebra />
      </Card>
    </div>
  );
}
