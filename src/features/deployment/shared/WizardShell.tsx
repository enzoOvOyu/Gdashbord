// 向导骨架（PRD §4.2.0：左侧步骤导航 + 中部表单 + 右侧费用明细悬浮卡）
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
            新建 {meta.label}
          </span>
        }
        desc="左侧步骤可点跳已完成步；右侧费用明细随配置即时重算（取价来自 billing_rates）。"
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
                第 {current + 1} / {steps.length} 步 · {steps[current]}
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
              上一步
            </Button>
            {last ? (
              <Button variant="primary" onClick={onSubmit} disabled={submitting}>
                {submitting ? '创建中…' : '创建'}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => onJump(current + 1)}>
                下一步
              </Button>
            )}
          </div>
        </div>

        <div className={s.priceCard}>
          <Card>
            <div className={s.cardHeader}>
              <div className={s.cardTitle}>费用明细</div>
            </div>
            <div className={s.cardBody}>
              {price.lines.length === 0 ? (
                <div className={s.muted}>完成选型后显示逐项费用</div>
              ) : (
                price.lines.map((l) => (
                  <div className={s.priceLine} key={l.label}>
                    <span className={s.priceLineLabel}>
                      {l.label}
                      <br />
                      <span style={{ fontSize: 11 }}>{l.detail}</span>
                    </span>
                    <span>{formatUsd(l.hourly)}/时</span>
                  </div>
                ))
              )}
              <div className={s.priceTotal}>
                <span>合计</span>
                <span>
                  {formatUsd(price.hourly)}/时
                  <br />
                  <span className={s.muted} style={{ fontSize: 12 }}>
                    {formatUsd(price.monthly)}/月(730h)
                  </span>
                </span>
              </div>
              <div className={s.field} style={{ marginTop: 12 }}>
                <label className={s.fieldLabel}>计费方式</label>
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
                  抢占式实例可能被回收（容量紧张时优先回收），请勿用于不可中断任务。
                </div>
              )}
              <Badge tone="muted">金额由 billing_rates × 区域系数 × 折扣派生</Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
