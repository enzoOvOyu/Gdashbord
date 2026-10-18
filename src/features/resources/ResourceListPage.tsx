// 资源列表（PRD §4.3：按资源类型 4 类各自独立列表；§5.2 仅在此陈列，不重复于其他模块）
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Card, Button, Badge, Table, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { LifecycleBadge } from '../../components/state-machine';
import { kindOfRouteKey, KIND_META, NODE_POOL_LABEL, REGION_META } from '../../lib/ids';
import { EP, api } from '../../lib/api-client';
import { useRegionStore } from '../../stores/auth';
import { formatUsd } from '../../lib/money';
import { isResourceReadOnly } from '../../lib/rbac';
import { useAuthStore } from '../../stores/auth';
import { ui as s } from '../../components/ui';
import type { RegionCode, ResourceKind } from '../../types/domain';

interface Row {
  resource_uuid: string;
  display_id: string;
  kind: ResourceKind;
  name: string;
  region: RegionCode;
  node_pool: keyof typeof NODE_POOL_LABEL;
  gpu_count: number;
  storage_gb: number;
  status: string;
  cost_per_hour: number;
  spec_json: Record<string, unknown>;
  deleted_at: string | null;
}

export default function ResourceListPage() {
  const { routeKey = '' } = useParams();
  const kind = kindOfRouteKey(routeKey);
  const region = useRegionStore((st) => st.region);
  const role = useAuthStore((st) => st.role);
  const readOnly = isResourceReadOnly(role);

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ['resources', kind, region],
    queryFn: () => api.get<Row[]>(`${EP.resources}?kind=${kind}&region=${region}&size=100`),
    enabled: Boolean(kind),
  });

  if (!kind) return <Navigate to="/overview" replace />;
  const meta = KIND_META[kind];

  // 各类型的列表列（PRD §4.3.1–4.3.4）
  const columns: Array<Column<Row>> = [
    {
      key: 'id',
      header: '标识 / 名称',
      render: (r) => (
        <Link
          to={`/resources/${routeKey}/${r.resource_uuid}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{meta.icon}</span>
            <span className={s.mono} style={{ fontSize: 13 }}>{r.display_id}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--rs-text-muted)' }}>{r.name}</div>
        </Link>
      ),
    },
    {
      key: 'region',
      header: '区域 / 节点池',
      render: (r) => (
        <div>
          <div>{REGION_META[r.region]?.label ?? r.region} {REGION_META[r.region]?.iso}</div>
          <div style={{ fontSize: 12, color: 'var(--rs-text-muted)' }}>
            {NODE_POOL_LABEL[r.node_pool] ?? r.node_pool}
          </div>
        </div>
      ),
    },
    {
      key: 'spec',
      header: kind === 'vgpu' ? '节点数 / GPU' : 'GPU',
      render: (r) => {
        const sp = r.spec_json as Record<string, number | string>;
        if (kind === 'vgpu') {
          return (
            <div>
              <div>{String(sp.node_count ?? '-')} 节点</div>
              <div style={{ fontSize: 12, color: 'var(--rs-text-muted)' }}>{r.gpu_count} GPU</div>
            </div>
          );
        }
        if (kind === 'inference') {
          return (
            <div>
              <div>{r.gpu_count} GPU · {String(sp.replicas ?? '-')} 副本</div>
              <div style={{ fontSize: 12, color: 'var(--rs-text-muted)' }}>{String(sp.model_ref ?? '')}</div>
            </div>
          );
        }
        return (
          <div>
            <div>{r.gpu_count} × {String(sp.gpu_model ?? meta.label)}</div>
            <div style={{ fontSize: 12, color: 'var(--rs-text-muted)' }}>
              {String(sp.vcpu ?? '-')} vCPU · {String(sp.memory_gb ?? '-')} GB
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: '状态',
      render: (r) => <LifecycleBadge status={r.status} deleted={Boolean(r.deleted_at)} showZh={false} />,
    },
    {
      key: 'cost',
      header: '$/时',
      numeric: true,
      mono: true,
      render: (r) => (r.status === 'running' ? formatUsd(r.cost_per_hour) : <span className={s.muted}>—</span>),
    },
    {
      key: 'actions',
      header: '操作',
      render: (r) => (
        <div className={s.row}>
          <Link to={`/resources/${routeKey}/${r.resource_uuid}`}>
            <Button size="sm" variant="ghost">详情</Button>
          </Link>
          {!readOnly && r.status === 'running' && (
            <Button size="sm" variant="secondary" disabled title="演示环境不执行真实操作">
              停止
            </Button>
          )}
          {!readOnly && (
            <Button size="sm" variant="ghost" disabled title={readOnly ? '当前角色只读' : undefined}>
              删除
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 24 }}>{meta.icon}</span>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{meta.label}</h1>
        <Badge color={meta.colorVar}>资源</Badge>
      </div>
      <p style={{ color: 'var(--rs-text-secondary)', margin: '0 0 24px' }}>
        创建完成的资源实例唯一归属此菜单（PRD §5.2）；当前区域 {REGION_META[region].label}。
      </p>

      <Card title={`${meta.label}列表`} tight>
        {isLoading ? (
          <div style={{ padding: 24, color: 'var(--rs-text-muted)' }}>加载中…</div>
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.resource_uuid}
            zebra
            empty={
              <EmptyState
                icon={meta.icon}
                title={`暂无${meta.label}`}
                hint="可从部署中心创建，创建完成后自动映射到这里。"
                action={
                  <Link to="/deployment/server">
                    <Button variant="primary" size="sm">前往部署中心</Button>
                  </Link>
                }
              />
            }
          />
        )}
      </Card>
    </div>
  );
}
