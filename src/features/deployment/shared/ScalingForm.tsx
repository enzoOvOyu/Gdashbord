// 四类向导共用的「弹性伸缩」开关与精简表单（v0.7 · PRD §4.2.6 / §4.2.6.1）
// 两个策略模型**不共用一套表单**：
//   节点池伸缩（GPU 云服务器 / 裸金属 / vGPU）：触发指标 + min_size / max_size + 库存回退 + 缩容保护
//   服务副本伸缩（推理）：目标指标 + min/max 副本 + 优雅下线时长 + 允许缩到 0
import { t } from '../../../i18n';
import { SwitchRow, Field, Input, Select } from '../../../components/ui';
import { ui as s } from '../../../components/ui';
import {
  NODE_POOL_METRICS,
  REPLICA_METRICS,
  type NodePoolMetric,
  type ReplicaMetric,
} from '../schemas';

export interface NodePoolScalingValue {
  strategy_model: 'node_pool';
  trigger_metric: NodePoolMetric;
  target_value: number;
  min_size: number;
  max_size: number;
  fallback_enabled: boolean;
  cooldown_s: number;
}

export interface ReplicaScalingValue {
  strategy_model: 'replica';
  trigger_metric: ReplicaMetric;
  target_value: number;
  min_size: number;
  max_size: number;
  scale_to_zero: boolean;
  drain_timeout_s: number;
  fallback_enabled: boolean;
  cooldown_s: number;
}

const NODE_POOL_METRIC_LABEL: Record<NodePoolMetric, () => string> = {
  queue_depth: () => t('sc.metricQueueDepth'),
  pending_pods: () => t('sc.metricPendingPods'),
  qpm: () => t('sc.metricQpm'),
  gpu_allocation_rate: () => t('sc.metricAllocRate'),
};

const REPLICA_METRIC_LABEL: Record<ReplicaMetric, () => string> = {
  ttft_p99: () => t('sc.metricTtft'),
  kv_cache_usage: () => t('sc.metricKvCache'),
  requests_waiting: () => t('sc.metricWaiting'),
  concurrency: () => t('sc.metricConcurrency'),
};

/** 「弹性伸缩」开关（默认关；关闭 = 固定规格 scaling=null） */
export function ScalingSwitch({
  checked,
  onChange,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div>
      <SwitchRow
        label={t('deploy.enableScaling')}
        checked={checked}
        onChange={onChange}
        hint={hint ?? t('deploy.scalingOffHint')}
      />
    </div>
  );
}

