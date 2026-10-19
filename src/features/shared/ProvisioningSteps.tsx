// 供给子步骤（PRD §5.3 / MOCK-DATA §5.1：步骤名按资源类型区分）
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { ui as s } from '../../components/ui';
import { dt } from '../../i18n';
import type { ProvisioningStep } from '../../types/domain';

const ICON = {
  done: <CheckCircle2 size={15} color="var(--rs-success)" />,
  running: <Loader2 size={15} color="var(--rs-brand)" className="spin" />,
  pending: <Circle size={15} color="var(--rs-text-muted)" />,
  failed: <XCircle size={15} color="var(--rs-danger)" />,
  skipped: <Circle size={15} color="var(--rs-text-muted)" />,
} as const;

export function ProvisioningSteps({ steps }: { steps: ProvisioningStep[] }) {
  if (!steps || steps.length === 0) return null;
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map((st) => (
        <li key={st.id} className={s.row} style={{ alignItems: 'flex-start' }}>
          <span style={{ paddingTop: 2 }}>{ICON[st.state]}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ color: st.state === 'pending' ? 'var(--rs-text-muted)' : undefined }}>
              {dt(st.step_key)}
            </span>
            {st.message && (
              <div className={s.muted} style={{ fontSize: 12 }}>
                {dt(st.message)}
              </div>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
