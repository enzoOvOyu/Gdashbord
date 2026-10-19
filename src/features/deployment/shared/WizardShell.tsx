// 向导骨架（PRD §4.2.0：左侧步骤导航 + 中部表单 + 右侧费用明细悬浮卡）
import { t } from '../../../i18n';
import type { ReactNode } from 'react';
import {
  ui as s,
  Card,
  Button,
  Badge,
  Select,
  PageHeader,
} from '../../../components/ui';
import { formatUsd } from '../../../lib/money';
import { KIND_META, KIND_ICON } from '../../../lib/ids';
import type { ResourceKind } from '../../../types/domain';
import {
  DISCOUNT_OPTIONS,
  type PriceEstimate,
  type DiscountKey,
} from './pricing';

export type { PriceEstimate, DiscountKey };

export function WizardShell({
  kind,
  steps,
  current,
  onJump,
  price,
  discount,
  onDiscount,
  onSubmit,
  submitting,
  children,
}: {
  kind: ResourceKind;
  steps: string[];
  current: number;
  onJump: (i: number) => void;
  price: PriceEstimate;
  discount: DiscountKey;
  onDiscount: (d: DiscountKey) => void;
  onSubmit: () => void;
  submitting: boolean;
  children: ReactNode;
}) {
  const meta = KIND_META[kind];
  const Icon = KIND_ICON[kind];
  const last = current === steps.length - 1;
  return (
    <div>
      <PageHeader
        title={
          <span className={s.row}>
            <Icon size={20} />
            {t('deploy.createKind', { v0: meta.label })}
          </span>
        }
        desc={t('deploy.shellHint')}
      />
      <div className={s.wizard}>
        <div className={s.wizardSteps}>
          {steps.map((name, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <button
                key={name}
                type="button"
                disabled={i > current}
                className={`${s.wizardStep} ${active ? s.wizardStepActive : ''} ${
                  done ? s.wizardStepDone : ''
                }`}
                onClick={() => onJump(i)}
              >
                <span
                  className={`${s.wizardStepIndex} ${active ? s.wizardStepIndexActive : ''} ${
                    done ? s.wizardStepIndexDone : ''
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                {name}
              </button>
            );
          })}
        </div>

        <div className={s.wizardMain}>
          <Card>
            <div className={s.cardHeader}>
              <div className={s.cardTitle}>
                {t('deploy.stepProgress', { v0: current + 1, v1: steps.length, v2: steps[current] })}
              </div>
            </div>
            <div className={s.cardBody}>{children}</div>
          </Card>
          <div className={s.wizardNav}>
            <Button
              variant="secondary"
              disabled={current === 0}
              onClick={() => onJump(current - 1)}
            >
              {t('common.prev')}
            </Button>
            {last ? (
              <Button variant="primary" onClick={onSubmit} disabled={submitting}>
                {submitting ? t('common.creating') : t('common.create')}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => onJump(current + 1)}>
                {t('common.next')}
              </Button>
            )}
          </div>
        </div>

        <div className={s.priceCard}>
          <Card>
            <div className={s.cardHeader}>
              <div className={s.cardTitle}>{t('deploy.costDetail')}</div>
            </div>
            <div className={s.cardBody}>
              {price.lines.length === 0 ? (
                <div className={s.muted}>{t('deploy.costAfterSelect')}</div>
              ) : (
                price.lines.map((l) => (
                  <div className={s.priceLine} key={l.label}>
                    <span className={s.priceLineLabel}>
                      {l.label}
                      <br />
                      <span style={{ fontSize: 11 }}>{l.detail}</span>
                    </span>
                    <span>{t('common.perHour', { v0: formatUsd(l.hourly) })}</span>
                  </div>
                ))
              )}
              <div className={s.priceTotal}>
                <span>{t('common.total')}</span>
                <span>
                  {t('common.perHour', { v0: formatUsd(price.hourly) })}
                  <br />
                  <span className={s.muted} style={{ fontSize: 12 }}>
                    {t('common.perMonth', { v0: formatUsd(price.monthly) })}
                  </span>
                </span>
              </div>
              {/* v0.7 §4.2.6.3：开启弹性伸缩后给出保底（min）/ 峰值（max）双档月度预估 */}
              {price.floorMonthly !== null && price.peakMonthly !== null && (
                <div style={{ marginTop: 8 }}>
                  <div className={s.priceLine}>
                    <span className={s.priceLineLabel}>{t('deploy.floorBand')}</span>
                    <span>{t('common.perMonth', { v0: formatUsd(price.floorMonthly) })}</span>
                  </div>
                  <div className={s.priceLine}>
                    <span className={s.priceLineLabel}>{t('deploy.peakBand')}</span>
                    <span>{t('common.perMonth', { v0: formatUsd(price.peakMonthly) })}</span>
                  </div>
                  <div className={s.muted} style={{ fontSize: 11 }}>
                    {t('deploy.bandHint')}
                  </div>
                </div>
              )}
              <div className={s.field} style={{ marginTop: 12 }}>
                <label className={s.fieldLabel}>{t('deploy.billingMode')}</label>
                <Select
                  value={discount}
                  onChange={(e) => onDiscount(e.target.value as DiscountKey)}
                >
                  {DISCOUNT_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </div>
              {discount === 'spot' && (
                <div className={s.muted} style={{ fontSize: 11, marginTop: 6 }}>
                  {t('price.spotWarn')}
                </div>
              )}
              <Badge tone="muted">{t('deploy.priceDerived')}</Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
