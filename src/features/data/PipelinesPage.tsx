// 数据预处理 Pipelines（PRD §4.6）：DAG 作业编排，节点数由 dag_json 派生
import { t } from '../../i18n';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, StatTile, Badge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { formatRelative } from '../../lib/date';
import { ui as s } from '../../components/ui';
import type { Pipeline } from '../../types/domain';

interface DagShape {
  nodes?: Array<{ id: string; op?: string }>;
  edges?: Array<{ from: string; to: string }>;
}

/** DAG 节点/边数量（由 dag_json 派生，禁止硬编码） */
function dagStats(p: Pipeline): { nodes: number; edges: number } {
  const dag = p.dag_json as DagShape;
  return { nodes: dag.nodes?.length ?? 0, edges: dag.edges?.length ?? 0 };
}

export default function PipelinesPage() {
  const { data: pipelines = [], isLoading } = useQuery<Pipeline[]>({
    queryKey: ['pipelines'],
    queryFn: () => api.get<Pipeline[]>(EP.pipelines),
  });

  const totalNodes = pipelines.reduce((a, p) => a + dagStats(p).nodes, 0);

  const columns: Array<Column<Pipeline>> = [
    { key: 'name', header: t('dp.pipelineTitle'), render: (r) => <strong style={{ color: 'var(--rs-text)' }}>{r.name}</strong> },
    {
      key: 'nodes',
      header: t('dp.dagNodes'),
      numeric: true,
      render: (r) => dagStats(r).nodes,
    },
    { key: 'edges', header: t('dp.dagEdges'), numeric: true, render: (r) => dagStats(r).edges },
    {
      key: 'created',
      header: t('common.createdAt'),
      render: (r) => <span className={s.secondary}>{formatRelative(r.created_at)}</span>,
    },
    {
      key: 'ops',
      header: t('dp.operators'),
      render: (r) => {
        const dag = r.dag_json as DagShape;
        const ops = (dag.nodes ?? []).map((n) => n.op ?? n.id).slice(0, 4);
        return (
          <span className={s.row}>
            {ops.map((o) => (
              <Badge key={o} tone="info">
                {o}
              </Badge>
            ))}
          </span>
        );
      },
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
        <StatTile label={t('dp.pipelineCount')} value={pipelines.length} />
        <StatTile label={t('dp.dagNodeTotal')} value={totalNodes} hint={t('dp.dagDerived')} />
      </div>

      <Card
        title={t('dp.pipelineNav')}
        actions={isLoading ? <Badge tone="info">{t('common.loading')}</Badge> : <Badge tone="muted">{t('dp.pipelineCountValue', { v0: pipelines.length })}</Badge>}
      >
        <Table columns={columns} rows={pipelines} rowKey={(r) => String(r.id)} zebra />
      </Card>
    </div>
  );
}
