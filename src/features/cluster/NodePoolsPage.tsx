// 节点池（PRD §4.4 / §9.1：5 类池，容量、可用/已分配、单价；Vast.ai 风格筛选器）
import { useQuery } from '@tanstack/react-query';
import { Card, Badge, Button } from '../../components/ui';
import { ui as s } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { useRegionStore } from '../../stores/auth';
import { REGION_META } from '../../lib/ids';
import { formatUsd } from '../../lib/money';
import { GPU_SPECS, nodeTotalVramGb } from '../../mocks/fixtures/gpu-specs';
import { POOL_REGIONS } from '../../mocks/fixtures/regions-pools';
import type { NodePoolCode } from '../../types/domain';

interface PoolRow {
  code: NodePoolCode;
  display_name: string;
  gpu_model: string;
  gpus_per_node: number;
  vram_gb: number;
  interconnect: string;
  available_regions: string[];
  unit_price_jp: number;
  unit_price_us: number;
  unit_price_sg: number;
  unit_price_th: number;
  supply?: { totalGpu: number; availableGpu: number; nodeCount: number };
}

export default function NodePoolsPage() {
  const region = useRegionStore((st) => st.region);
  const { data: pools = [] } = useQuery<PoolRow[]>({
    queryKey: ['node-pools', region],
    queryFn: () => api.get<PoolRow[]>(`${EP.nodePools}?region=${region}`),
  });

  const priceOf = (p: PoolRow): number =>
    region === 'jp' ? p.unit_price_jp
    : region === 'us' ? p.unit_price_us
    : region === 'sg' ? p.unit_price_sg
    : p.unit_price_th;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px' }}>节点池</h1>
      <p style={{ color: 'var(--rs-text-secondary)', margin: '0 0 24px' }}>
        平台供给侧算力池（5 类）；当前区域 {REGION_META[region].label}，单价 = 基准 × 区域系数（MOCK-DATA §4.2）。
      </p>

      <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
        {pools.map((p) => {
          const spec = GPU_SPECS[p.code];
          const available = POOL_REGIONS[p.code].includes(region);
          const price = priceOf(p);
          const supply = p.supply;
          const tight = supply && supply.totalGpu > 0 && supply.availableGpu / supply.totalGpu < 0.15;
          return (
            <Card
              key={p.code}
              title={
                <div className={s.row}>
                  <span>{p.display_name}</span>
                  {!available && <Badge tone="muted">该区域不可选 · 需申请配额</Badge>}
                  {available && tight && <Badge tone="warning">算力紧张</Badge>}
                </div>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className={s.secondary}>GPU</span>
                  <strong>{p.gpus_per_node} × {p.gpu_model}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className={s.secondary}>显存 / 节点</span>
                  <strong>{nodeTotalVramGb(p.code)} GB（{p.vram_gb} GB × {p.gpus_per_node}）</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className={s.secondary}>互联</span>
                  <span>{p.interconnect}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className={s.secondary}>BF16 dense</span>
                  <span>{(spec.bf16DenseTflops / 1000).toFixed(2)} PFLOPS / 卡</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className={s.secondary}>TDP</span>
                  <span>{spec.tdpW} W / 卡 · {spec.nodePowerKw} kW / 节点</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className={s.secondary}>散热</span>
                  <span>{spec.cooling === 'liquid' ? '液冷' : '风冷'}</span>
                </div>
                {supply && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className={s.secondary}>可用 / 总量</span>
                    <strong>
                      {supply.availableGpu} / {supply.totalGpu} GPU（{supply.nodeCount} 节点）
                    </strong>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--rs-border)',
                  }}
                >
                  <span className={s.secondary}>单价（{REGION_META[region].iso}）</span>
                  <strong style={{ color: 'var(--rs-brand)', fontSize: 18 }}>
                    {formatUsd(price)} <span style={{ fontSize: 12, color: 'var(--rs-text-muted)' }}>/ GPU·时</span>
                  </strong>
                </div>
                <Button variant="primary" size="sm" disabled={!available} style={{ marginTop: 4 }}>
                  {available ? '在该池部署' : '申请配额'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: 'var(--rs-text-muted)', marginTop: 16 }}>
        GB300 NVL72 仅美国可用（§5.4），故在 TH/JP/SG 置灰需申请配额 —— 这是状态栏「算力供给紧张」的真实依据。
      </p>
    </div>
  );
}
