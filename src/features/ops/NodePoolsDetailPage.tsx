// 运营&运维 · 节点池详情（§4.4.1 A 档整页；由 /ops/pools 抽屉进入）
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import {
  ui as s,
  Card,
  Table,
  Badge,
  Button,
  Progress,
  EmptyState,
  PageHeader,
  RegionSelect,
  KeyValue,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { formatNumber, formatUsd } from '../../lib/money';
import { formatRelative } from '../../lib/date';
import { REGION_META } from '../../lib/ids';
import { usePageRegion, useNodePools, useNodes, type NodeView } from '../shared/api';
import { NODE_STATE_META } from './shared';

export default function NodePoolsDetailPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const [region, setRegion] = usePageRegion();
  const { data: pools = [], isLoading } = useNodePools(region);
  const { data: nodes = [] } = useNodes(region);

  const pool = pools.find((p) => p.code === code);
  const poolNodes = nodes.filter((n) => n.pool_code === code);

  const columns: Array<Column<NodeView>> = [
    { key: 'uid', header: '节点', mono: true, render: (n) => n.node_uid },
    { key: 'rack', header: '机架位', mono: true, render: (n) => n.rack_id ?? '—' },
    { key: 'sw', header: '交换机组', mono: true, render: (n) => n.switch_group ?? '—' },
    {
      key: 'state',
      header: '状态',
      render: (n) => (
        <span className={s.row} style={{ gap: 6 }}>
          <Badge tone={NODE_STATE_META[n.state]?.tone ?? 'neutral'}>
            {NODE_STATE_META[n.state]?.label.split('（')[0] ?? n.state}
          </Badge>
          {n.straggler && <Badge tone="warning">慢节点</Badge>}
        </span>
      ),
    },
    { key: 'gpu', header: 'GPU', numeric: true, render: (n) => `${n.gpu_count} 卡` },
    { key: 'hosted', header: '承载资源', numeric: true, render: (n) => n.hosted_resources },
    { key: 'updated', header: '更新于', render: (n) => formatRelative(n.updated_at) },
    {
      key: 'act',
      header: '',
      width: 88,
      render: (n) => (
        <Button size="sm" variant="ghost" onClick={() => navigate(`/ops/nodes/${n.node_uid}`)}>
          详情
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Card title="加载中…">
        <div className={s.muted}>正在读取节点池容量</div>
      </Card>
    );
  }

  if (!pool) {
    return (
      <Card title="节点池不存在">
        <EmptyState
          icon="🔍"
          title={`未找到机型 ${code ?? '—'}`}
          hint={`该机型可能未在 ${REGION_META[region].label} 区域提供`}
          action={<Button onClick={() => navigate('/ops/pools')}>返回节点池列表</Button>}
        />
      </Card>
    );
  }

  const total = pool.supply?.totalGpu ?? 0;
  const avail = pool.supply?.availableGpu ?? 0;

  return (
    <div>
      <PageHeader
        title={
          <span className={s.row}>
            <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={() => navigate('/ops/pools')} />
            {pool.display_name}
          </span>
        }
        desc={`${pool.gpu_model} · ${pool.interconnect} · 当前 ${REGION_META[region].label} 区域容量口径`}
        actions={<RegionSelect value={region} onChange={setRegion} />}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Card title="容量">
          <KeyValue
            items={[
              { label: '节点数', value: formatNumber(pool.supply?.nodeCount ?? 0) },
              { label: '总 GPU', value: `${formatNumber(total)} 卡` },
              { label: '可用 GPU', value: `${formatNumber(avail)} 卡` },
              { label: '已分配 GPU', value: `${formatNumber(pool.supply?.allocatedGpu ?? 0)} 卡` },
            ]}
          />
          <div style={{ marginTop: 8 }}>
            <Progress
              label="分配率"
              value={pool.supply?.allocatedGpu ?? 0}
              max={total}
              right={`空闲 ${formatNumber(avail)} 卡`}
            />
          </div>
        </Card>
        <Card title="规格">
          <KeyValue
            items={[
              { label: '机型编码', value: pool.code, mono: true },
              { label: 'GPU 型号', value: pool.gpu_model },
              { label: '单卡显存', value: `${pool.vram_gb} GB` },
              { label: '单节点卡数', value: `${pool.gpus_per_node} 卡` },
              { label: '互连', value: pool.interconnect },
              { label: 'CPU', value: pool.platform.cpu },
              { label: '本地 NVMe', value: pool.platform.localNvme },
              { label: '网络', value: pool.platform.network },
            ]}
          />
        </Card>
        <Card title="定价">
          <KeyValue
            items={[
              { label: 'GPU·小时', value: `${formatUsd(pool.unit_price)} / GPU·时` },
              { label: '裸金属', value: `${formatUsd(pool.machine_unit_price)} / 台·时` },
              {
                label: '市场区间',
                value: `${formatUsd(pool.market_range[0])} – ${formatUsd(pool.market_range[1])}`,
              },
            ]}
          />
          <div style={{ marginTop: 8 }}>
            <Button
              variant="primary"
              icon={<Plus size={14} />}
              onClick={() => navigate('/deployment/gpu_vm')}
            >
              用该机型创建 GPU 云服务器
            </Button>
          </div>
        </Card>
      </div>

      <Card title={`${REGION_META[region].label} 区域节点清单（${poolNodes.length}）`}>
        {poolNodes.length === 0 ? (
          <EmptyState
            icon="🖥️"
            title="该区域此机型暂无节点"
            hint="可切换到该机型已上架的区域查看"
          />
        ) : (
          <Table
            columns={columns}
            rows={poolNodes}
            rowKey={(n) => n.node_uid}
            zebra
            onRowClick={(n) => navigate(`/ops/nodes/${n.node_uid}`)}
          />
        )}
      </Card>

      {!pool.available_in_region && (
        <div className={`${s.notice} ${s.noticeWarn}`} style={{ marginTop: 12 }}>
          <div>
            该机型在 {REGION_META[region].label} 未提供；可用区域：
            {pool.available_regions.map((r) => REGION_META[r].label).join(' / ')}。
          </div>
        </div>
      )}
    </div>
  );
}
