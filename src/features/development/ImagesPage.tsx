// 镜像商城（PRD §4.5：官方/社区镜像卡片，一键用作 GPU 云服务器/推理服务基础）
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, Button, Badge } from '../../components/ui';
import { ui as s } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { formatGb } from '../../lib/money';

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

export default function ImagesPage() {
  const { data: images = [] } = useQuery<ImageRow[]>({
    queryKey: ['images'],
    queryFn: () => api.get<ImageRow[]>(EP.images),
  });

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 4px' }}>镜像商城</h1>
      <p style={{ color: 'var(--rs-text-secondary)', margin: '0 0 24px' }}>
        开发（辅助）模块：只分发镜像，不当作资源陈列；产物须经「创建/购买」转化为四类之一（PRD §6.3）。
      </p>

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
                <strong>cuda {im.cuda_version} · {formatGb(im.size_gb)}</strong>
              </div>
              <div className={s.row} style={{ marginTop: 4 }}>
                <Link to="/deployment/server">
                  <Button variant="primary" size="sm">用于 GPU 云服务器</Button>
                </Link>
                <Link to="/deployment/inference">
                  <Button variant="ghost" size="sm">用于推理服务</Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
