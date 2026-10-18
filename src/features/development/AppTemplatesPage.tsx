// AI 应用模板（PRD §4.5）：表单化参数后一键部署，落地到某类资源
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Card, Badge, Button } from '../../components/ui';
import { ui as s } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import type { AppTemplate } from '../../types/domain';

/** 模板 slug → 目标部署类型（模板默认落到 GPU 云服务器，此处由 form_schema 声明覆盖） */
function targetOf(t: AppTemplate): string {
  const raw = (t.form_schema as Record<string, unknown>)?.target_kind;
  return typeof raw === 'string' ? raw : 'gpu_vm';
}

const TARGET_LABEL: Record<string, string> = {
  gpu_vm: 'GPU 云服务器',
  gpu_baremetal: 'GPU 裸金属',
  vgpu: 'vGPU 集群',
  inference: '推理服务',
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
        title="AI 应用模板"
        actions={isLoading ? <Badge tone="info">加载中…</Badge> : <Badge tone="muted">{templates.length} 个模板</Badge>}
      >
        <p className={s.muted} style={{ marginTop: 0 }}>
          选择模板后进入对应部署向导，参数已预置；提交后落为资源实例。
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 'var(--rs-s4)',
          }}
        >
          {templates.map((t) => (
            <div
              key={t.slug}
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
                <strong style={{ color: 'var(--rs-text)', fontSize: 'var(--rs-fs-md)' }}>{t.name}</strong>
              </div>
              <span className={s.mono}>{t.slug}</span>
              <div className={s.row}>
                <Badge tone="purple">{t.category}</Badge>
                <Badge tone="info">落到 {TARGET_LABEL[targetOf(t)] ?? 'GPU 云服务器'}</Badge>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 'var(--rs-s3)' }}>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<ArrowRight size={13} />}
                  onClick={() => navigate(`/deployment/${targetOf(t)}`)}
                >
                  一键部署
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
