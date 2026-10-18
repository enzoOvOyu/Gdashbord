// LifecycleBadge — 资源生命周期 6 态（DESIGN-SYSTEM §5.18 / §8.2，PRD §5.4）
// 渲染要求：「颜色 + 图标 + 文本」至少两者并存；Terminating 须区别于 Stopped（不可逆）。
import { Badge, type BadgeTone } from '../ui/Badge';

export type LifecycleState =
  | 'provisioning'
  | 'running'
  | 'stopped'
  | 'error'
  | 'terminating'
  | 'deleted';

interface Meta {
  label: string;
  icon: string;
  tone: BadgeTone;
}

export const LIFECYCLE_META: Record<LifecycleState, Meta> = {
  provisioning: { label: 'Provisioning', icon: '⟳', tone: 'info' },
  running: { label: 'Running', icon: '✓', tone: 'success' },
  stopped: { label: 'Stopped', icon: '⏸', tone: 'muted' },
  error: { label: 'Error', icon: '✕', tone: 'danger' },
  terminating: { label: 'Terminating', icon: '⇥', tone: 'terminating' },
  deleted: { label: '已释放', icon: '␡', tone: 'muted' },
};

/** 中文辅助标签（状态语义更明确） */
export const LIFECYCLE_LABEL_ZH: Record<LifecycleState, string> = {
  provisioning: '创建中',
  running: '运行中',
  stopped: '已停止',
  error: '异常',
  terminating: '终止中',
  deleted: '已释放',
};

export function LifecycleBadge({
  status,
  deleted = false,
  showZh = true,
}: {
  status: string;
  deleted?: boolean;
  showZh?: boolean;
}) {
  const key: LifecycleState = deleted ? 'deleted' : (status as LifecycleState);
  const m = LIFECYCLE_META[key] ?? LIFECYCLE_META.provisioning;
  return (
    <Badge tone={m.tone} icon={<span aria-hidden>{m.icon}</span>} strike={key === 'deleted'}>
      {m.label}
      {showZh && ` · ${LIFECYCLE_LABEL_ZH[key]}`}
    </Badge>
  );
}
