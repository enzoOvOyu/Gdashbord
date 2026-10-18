// 调度与拓扑（PRD §4.4）：按机架 / 交换机组呈现拓扑感知调度结果
// 数据来源 gpu_nodes.rack_id / switch_group；straggler 与 5 态一并在拓扑上体现。
import { useQuery } from '@tanstack/react-query';
import { Card, Badge, StatTile } from '../../components/ui';
import { ui as s } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { StateMachineBadge } from '../../components/state-machine';
import { NODE_POOL_LABEL } from '../../lib/ids';
import { useRegionStore } from '../../stores/auth';
import { XID_TABLE_EXPORT } from '../../mocks/fixtures/nodes';
import type { GpuNode, NodeState } from '../../types/domain';

const STATE_ORDER: NodeState[] = ['ready', 'cordoned', 'draining', 'remediation', 'notready'];

export default function TopologyPage() {
  const region = useRegionStore((st) => st.region);
  const { data: nodes = [], isLoading } = useQuery<GpuNode[]>({
    queryKey: ['nodes', region],
    queryFn: () => api.get<GpuNode[]>(`${EP.nodes}?region=${region}&size=200`),
  });

  /** 按机架分组（§4.4 机架拓扑图） */
  const byRack = nodes.reduce<Record<string, GpuNode[]>>((acc, n) => {
    const key = n.rack_id ?? '未分配机架';
    (acc[key] ??= []).push(n);
    return acc;
  }, {});

  /** 按交换机组分组 */
  const bySwitch = nodes.reduce<Record<string, GpuNode[]>>((acc, n) => {
    const key = n.switch_group ?? '未分组';
    (acc[key] ??= []).push(n);
    return acc;
  }, {});

  const stragglers = nodes.filter((n) => n.straggler);
  const totalGpu = nodes.reduce((a, n) => a + n.gpu_count, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s5)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--rs-s4)',
        }}
      >
        <StatTile label="节点总数" value={nodes.length} />
        <StatTile label="GPU 总量" value={totalGpu} />
        <StatTile label="机架数" value={Object.keys(byRack).length} />
        <StatTile label="Straggler 节点" value={stragglers.length} />
      </div>

      <Card
        title="机架拓扑"
        actions={isLoading ? <Badge tone="info">加载中…</Badge> : <Badge tone="muted">{nodes.length} 节点</Badge>}
      >
        {Object.entries(byRack).map(([rack, list]) => (
          <div key={rack} style={{ marginBottom: 'var(--rs-s5)' }}>
            <div className={s.row} style={{ marginBottom: 'var(--rs-s2)' }}>
              <strong style={{ color: 'var(--rs-text)' }}>{rack}</strong>
              <Badge tone="muted">{list.length} 节点</Badge>
              <Badge tone="info">
                {list.reduce((a, n) => a + n.gpu_count, 0)} GPU
              </Badge>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 'var(--rs-s3)',
              }}
            >
              {list.map((n) => (
                <div
                  key={n.node_uid}
                  style={{
                    border: '1px solid var(--rs-border)',
                    borderRadius: 'var(--rs-r-md)',
                    padding: 'var(--rs-s3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div className={s.row}>
                    <StateMachineBadge state={n.state} />
                    {n.straggler && <Badge tone="warning">straggler</Badge>}
                  </div>
                  <span className={s.mono} style={{ fontSize: 'var(--rs-fs-xs)' }}>
                    {n.node_uid}
                  </span>
                  <span className={s.muted} style={{ fontSize: 'var(--rs-fs-xs)' }}>
                    {NODE_POOL_LABEL[n.pool_code]} · {n.gpu_count} GPU · {n.switch_group ?? '无交换机组'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <Card title="交换机组分布">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s3)' }}>
          {Object.entries(bySwitch).map(([sg, list]) => (
            <div key={sg} className={s.row} style={{ justifyContent: 'space-between' }}>
              <span className={s.secondary}>{sg}</span>
              <span className={s.row}>
                {STATE_ORDER.map((st) => {
                  const c = list.filter((n) => n.state === st).length;
                  return c > 0 ? (
                    <Badge key={st} tone="muted">
                      {st} {c}
                    </Badge>
                  ) : null;
                })}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="节点故障判定标准（NVIDIA Xid）">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s2)' }}>
          {XID_TABLE_EXPORT.map((x) => (
            <div
              key={x.xid}
              className={s.row}
              style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <span className={s.mono} style={{ flexShrink: 0 }}>
                Xid {x.xid}
              </span>
              <span className={s.secondary}>{x.meaning}</span>
              <span className={s.muted} style={{ textAlign: 'right', maxWidth: '42%' }}>
                {x.action}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
