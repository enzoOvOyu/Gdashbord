// AI 应用模板（PRD §4.5）：表单化参数后一键部署，落地到某类资源
import { t, dt } from '../../i18n';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Card, Badge, Button } from '../../components/ui';
import { ui as s } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import type { AppTemplate } from '../../types/domain';

/** 模板 slug → 目标部署类型（模板默认落到 GPU 云服务器，此处由 form_schema 声明覆盖） */
function targetOf(tpl: AppTemplate): string {
  const raw = (tpl.form_schema as Record<string, unknown>)?.target_kind;
  return typeof raw === 'string' ? raw : 'gpu_vm';
}

const TARGET_LABEL: Record<string, string> = {
  get gpu_vm() { return t('kind.server'); },
  get gpu_baremetal() { return t('kind.baremetal'); },
  get vgpu() { return t('kind.vgpu'); },
  get inference() { return t('kind.inference'); },
};

export default function AppTemplatesPage() {
  const navigate = useNavigate();
  const { data: templates = [], isLoading } = useQuery<AppTemplate[]>({
    queryKey: ['app-templates'],
    queryFn: () => api.get<AppTemplate[]>(EP.appTemplates),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s5)' }}>
      <Card
        title={t('dev.templates')}
        actions={isLoading ? <Badge tone="info">{t('common.loading')}</Badge> : <Badge tone="muted">{t('dev.templateCount', { v0: templates.length })}</Badge>}
      >
        <p className={s.muted} style={{ marginTop: 0 }}>
          {t('dev.templateHint')}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 'var(--rs-s4)',
          }}
        >
          {templates.map((tpl) => (
            <div
              key={tpl.slug}
              style={{
                border: '1px solid var(--rs-border)',
                borderRadius: 'var(--rs-r-md)',
                padding: 'var(--rs-s4)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--rs-s2)',
                background: 'var(--rs-surface)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rs-s2)' }}>
                <Sparkles size={16} color="var(--rs-brand)" />
                <strong style={{ color: 'var(--rs-text)', fontSize: 'var(--rs-fs-md)' }}>{dt(tpl.name)}</strong>
              </div>
              <span className={s.mono}>{tpl.slug}</span>
              <div className={s.row}>
                <Badge tone="purple">{tpl.category}</Badge>
                <Badge tone="info">{t('deploy.landOn', { v0: TARGET_LABEL[targetOf(tpl)] ?? t('kind.server') })}</Badge>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 'var(--rs-s3)' }}>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<ArrowRight size={13} />}
                  onClick={() => navigate(`/deployment/${targetOf(tpl)}`)}
                >
                  {t('dev.oneClickDeploy')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
