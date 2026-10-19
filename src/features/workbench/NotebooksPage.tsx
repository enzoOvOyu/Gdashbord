// 工作台·Notebook / IDE（v0.7 · PRD §4.5.1 · DESIGN §5.10）
// v0.6 仅支持挂靠 GPU 云服务器；v0.7 起为**跨形态开发入口**：可挂靠 GPU 云服务器 / GPU 裸金属 / vGPU 集群。
// 推理服务无 SSH 面，不挂开发环境（仅在工作台提供 Playground 链接）。
// 运行态与费用归「资源」管理；停止/删除 Notebook 不删除宿主资源。
import { t } from '../../i18n';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Code2, ExternalLink, Plus, Trash2 } from 'lucide-react';
import {
  Badge, Button, Card, ConfirmDialog, Drawer, Field, PageHeader, RegionSelect,
  Segmented, Table, Toolbar, toast,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { EP, api, withQuery } from '../../lib/api-client';
import { ui as s } from '../../components/ui';
import { KIND_META, REGION_META } from '../../lib/ids';
import { formatRelative } from '../../lib/date';
import type { NotebookItem, RegionCode, ResourceKind } from '../../types/domain';

type KindFilter = 'all' | ResourceKind;

const STATUS_TONE: Record<string, 'success' | 'warning' | 'info' | 'muted' | 'danger'> = {
  running: 'success',
  provisioning: 'info',
  stopped: 'muted',
  error: 'danger',
};

const STATUS_LABEL: Record<string, () => string> = {
  running: () => t('nb.statusRunning'),
  provisioning: () => t('nb.statusProvisioning'),
  stopped: () => t('nb.statusStopped'),
  error: () => t('nb.statusError'),
};

interface NotebookRow extends NotebookItem {
  /** handler 投影的宿主资源信息 */
  resource_name: string | null;
  resource_uuid?: string;
  resource_display_id?: string;
}

/** 可挂靠宿主资源（推理不挂） */
const ATTACHABLE: ResourceKind[] = ['gpu_vm', 'gpu_baremetal', 'vgpu'];

export default function NotebooksPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [region, setRegion] = useState<RegionCode | 'all'>('all');
  const [kind, setKind] = useState<KindFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<NotebookRow | null>(null);

  // 资源详情页「创建 Notebook」联动：?resource=<uuid> 预填宿主并直接打开新建抽屉
  const presetUuid = params.get('resource');
  useEffect(() => {
    if (presetUuid) setCreateOpen(true);
  }, [presetUuid]);

  const { data: notebooks = [], isLoading } = useQuery<NotebookRow[]>({
    queryKey: ['workbench-notebooks', region, kind],
    queryFn: () =>
      api.get<NotebookRow[]>(
        withQuery(EP.notebooks, { region, resource_kind: kind === 'all' ? undefined : kind }),
      ),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(EP.notebook(id)),
    onSuccess: () => {
      toast.success(t('nb.deleted'));
      setRemoveTarget(null);
      void qc.invalidateQueries({ queryKey: ['workbench-notebooks'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const columns: Array<Column<NotebookRow>> = [
    {
      key: 'name',
      header: t('common.name'),
      render: (r) => <strong style={{ color: 'var(--rs-text)' }}>{r.name}</strong>,
    },
    {
      key: 'ide',
      header: t('nb.fieldIde'),
      render: (r) => (
        <Badge tone={r.ide === 'jupyter' ? 'warning' : 'info'}>
          {r.ide === 'jupyter' ? t('nb.jupyter') : t('nb.vscode')}
        </Badge>
      ),
    },
    {
      key: 'host',
      header: t('nb.fieldHost'),
      render: (r) =>
        r.resource_id && r.resource_kind && r.resource_uuid ? (
          <span>
            <Link to={`/resources/${KIND_META[r.resource_kind].routeKey}/${r.resource_uuid}`}>
              <span className={s.mono}>{r.resource_display_id ?? r.resource_name ?? `#${r.resource_id}`}</span>
            </Link>{' '}
            <Badge tone="muted">{KIND_META[r.resource_kind].label}</Badge>
          </span>
        ) : (
          <span className={s.muted}>{t('wb.unattached')}</span>
        ),
    },
    {
      key: 'region',
      header: t('common.region'),
      render: (r) => <span className={s.secondary}>{REGION_META[r.region]?.label ?? r.region}</span>,
    },
    {
      key: 'gpu',
      header: t('nb.gpu'),
      numeric: true,
      render: (r) => r.gpu_count,
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (r) => (
        <Badge tone={STATUS_TONE[r.status] ?? 'muted'}>{(STATUS_LABEL[r.status] ?? (() => r.status))()}</Badge>
      ),
    },
    {
      key: 'url',
      header: t('wb.accessPath'),
      render: (r) => <span className={s.mono}>{r.url_path}</span>,
    },
    {
      key: 'created',
      header: t('common.createdAt'),
      render: (r) => <span className={s.secondary}>{formatRelative(r.created_at)}</span>,
    },
    {
      key: 'action',
      header: t('common.actions'),
      render: (r) => (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <Button
            size="sm"
            variant="ghost"
            disabled={r.status !== 'running'}
            title={r.status === 'running' ? undefined : t('nb.openDisabled')}
            icon={<ExternalLink size={13} />}
          >
            {t('common.open')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRemoveTarget(r)} icon={<Trash2 size={13} />}>
            {t('common.delete')}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s5)' }}>
      <PageHeader
        title={t('nb.title')}
        desc={t('nb.desc')}
        icon={<Code2 size={18} />}
        actions={
          <>
            <RegionSelect value={region as RegionCode} includeAll onChange={(r) => setRegion(r as RegionCode | 'all')} />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              {t('nb.new')}
            </Button>
          </>
        }
      />

      <Card
        title={t('nb.title')}
        actions={
          <Segmented<KindFilter>
            options={[
              { value: 'all', label: t('sc.filterAll') },
              ...ATTACHABLE.map((k) => ({ value: k, label: KIND_META[k].label })),
            ]}
            value={kind}
            onChange={setKind}
            ariaLabel={t('nb.fieldHost')}
          />
        }
      >
        <p className={s.muted} style={{ marginTop: 0 }}>
          {t('nb.attachHint')}
        </p>
        <Toolbar>
          <RegionSelect value={region as RegionCode} includeAll onChange={(r) => setRegion(r as RegionCode | 'all')} />
        </Toolbar>
        <Table<NotebookRow>
          columns={columns}
          rows={notebooks}
          rowKey={(r) => String(r.id)}
          zebra
          empty={
            <div style={{ padding: 24, textAlign: 'center' }}>
              <p className={s.muted}>{t('nb.empty')}</p>
              <Link to="/deployment/server">
                <Button variant="primary">{t('nb.emptyAction')}</Button>
              </Link>
            </div>
          }
        />
        {isLoading && <p className={s.muted}>{t('common.loading')}</p>}
      </Card>

      <CreateNotebookDrawer
        open={createOpen}
        presetUuid={presetUuid}
        region={region}
        onClose={() => {
          setCreateOpen(false);
          if (presetUuid) {
            const next = new URLSearchParams(params);
            next.delete('resource');
            setParams(next, { replace: true });
          }
        }}
        onCreated={() => {
          setCreateOpen(false);
          toast.success(t('nb.created'));
          void qc.invalidateQueries({ queryKey: ['workbench-notebooks'] });
        }}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title={t('common.delete')}
        description={t('nb.deleted')}
        confirmLabel={t('common.delete')}
        pending={remove.isPending}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && remove.mutate(removeTarget.id)}
      />
    </div>
  );
}

/** 新建 Notebook（PRD §4.5.1 正向流程：选宿主 → 选 IDE → 资源配置） */
function CreateNotebookDrawer({
  open,
  presetUuid,
  region,
  onClose,
  onCreated,
}: {
  open: boolean;
  presetUuid: string | null;
  region: RegionCode | 'all';
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [resourceId, setResourceId] = useState<number | null>(null);
  const [ide, setIde] = useState<'jupyter' | 'vscode'>('jupyter');
  const [storage, setStorage] = useState(200);
  const [autoShutdown, setAutoShutdown] = useState(60);

  const { data: hosts = [] } = useQuery<
    Array<{
      id: number;
      resource_uuid: string;
      display_id: string;
      name: string;
      kind: ResourceKind;
      region: string;
      gpu_count: number;
      status: string;
    }>
  >({
    queryKey: ['attachable-resources'],
    queryFn: () =>
      api.get<
        Array<{
          id: number;
          resource_uuid: string;
          display_id: string;
          name: string;
          kind: ResourceKind;
          region: string;
          gpu_count: number;
          status: string;
        }>
      >('/api/workbench/attachable-resources'),
    enabled: open,
  });

  const visibleHosts = useMemo(
    () => hosts.filter((h) => region === 'all' || h.region === region),
    [hosts, region],
  );

  // 详情页联动预填：?resource=<uuid>
  useEffect(() => {
    if (!open || !presetUuid) return;
    const hit = hosts.find((h) => h.resource_uuid === presetUuid);
    if (hit) {
      setResourceId(hit.id);
      setName((cur) => (cur ? cur : `${hit.name}-nb`));
    }
  }, [open, presetUuid, hosts]);

  const create = useMutation({
    mutationFn: () =>
      api.post(EP.notebooks, {
        name,
        resource_id: resourceId,
        ide,
        storage_mount_gb: storage,
        auto_shutdown_idle_min: autoShutdown,
      }),
    onSuccess: onCreated,
    onError: (e) => toast.error(String(e)),
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t('nb.createTitle')}
      subtitle={presetUuid ? t('nb.prefilledFrom') : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim() || resourceId === null || create.isPending}
            onClick={() => create.mutate()}
          >
            {t('common.create')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label={t('nb.fieldName')} required>
          <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field
          label={t('nb.fieldHost')}
          required
          hint={t('nb.attachHint')}
          error={visibleHosts.length === 0 ? t('nb.emptyNoHost') : undefined}
        >
          <select
            className={s.select}
            value={resourceId ?? ''}
            onChange={(e) => setResourceId(Number(e.target.value) || null)}
          >
            <option value="">{t('nb.fieldHost')}</option>
            {visibleHosts.map((h) => (
              <option key={h.id} value={h.id}>
                {String(h.display_id)} · {h.name} · {KIND_META[h.kind].label} · {h.gpu_count} GPU
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('nb.fieldIde')} required>
          <Segmented<'jupyter' | 'vscode'>
            options={[
              { value: 'jupyter', label: t('nb.jupyter') },
              { value: 'vscode', label: t('nb.vscode') },
            ]}
            value={ide}
            onChange={setIde}
            ariaLabel={t('nb.fieldIde')}
          />
        </Field>

        <Field label={t('nb.fieldStorage')}>
          <input
            className={s.input}
            type="number"
            min={20}
            value={storage}
            onChange={(e) => setStorage(Number(e.target.value))}
          />
        </Field>

        <Field label={t('nb.fieldAutoShutdown')} hint={autoShutdown === 0 ? t('nb.autoShutdownZero') : undefined}>
          <select
            className={s.select}
            value={autoShutdown}
            onChange={(e) => setAutoShutdown(Number(e.target.value))}
          >
            <option value={0}>{t('nb.autoShutdownZero')}</option>
            <option value={30}>{t('nb.opt30')}</option>
            <option value={60}>{t('nb.opt60')}</option>
            <option value={120}>{t('nb.opt120')}</option>
          </select>
        </Field>
      </div>
    </Drawer>
  );
}
