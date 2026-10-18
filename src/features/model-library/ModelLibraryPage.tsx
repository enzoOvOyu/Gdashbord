// 模型库（PRD §4.8：模型卡片 + 分类筛选 + 收藏 + 一键部署到推理服务）
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, Button, Badge, Input, Select } from '../../components/ui';
import { ui as s } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { formatGb } from '../../lib/money';

interface ModelRow {
  id: number;
  slug: string;
  name: string;
  source: string;
  modality: string;
  param_size: string;
  license: string;
  quantization: string | null;
  description: string;
  weights_gb: number;
  contextTokens: number;
  favorite?: boolean;
}

export default function ModelLibraryPage() {
  const [q, setQ] = useState('');
  const [modality, setModality] = useState('');
  const { data: models = [] } = useQuery<ModelRow[]>({
    queryKey: ['models'],
    queryFn: () => api.get<ModelRow[]>(`${EP.models}?size=100`),
  });

  const list = models.filter(
    (m) =>
      (!q || m.name.toLowerCase().includes(q.toLowerCase()) || m.slug.includes(q.toLowerCase())) &&
      (!modality || m.modality === modality),
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px' }}>模型库</h1>
      <p style={{ color: 'var(--rs-text-secondary)', margin: '0 0 24px' }}>
        来源 HuggingFace 镜像 / 官方 / 社区；权重体积由 params × bytes_per_param 派生（§7.3），用于单卡可行性校验。
      </p>

      <div className={s.row + ' ' + s.mb4}>
        <Input
          placeholder="搜索模型名称…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <Select value={modality} onChange={(e) => setModality(e.target.value)}>
          <option value="">全部模态</option>
          <option value="llm">LLM</option>
          <option value="diffusion">Diffusion</option>
          <option value="embedding">Embedding</option>
          <option value="rerank">Rerank</option>
          <option value="multimodal">Multimodal</option>
        </Select>
        <span className={s.muted} style={{ marginLeft: 'auto', fontSize: 12 }}>
          共 {list.length} 个模型
        </span>
      </div>

      <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
        {list.map((m) => (
          <Card
            key={m.slug}
            title={
              <div className={s.row}>
                <span>{m.name}</span>
                {m.favorite && <Badge color="var(--rs-gold)" icon={<span>★</span>}>收藏</Badge>}
              </div>
            }
            actions={<Badge tone="neutral">{m.source}</Badge>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div style={{ color: 'var(--rs-text-secondary)', minHeight: 36 }}>{m.description}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className={s.secondary}>模态 / 参数</span>
                <strong>{m.modality} · {m.param_size}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className={s.secondary}>权重体积</span>
                <strong>{formatGb(m.weights_gb)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className={s.secondary}>上下文</span>
                <span>{m.contextTokens ? m.contextTokens.toLocaleString('en-US') : '—'} tokens</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className={s.secondary}>许可 / 量化</span>
                <span>{m.license}{m.quantization ? ` · ${m.quantization}` : ''}</span>
              </div>
              <div className={s.row} style={{ marginTop: 4 }}>
                <Link to="/deployment/inference">
                  <Button variant="primary" size="sm">一键部署到推理服务</Button>
                </Link>
                <Button variant="ghost" size="sm" disabled>收藏</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
