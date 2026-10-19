// 运营&运维·项目（v0.7 · PRD §3.5 / §3.5.1 / §4.4.1）
// 项目自用户菜单迁入本页：竞品风格项目卡片网格 + 六 Tab 整页详情；账号菜单仅保留快速切换。
// 项目是成本归集与配额分摊的第一维度，创建资源时必填（ARCH §12.10.2）。
import { t } from '../../i18n';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FolderKanban, Plus, Trash2 } from 'lucide-react';
import {
  Badge, Button, Card, ConfirmDialog, Drawer, Field, PageHeader, Progress,
  RegionSelect, toast,
} from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { ui as s } from '../../components/ui';
import { KIND_META, REGION_META } from '../../lib/ids';
import { formatUsd } from '../../lib/money';
import { formatRelative } from '../../lib/date';
import type { ProjectSummary, RegionCode } from '../../types/domain';

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ProjectSummary | null>(null);

  const { data: rows = [], isLoading } = useQuery<ProjectSummary[]>({
    queryKey: ['project-summaries'],
    queryFn: () => api.get<ProjectSummary[]>('/api/projects/summaries'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(EP.project(id)),
    onSuccess: () => {
      toast.success(t('pr.deleted'));
      setRemoveTarget(null);
      void qc.invalidateQueries({ queryKey: ['project-summaries'] });
      void qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s5)' }}>
      <PageHeader
        title={t('pr.title')}
        desc={t('pr.desc')}
        icon={<FolderKanban size={18} />}
        actions={
          <>
            {/* 项目页非区域维度：区域控件禁用 + tooltip 说明，不做假控件（PRD §4.4.1） */}
            <RegionSelect
              value="jp"
              onChange={() => undefined}
              disabledReason={t('pr.regionDisabledHint')}
            />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              {t('pr.new')}
            </Button>
          </>
        }
      />

      <div className={s.cardGrid}>
        {rows.map((p) => (
          <Card
            key={p.id}
            title={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {p.name}
                {p.is_default && <Badge tone="info">{t('pr.default')}</Badge>}
              </span>
            }
            actions={
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <Link to={`/ops/projects/${p.id}`}>
                  <Button size="sm" variant="ghost">
                    {t('pr.viewDetail')}
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={p.is_default || p.gpu_total > 0}
                  title={p.is_default ? t('pr.default') : p.gpu_total > 0 ? t('pr.deleteBlocked') : undefined}
                  onClick={() => setRemoveTarget(p)}
                  icon={<Trash2 size={13} />}
                >
                  {t('pr.delete')}
                </Button>
              </span>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div className={s.muted} style={{ fontSize: 12 }}>
                    {t('pr.cardGpu')}
                  </div>
                  <strong style={{ fontSize: 20 }}>
                    {p.gpu_running}
                    <span className={s.muted} style={{ fontSize: 13 }}>
                      {' '}
                      / {p.gpu_total}
                    </span>
                  </strong>
                </div>
                <div>
                  <div className={s.muted} style={{ fontSize: 12 }}>
                    {t('pr.cardResources')}
                  </div>
                  <strong style={{ fontSize: 20 }}>{Object.values(p.kind_counts).reduce((a, b) => a + b, 0)}</strong>
                </div>
                <div>
                  <div className={s.muted} style={{ fontSize: 12 }}>
                    {t('pr.cardCost')}
                  </div>
                  <strong style={{ fontSize: 20 }}>{formatUsd(p.cost_mtd)}</strong>
                </div>
                <div>
                  <div className={s.muted} style={{ fontSize: 12 }}>
                    {t('pr.members')}
                  </div>
                  <strong style={{ fontSize: 20 }}>{p.member_count}</strong>
                </div>
              </div>

              <Progress
                value={p.quota_usage_pct}
                max={100}
                label={t('pr.cardQuota')}
                right={`${p.quota_usage_pct}%`}
              />

              <div className={s.muted} style={{ fontSize: 12 }}>
                {Object.entries(p.kind_counts)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `${KIND_META[k as keyof typeof KIND_META].label} × ${v}`)
                  .join(' · ') || t('pr.noResource')}
              </div>

              <div className={s.muted} style={{ fontSize: 12 }}>
                {t('pr.fieldRegion')}: {REGION_META[p.default_region]?.label ?? p.default_region} ·{' '}
                {t('common.createdAt')} {formatRelative(p.created_at)}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {isLoading && <p className={s.muted}>{t('common.loading')}</p>}

      <CreateProjectDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          toast.success(t('pr.created'));
          void qc.invalidateQueries({ queryKey: ['project-summaries'] });
          void qc.invalidateQueries({ queryKey: ['projects'] });
        }}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title={t('pr.delete')}
        description={t('pr.deleteBlocked')}
        confirmLabel={t('pr.delete')}
        pending={remove.isPending}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && remove.mutate(removeTarget.id)}
      />
    </div>
  );
}

function CreateProjectDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [region, setRegion] = useState<RegionCode>('jp');

  const create = useMutation({
    mutationFn: () => api.post(EP.projects, { name, default_region: region }),
    onSuccess: onCreated,
    onError: (e) => toast.error(String(e)),
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t('pr.new')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {t('common.create')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label={t('pr.fieldName')} required hint={t('pr.overviewHint')}>
          <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('pr.fieldRegion')}>
          <RegionSelect value={region} onChange={setRegion} />
        </Field>
      </div>
    </Drawer>
  );
}
