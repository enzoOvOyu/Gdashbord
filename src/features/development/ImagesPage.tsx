// 镜像商城（PRD §4.5：官方/社区镜像卡片；v0.6 模型卡片并入本页，作为推理服务模型来源）
// 开发（辅助）模块：只分发镜像与模型卡片，不当作资源陈列；产物须经"创建/购买"转化为四类之一（§6.3）。
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Card,
  Button,
  Badge,
  PageHeader,
  RegionSelect,
  EmptyState,
  ui as s,
} from '../../components/ui';
import { EP, api, withQuery } from '../../lib/api-client';
import { formatGb } from '../../lib/money';
import { NODE_POOL_LABEL } from '../../lib/ids';
import type { NodePoolCode } from '../../types/domain';

interface ImageRow {
  id: number;
  name: string;
  registry: string;
  tag: string;
  framework: string;
  cuda_version: string;
  size_gb: number;
  is_official: boolean;
}

interface ModelRow {
  id: number;
  slug: string;
  name: string;
  source: 'hf_mirror' | 'official' | 'community';
  modality: string;
  paramsBillion: number;
  precision: string;
  license: string;
  quantization: string | null;
  description: string;
  contextTokens: number;
  recommendedPools: NodePoolCode[];
  minTp: number;
  weights_gb: number;
  favorite?: boolean;
}

const MODALITY_LABEL: Record<string, string> = {
  llm: 'LLM',
  multimodal: '多模态',
  diffusion: '文生图',
  embedding: '向量',
  rerank: '重排序',
};

export default function ImagesPage() {
  const { data: images = [] } = useQuery<ImageRow[]>({
    queryKey: ['images'],
    queryFn: () => api.get<ImageRow[]>(EP.images),
  });
  const { data: models = [] } = useQuery<ModelRow[]>({
    queryKey: ['models'],
    queryFn: () => api.get<ModelRow[]>(withQuery(EP.models, { size: 100 })),
  });

  return (
    <div>
      <PageHeader
        title="镜像商城"
        desc="开发（辅助）模块：容器镜像 + 模型卡片。模型卡片只作为推理服务的选型来源，不单独陈列为一类资源。"
        actions={
          <RegionSelect
            value="jp"
            onChange={() => undefined}
            disabledReason="镜像与模型为全局分发，不按区域切分"
          />
        }
      />

      <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
        {images.map((im) => (
          <Card
            key={im.id}
            title={
              <div className={s.row}>
                <span>{im.name}</span>
                {im.is_official && <Badge color="var(--rs-gold)" icon={<span>★</span>}>官方</Badge>}
              </div>
            }
            actions={<Badge tone="neutral">{im.framework}</Badge>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div className={s.mono} style={{ fontSize: 12, color: 'var(--rs-text-secondary)' }}>
                {im.registry}:{im.tag}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className={s.secondary}>CUDA / 体积</span>
                <strong>
                  cuda {im.cuda_version} · {formatGb(im.size_gb)}
                </strong>
              </div>
              <div className={s.row} style={{ marginTop: 4 }}>
                <Link to="/deployment/server">
                  <Button variant="primary" size="sm">
                    用于 GPU 云服务器
                  </Button>
                </Link>
                <Link to="/deployment/baremetal">
                  <Button variant="ghost" size="sm">
                    用于裸金属
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className={s.sectionTitle} style={{ margin: '24px 0 12px' }}>
        模型卡片（并入镜像商城，原「模型库」菜单已删除）
      </div>
      {models.length === 0 ? (
        <EmptyState icon="🧠" title="暂无模型卡片" />
      ) : (
        <div className={s.grid} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
          {models.map((m) => (
            <Card
              key={m.slug}
              title={
                <div className={s.row}>
                  <span>{m.name}</span>
                  {m.favorite && <Badge color="var(--rs-gold)" icon={<span>★</span>}>常用</Badge>}
                </div>
              }
              actions={<Badge tone="neutral">{MODALITY_LABEL[m.modality] ?? m.modality}</Badge>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div className={s.muted} style={{ fontSize: 12 }}>
                  {m.description}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className={s.secondary}>参数量 / 精度</span>
                  <strong>
                    {m.paramsBillion}B · {m.precision.toUpperCase()}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className={s.secondary}>权重体积（派生）</span>
                  <strong>{formatGb(m.weights_gb)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className={s.secondary}>推荐机型 / 最小 TP</span>
                  <strong>
                    {m.recommendedPools.map((p) => NODE_POOL_LABEL[p]).join('、')} · {m.minTp} 卡
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className={s.secondary}>上下文 / 许可</span>
                  <strong>
                    {m.contextTokens > 0 ? `${m.contextTokens} tokens` : '—'} · {m.license}
                  </strong>
                </div>
                <Link to={`/deployment/inference?model=${m.slug}`} style={{ marginTop: 4 }}>
                  <Button variant="primary" size="sm">
                    用于推理服务
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
