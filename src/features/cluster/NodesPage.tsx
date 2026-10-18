// 节点（PRD §4.4 / §9.3：单节点视图，5 态状态机 + 拓扑位置 + straggler 标记）
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Badge } from '../../components/ui';
import type { Column } from '../../components/ui';
import { StateMachineBadge } from '../../components/state-machine';
import { EP, api } from '../../lib/api-client';
import { useRegionStore } from '../../stores/auth';
import { NODE_POOL_LABEL, REGION_META } from '../../lib/ids';
import { formatRelative } from '../../lib/date';
import { ui as s } from '../../components/ui';
import type { NodePoolCode, NodeState, RegionCode } from '../../types/domain';

interface NodeRow {
  id: number;
  node_uid: string;
  pool_code: NodePoolCode;
  region: RegionCode;
  rack_id: string | null;
  switch_group: string | null;
  gpu_count: number;
  state: NodeState;
  straggler: boolean;
  updated_at: string;
}

export default function NodesPage() {
  const region = useRegionStore((st) => st.region);
  const { data: nodes = [] } = useQuery<NodeRow[]>({
    queryKey: ['nodes', region],
    queryFn: () => api.get<NodeRow[]>(`${EP.nodes}?region=${region}&size=200`),
  });

  const columns: Array<Column<NodeRow>> = [
    {
      key: 'uid',
      header: '节点',
      mono: true,
      render: (n) => (
        <div>
          <div>{n.node_uid}</div>
          <div style={{ fontSize: 12, color: 'var(--rs-text-muted)' }}>
            {NODE_POOL_LABEL[n.pool_code]}
          </div>
        </div>
      ),
    },
    { key: 'gpu', header: 'GPU', numeric: true, render: (n) => n.gpu_count },
    {
      key: 'state',
      header: '状态（5 态）',
      render: (n) => <StateMachineBadge state={n.state} straggler={n.straggler} />,
    },
    {
      key: 'topo',
      header: '拓扑位置',
      render: (n) => (
        <div>
          <div className={s.mono} style={{ fontSize: 12 }}>{n.rack_id ?? '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--rs-text-muted)' }}>{n.switch_group ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'updated',
      header: '更新',
      render: (n) => <span style={{ fontSize: 12, color: 'var(--rs-text-muted)' }}>{formatRelative(n.updated_at)}</span>,
    },
  ];

  const notReady = nodes.filter((n) => n.state !== 'ready');

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px' }}>节点</h1>
      <p style={{ color: 'var(--rs-text-secondary)', margin: '0 0 24px' }}>
        {REGION_META[region].label} 区域供给侧节点；非 Ready 节点均带 Xid 事件证据（MOCK-DATA §6.6.1）。
      </p>

      <div className={s.row + ' ' + s.mb4}>
        <Badge tone="success">Ready {nodes.filter((n) => n.state === 'ready').length}</Badge>
        <Badge tone="warning">Cordoned {nodes.filter((n) => n.state === 'cordoned').length}</Badge>
        <Badge tone="info">Draining {nodes.filter((n) => n.state === 'draining').length}</Badge>
        <Badge tone="purple">Remediation {nodes.filter((n) => n.state === 'remediation').length}</Badge>
        <Badge tone="danger">NotReady {nodes.filter((n) => n.state === 'notready').length}</Badge>
        <span className={s.muted} style={{ fontSize: 12 }}>
          · straggler {nodes.filter((n) => n.straggler).length}
        </span>
      </div>

      <Card title={`节点列表（${nodes.length}）`} tight>
        <Table columns={columns} rows={nodes} rowKey={(n) => String(n.id)} zebra />
      </Card>

      {notReady.length > 0 && (
        <Card title="非 Ready 节点（含 Xid 证据）" className={s.mt4}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            {notReady.slice(0, 6).map((n) => (
              <div key={n.id} className={s.row}>
                <StateMachineBadge state={n.state} straggler={n.straggler} />
                <span className={s.mono}>{n.node_uid}</span>
                <span className={s.muted} style={{ marginLeft: 'auto' }}>
                  已记录 Xid 事件，可在「事件与维护」查看处置动作
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
