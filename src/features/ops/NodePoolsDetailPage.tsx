// 运营&运维 · 节点池详情（§4.4.1 A 档整页；由 /ops/pools 抽屉进入）
import { t, dt } from '../../i18n';
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
    { key: 'uid', header: t('nav.nodes'), mono: true, render: (n) => n.node_uid },
    { key: 'rack', header: t('common.rack'), mono: true, render: (n) => n.rack_id ?? '—' },
    { key: 'sw', header: t('common.switchGroup'), mono: true, render: (n) => n.switch_group ?? '—' },
    {
      key: 'state',
      header: t('common.status'),
      render: (n) => (
        <span className={s.row} style={{ gap: 6 }}>
          <Badge tone={NODE_STATE_META[n.state]?.tone ?? 'neutral'}>
            {NODE_STATE_META[n.state]?.label.split('（')[0] ?? n.state}
          </Badge>
          {n.straggler && <Badge tone="warning">{t('nodes.slowNode')}</Badge>}
        </span>
      ),
    },
    { key: 'gpu', header: 'GPU', numeric: true, render: (n) => t('common.gpuCountValue', { v0: n.gpu_count }) },
    { key: 'hosted', header: t('pools.bearingResources'), numeric: true, render: (n) => n.hosted_resources },
    { key: 'updated', header: t('common.updatedAt'), render: (n) => formatRelative(n.updated_at) },
    {
      key: 'act',
      header: '',
      width: 88,
      render: (n) => (
        <Button size="sm" variant="ghost" onClick={() => navigate(`/ops/nodes/${n.node_uid}`)}>
          {t('common.details')}
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Card title={t('common.loading')}>
        <div className={s.muted}>{t('pools.loading')}</div>
      </Card>
    );
  }

  if (!pool) {
    return (
      <Card title={t('pools.notFound')}>
        <EmptyState
          icon="🔍"
          title={t('pools.modelNotFound', { v0: code ?? '—' })}
          hint={t('pools.modelNotInRegion', { v0: REGION_META[region].label })}
          action={<Button onClick={() => navigate('/ops/pools')}>{t('common.backToPools')}</Button>}
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
        desc={t('pools.regionScope', { v0: pool.gpu_model, v1: pool.interconnect, v2: REGION_META[region].label })}
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
        <Card title={t('common.capacity')}>
          <KeyValue
            items={[
              { label: t('common.nodeCount'), value: formatNumber(pool.supply?.nodeCount ?? 0) },
              { label: t('common.totalGpu'), value: t('common.gpuCountValue', { v0: formatNumber(total) }) },
              { label: t('common.availableGpu'), value: t('common.gpuCountValue', { v0: formatNumber(avail) }) },
              { label: t('common.allocatedGpu'), value: t('common.gpuCountValue', { v0: formatNumber(pool.supply?.allocatedGpu ?? 0) }) },
            ]}
          />
          <div style={{ marginTop: 8 }}>
            <Progress
              label={t('common.allocRate')}
              value={pool.supply?.allocatedGpu ?? 0}
              max={total}
              right={t('pools.freeGpus', { v0: formatNumber(avail) })}
            />
          </div>
        </Card>
        <Card title={t('common.spec')}>
          <KeyValue
            items={[
              { label: t('pools.modelCode'), value: pool.code, mono: true },
              { label: t('common.gpuModel'), value: pool.gpu_model },
              { label: t('common.memPerGpu'), value: `${pool.vram_gb} GB` },
              { label: t('pools.gpuPerNode'), value: t('common.gpuCountValue', { v0: pool.gpus_per_node }) },
              { label: t('pools.interconnect'), value: pool.interconnect },
              { label: 'CPU', value: dt(pool.platform.cpu) },
              { label: t('pools.localNvme'), value: pool.platform.localNvme },
              { label: t('common.network'), value: pool.platform.network },
            ]}
          />
        </Card>
        <Card title={t('pools.pricing')}>
          <KeyValue
            items={[
              { label: t('unit.gpuHourLong'), value: t('pools.ratePerGpu', { v0: formatUsd(pool.unit_price) }) },
              { label: t('kind.baremetalShort'), value: t('pools.ratePerMachine', { v0: formatUsd(pool.machine_unit_price) }) },
              {
                label: t('pools.marketRange'),
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
              {t('pools.createServer')}
            </Button>
          </div>
        </Card>
      </div>

      <Card title={t('pools.nodeList', { v0: REGION_META[region].label, v1: poolNodes.length })}>
        {poolNodes.length === 0 ? (
          <EmptyState
            icon="🖥️"
            title={t('pools.noNodesForModel')}
            hint={t('pools.noNodesHint')}
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
            {t('pools.modelNotAvailable', { v0: REGION_META[region].label, v1: pool.available_regions.map((r) => REGION_META[r].label).join(' / ') })}</div>
        </div>
      )}
    </div>
  );
}
