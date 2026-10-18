// 运营&运维 · 配额（§4.4.1 C 档：行内展开显示占用明细）
// used_value 为派生值（由资源占用重算），业务代码不得直写（ARCH §12.8）。
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  ui as s,
  Card,
  Table,
  Progress,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  RegionSelect,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { formatNumber } from '../../lib/money';
import { REGION_META } from '../../lib/ids';
import { usePageRegion, useQuotas } from '../shared/api';

const METRIC_LABEL: Record<string, { label: string; unit: string }> = {
  gpu: { label: 'GPU 卡数', unit: '卡' },
  vcpu: { label: 'vCPU', unit: '核' },
  storage_gb: { label: '块存储', unit: 'GB' },
  public_ip: { label: '公网 IP', unit: '个' },
};

export default function QuotasPage() {
  const navigate = useNavigate();
  const [region, setRegion] = usePageRegion();
  const [open, setOpen] = useState<string | null>(null);
  const { data: quotas = [], isLoading } = useQuotas(region);

  const holderCols: Array<Column<{ uuid: string; name: string; used: number }>> = [
    { key: 'name', header: '占用资源', render: (h) => h.name },
    { key: 'uuid', header: '资源 UUID', mono: true, render: (h) => h.uuid },
    { key: 'used', header: '占用量', numeric: true, render: (h) => formatNumber(h.used, 2) },
    {
      key: 'act',
      header: '',
      width: 88,
      render: (h) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const q = quotas.find((x) => x.holders.some((y) => y.uuid === h.uuid));
            if (q) navigate(`/resources/all/${h.uuid}`);
          }}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="配额"
        desc={`${REGION_META[region].label} 区域配额水位，占用量由该区域资源实时派生；切换区域后数据重算（stopped 释放算力、保留存储，PRD §7.3）。`}
        actions={
          <span className={s.row}>
            <Button variant="secondary" onClick={() => navigate('/ops/tickets')}>
              申请提升配额
            </Button>
            <RegionSelect value={region} onChange={setRegion} />
          </span>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        {isLoading
          ? null
          : quotas.map((q) => {
              const pct = q.limit_value > 0 ? (q.used_value / q.limit_value) * 100 : 0;
              return (
                <Card key={String(q.id)} title={METRIC_LABEL[q.metric]?.label ?? q.metric}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>
                    {formatNumber(q.used_value, 0)}
                    <span style={{ fontSize: 13, color: 'var(--rs-text-muted)' }}>
                      {' '}
                      / {formatNumber(q.limit_value, 0)} {METRIC_LABEL[q.metric]?.unit ?? ''}
                    </span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Progress
                      value={q.used_value}
                      max={q.limit_value}
                      right={`${pct.toFixed(1)}%`}
                    />
                  </div>
                  {pct >= 90 && (
                    <div style={{ marginTop: 6 }}>
                      <Badge tone="danger">接近上限，新建资源可能被拒</Badge>
                    </div>
                  )}
                </Card>
              );
            })}
      </div>

      {isLoading ? (
        <div className={s.muted}>加载中…</div>
      ) : quotas.length === 0 ? (
        <EmptyState icon="📊" title="该区域暂无配额记录" hint="切换区域查看" />
      ) : (
        <Card title="占用明细（点击行展开，查看被哪些资源占用）">
          <div style={{ border: '1px solid var(--rs-border)', borderRadius: 8 }}>
            {quotas.map((q) => {
              const key = String(q.id);
              const isOpen = open === key;
              return (
                <div key={key} style={{ borderBottom: '1px solid var(--rs-border)' }}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : key)}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: '28px minmax(140px,1fr) 1fr 140px 96px',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      background: 'var(--rs-bg)',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 13,
                    }}
                  >
                    <span>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                    <b>{METRIC_LABEL[q.metric]?.label ?? q.metric}</b>
                    <span>
                      <Progress value={q.used_value} max={q.limit_value} />
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      {formatNumber(q.used_value, 0)} / {formatNumber(q.limit_value, 0)}
                    </span>
                    <span style={{ textAlign: 'right', color: 'var(--rs-text-muted)' }}>
                      {q.holders.length} 个占用方
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 12px 12px', background: 'var(--rs-surface)' }}>
                      {q.holders.length === 0 ? (
                        <div className={s.muted} style={{ fontSize: 12 }}>
                          该区域当前无资源占用此项配额
                        </div>
                      ) : (
                        <Table
                          columns={holderCols}
                          rows={q.holders}
                          rowKey={(h) => h.uuid}
                        />
                      )}
                      <div className={s.muted} style={{ fontSize: 11, marginTop: 6 }}>
                        占用口径（§7.3）：gpu/vcpu 仅 provisioning|running 占用；storage_gb 含
                        stopped；terminating/已删除立即释放。
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
