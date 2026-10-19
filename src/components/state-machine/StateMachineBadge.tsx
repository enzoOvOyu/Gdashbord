// StateMachineBadge — 节点状态机 5 态（DESIGN-SYSTEM §8.1，PRD §9.3）
// 可访问性：颜色 + 图标 + 文本三者并存（§8.1 表）。
import { t } from '../../i18n';
import { Badge, type BadgeTone } from '../ui/Badge';

export type NodeStateKey = 'ready' | 'cordoned' | 'draining' | 'remediation' | 'notready';

interface Meta {
  label: string;
  icon: string;
  meaning: string;
  tone: BadgeTone;
}

export const NODE_STATE_META: Record<NodeStateKey, Meta> = {
  ready: { label: 'Ready', icon: '✓', get meaning() { return t('sm.ready'); }, tone: 'success' },
  cordoned: { label: 'Cordoned', icon: '⛔', get meaning() { return t('sm.cordoned'); }, tone: 'warning' },
  draining: { label: 'Draining', icon: '↻', get meaning() { return t('sm.draining'); }, tone: 'info' },
  remediation: { label: 'Remediation', icon: '🛠', get meaning() { return t('sm.remediation'); }, tone: 'purple' },
  notready: { label: 'NotReady', icon: '✕', get meaning() { return t('sm.notReady'); }, tone: 'danger' },
};

export const NODE_STATE_LIST = Object.keys(NODE_STATE_META) as NodeStateKey[];

export function StateMachineBadge({
  state,
  straggler,
  showMeaning = true,
}: {
  state: string;
  straggler?: boolean;
  showMeaning?: boolean;
}) {
  const m = NODE_STATE_META[state as NodeStateKey] ?? NODE_STATE_META.notready;
  return (
    <Badge tone={m.tone} icon={<span aria-hidden>{m.icon}</span>}>
      {m.label}
      {showMeaning && ` · ${m.meaning}`}
      {straggler && ' · ⚠ straggler'}
    </Badge>
  );
}
