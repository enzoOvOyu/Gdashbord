// 未实现页面的占位（后续阶段替换为正式实现，保持路由完整可导航）
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
          title="该页面正在按设计文档实现中"
          hint={hint ?? 'PRD/ARCHITECTURE/DESIGN-SYSTEM/MOCK-DATA 规范已在基础层与资源模块落地，本页将在后续阶段补齐。'}
        />
      </Card>
    </div>
  );
}