/** 节点池伸缩策略精简表单（云服务器 / 裸金属 / vGPU 共用） */
export function NodePoolScalingForm({
  value,
  onChange,
  bareMetal,
  sizeUnit,
  hideSizeFields,
  sizeSummary,
}: {
  value: NodePoolScalingValue;
  onChange: (v: NodePoolScalingValue) => void;
  /** 裸金属：明示冷启动 5–30min + warm floor + stabilization 10–30min */
  bareMetal?: boolean;
  /** 规模单位文案（台 / 实例 / 节点） */
  sizeUnit: string;
  /** vGPU：min/max 由各池 min/max 节点数聚合，本表单不直接编辑 */
  hideSizeFields?: boolean;
  sizeSummary?: string;
}) {
  const patch = (p: Partial<NodePoolScalingValue>): void => onChange({ ...value, ...p });
  return (
    <div className={s.col} style={{ gap: 12 }}>
      {bareMetal && (
        <div className={`${s.notice} ${s.noticeWarn}`} style={{ fontSize: 13 }}>
          ⚠ {t('sc.baremetalColdStart')} {t('sc.warmFloorHint')} {t('deploy.bmStabilizationHint')}
        </div>
      )}
      <div className={s.formGrid}>
        <Field label={t('sc.triggerMetric')}>
          <Select
            value={value.trigger_metric}
            onChange={(e) => patch({ trigger_metric: e.target.value as NodePoolMetric })}
          >
            {NODE_POOL_METRICS.map((m) => (
              <option key={m} value={m}>
                {NODE_POOL_METRIC_LABEL[m]()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('sc.fieldTarget')}>
          <Input
            type="number"
            value={value.target_value}
            onChange={(e) => patch({ target_value: Number(e.target.value) })}
          />
        </Field>
        {hideSizeFields ? (
          <Field label={t('sc.minMax')} hint={t('deploy.vgpuPoolSumHint')}>
            <Input value={sizeSummary ?? `${value.min_size} ~ ${value.max_size}`} readOnly />
          </Field>
        ) : (
          <>
            <Field
              label={t('sc.fieldMinSize')}
              hint={bareMetal ? t('sc.warmFloorHint') : `${sizeUnit} · ${t('deploy.minSizeHint')}`}
            >
              <Input
                type="number"
                min={1}
                value={value.min_size}
                onChange={(e) => patch({ min_size: Number(e.target.value) })}
              />
            </Field>
            <Field label={t('sc.fieldMaxSize')} hint={`${sizeUnit} · ${t('deploy.maxSizeHint')}`}>
              <Input
                type="number"
                min={1}
                value={value.max_size}
                onChange={(e) => patch({ max_size: Number(e.target.value) })}
              />
            </Field>
          </>
        )}
        <Field label={t('sc.cooldown')} hint={t('deploy.cooldownHint')}>
          <Input
            type="number"
            min={60}
            value={value.cooldown_s}
            onChange={(e) => patch({ cooldown_s: Number(e.target.value) })}
          />
        </Field>
      </div>
      <SwitchRow
        label={t('sc.fallback')}
        checked={value.fallback_enabled}
        onChange={(v) => patch({ fallback_enabled: v })}
      />
      <div className={s.muted} style={{ fontSize: 12 }}>
        {t('deploy.scalingPolicyHint')}
      </div>
    </div>
  );
}

/** 服务副本伸缩策略精简表单（推理服务专用） */
export function ReplicaScalingForm({
  value,
  onChange,
}: {
  value: ReplicaScalingValue;
  onChange: (v: ReplicaScalingValue) => void;
}) {
  const patch = (p: Partial<ReplicaScalingValue>): void => onChange({ ...value, ...p });
  return (
    <div className={s.col} style={{ gap: 12 }}>
      <div className={s.formGrid}>
        <Field label={t('sc.triggerMetric')}>
          <Select
            value={value.trigger_metric}
            onChange={(e) => patch({ trigger_metric: e.target.value as ReplicaMetric })}
          >
            {REPLICA_METRICS.map((m) => (
              <option key={m} value={m}>
                {REPLICA_METRIC_LABEL[m]()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('sc.fieldTarget')}>
          <Input
            type="number"
            value={value.target_value}
            onChange={(e) => patch({ target_value: Number(e.target.value) })}
          />
        </Field>
        <Field label={t('sc.minReplicas')} hint={t('deploy.minReplicaHint')}>
          <Input
            type="number"
            min={value.scale_to_zero ? 0 : 1}
            value={value.min_size}
            onChange={(e) => patch({ min_size: Number(e.target.value) })}
          />
        </Field>
        <Field label={t('sc.maxReplicas')}>
          <Input
            type="number"
            min={1}
            value={value.max_size}
            onChange={(e) => patch({ max_size: Number(e.target.value) })}
          />
        </Field>
        <Field label={t('sc.drainTimeout')} hint={t('deploy.drainHint')}>
          <Input
            type="number"
            min={30}
            value={value.drain_timeout_s}
            onChange={(e) => patch({ drain_timeout_s: Number(e.target.value) })}
          />
        </Field>
        <Field label={t('sc.cooldown')}>
          <Input
            type="number"
            min={60}
            value={value.cooldown_s}
            onChange={(e) => patch({ cooldown_s: Number(e.target.value) })}
          />
        </Field>
      </div>
      <SwitchRow
        label={t('sc.scaleToZero')}
        checked={value.scale_to_zero}
        onChange={(v) => patch({ scale_to_zero: v, min_size: v ? 0 : Math.max(1, value.min_size) })}
        hint={t('sc.scaleToZeroHint')}
      />
      <div className={s.muted} style={{ fontSize: 12 }}>
        {t('deploy.scalingPolicyHint')}
      </div>
    </div>
  );
}
