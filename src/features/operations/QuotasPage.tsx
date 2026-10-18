// 配额（PRD §4.7 / §7.3：gpu / vcpu / storage_gb / public_ip 水位；used_value 为派生值）
import { useQuery } from '@tanstack/react-query';
import { Card, Badge } from '../../components/ui';
import { ui as s } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { formatNumber } from '../../lib/money';

interface QuotaRow {
  id: number;
  metric: 'gpu' | 'vcpu' | 'storage_gb' | 'public_ip';
  resource_kind: string | null;
  region: string | null;
  limit_value: number;
  used_value: number;
}

const METRIC_LABEL: Record<QuotaRow['metric'], string> = {
  gpu: 'GPU',
  vcpu: 'vCPU',
  storage_gb: '存储（GB）',
  public_ip: '公网 IP',
};

/** 占用口径说明（PRD §7.3，明确避免歧义） */
const OCCUPY_RULE: Record<QuotaRow['metric'], string> = {
  gpu: '占用于 provisioning / running；stopped 释放',
  vcpu: '占用于 provisioning / running；stopped 释放',
  storage_gb: '占用于 provisioning / running / stopped（数据盘保留）',
  public_ip: '持有即占用；终止释放',
};

export default function QuotasPage() {
  const { data: quotas = [] } = useQuery<QuotaRow[]>({
    queryKey: ['quotas'],
    queryFn: () => api.get<QuotaRow[]>(EP.quotas),
  });

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px' }}>配额</h1>
      <p style={{ color: 'var(--rs-text-secondary)', margin: '0 0 24px' }}>
        作用域 (org, resource_kind?, region?)；<code>used_value</code> 为派生值，由占用口径重算，禁止业务代码直写（§7.3）。
      </p>

      <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        {quotas.map((q) => {
          const pct = q.limit_value ? (q.used_value / q.limit_value) * 100 : 0;
          const tone = pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'success';
          return (
            <Card key={q.id} title={METRIC_LABEL[q.metric]}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <strong style={{ fontSize: 28, fontWeight: 700 }}>
                  {formatNumber(q.used_value, q.metric === 'storage_gb' ? 0 : 0)}
                </strong>
                <span className={s.muted}>/ {formatNumber(q.limit_value, 0)}</span>
                <Badge tone={tone} icon={<span>{pct >= 90 ? '⚠' : pct >= 75 ? '⚠' : '✓'}</span>}>
                  {pct.toFixed(0)}%
                </Badge>
              </div>
              <div
                style={{
                  height: 8,
                  background: 'var(--rs-surface-2)',
                  borderRadius: 999,
                  marginTop: 10,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    height: '100%',
                    background:
                      pct >= 90 ? 'var(--rs-danger)' : pct >= 75 ? 'var(--rs-warning)' : 'var(--rs-success)',
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: 'var(--rs-text-muted)', marginTop: 8 }}>
                {OCCUPY_RULE[q.metric]}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
