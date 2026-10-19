// 未实现页面的占位（后续阶段替换为正式实现，保持路由完整可导航）
import { t } from '../i18n';
import { Card, EmptyState } from './ui';

export default function ComingSoon({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h1 className="rs-page-title" style={{ fontSize: 24, fontWeight: 600, margin: '0 0 8px' }}>
        {title}
      </h1>
      <Card>
        <EmptyState
          icon="🚧"
          title={t('cs.title')}
          hint={hint ?? t('cs.desc')}
        />
      </Card>
    </div>
  );
}
