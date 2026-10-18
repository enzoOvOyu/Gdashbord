// StateMachineBadge — 节点状态机 5 态（DESIGN-SYSTEM §8.1，PRD §9.3）
// 可访问性：颜色 + 图标 + 文本三者并存（§8.1 表）。
import { Badge, type BadgeTone } from '../ui/Badge';

export type NodeStateKey = 'ready' | 'cordoned' | 'draining' | 'remediation' | 'notready';

interface Meta {
  label: string;
  icon: string;
  meaning: string;
  tone: BadgeTone;
}

export const NODE_STATE_META: Record<NodeStateKey, Meta> = {
  ready: { label: 'Ready', icon: '✓', meaning: '可调度', tone: 'success' },
  cordoned: { label: 'Cordoned', icon: '⛔', meaning: '禁止新调度', tone: 'warning' },
  draining: { label: 'Draining', icon: '↻', meaning: '驱逐负载中', tone: 'info' },
  remediation: { label: 'Remediation', icon: '🛠', meaning: '平台自愈/修复中', tone: 'purple' },
  notready: { label: 'NotReady', icon: '✕', meaning: '异常/失联', tone: 'danger' },
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
