// 新建推理服务（PRD §4.2.4：模型→量化→算力→引擎→灰度）
// 核心闸门：单副本显存 = 权重 + KV + 激活 + 框架开销，超出卡容量即阻断（§7.7 派生）
import { t } from '../../i18n';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ui as s,
  Field,
  Input,
  Select,
  SwitchRow,
  PickCard,
  CardGrid,
  Badge,
  toast,
  EmptyState,
} from '../../components/ui';
import { AlertTriangle, Info } from 'lucide-react';
import { NODE_POOL_LABEL } from '../../lib/ids';
import type { NodePoolCode, RegionCode } from '../../types/domain';
import { WIZARD_STEP_SCHEMAS } from './schemas';
import { WizardShell } from './shared/WizardShell';
import { ProjectRegionStep, type ProjectRegionValue } from './shared/ProjectRegionStep';
import { estimateInference, type DiscountKey } from './shared/pricing';
import {
  ReplicaScalingForm,
  ScalingSwitch,
  type ReplicaScalingValue,
} from './shared/ScalingForm';
import type { ReplicaMetric } from './schemas';
import { useCreateOrder, useNodePools, useProjects } from '../shared/api';
import { MODELS, modelBySlug } from '../../mocks/fixtures/models';
import { inferenceMemoryPlan, type Precision } from '../../mocks/lib/derive';

const STEPS = [t('deploy.stepProjectRegion'), t('deploy.stepModel'), t('deploy.stepCompute'), t('deploy.stepEngine'), t('deploy.stepCanary')];
const EMPTY_PRICE = { lines: [], hourly: 0, monthly: 0, floorMonthly: null, peakMonthly: null };

type Quant = 'bf16' | 'fp8' | 'fp4' | 'awq';

const QUANT_LABEL: Record<Quant, string> = {
  get bf16() { return t('deploy.qBf16'); },
  get fp8() { return t('deploy.qFp8'); },
  get fp4() { return t('deploy.qFp4'); },
  get awq() { return t('deploy.qAwq'); },
};
const MODALITY_LABEL: Record<string, string> = {
  llm: 'LLM',
  get multimodal() { return t('model.multimodal'); },
  get diffusion() { return t('model.text2img'); },
  get embedding() { return t('model.embedding'); },
  get rerank() { return t('model.rerank'); },
};
/** 副本伸缩目标指标（replica 模型，含并发数） */
const METRIC_LABEL: Record<ReplicaMetric, string> = {
  get ttft_p99() { return t('inf.metricTtft'); },
  get kv_cache_usage() { return t('deploy.kvUsage'); },
  get requests_waiting() { return t('deploy.queueDepth'); },
  get concurrency() { return t('sc.metricConcurrency'); },
};

const fmtGb = (n: number): string => `${n.toFixed(1)} GB`;

/** 模型默认上下文长度（来自模型自身 contextTokens，钳制到 4096–32768） */
const defaultLenOf = (m: ReturnType<typeof modelBySlug>): number => {
  if (!m) return 32768;
  const ctx = m.contextTokens > 0 ? m.contextTokens : 32768;
  return Math.min(Math.max(Math.min(ctx, 131072), 4096), 32768);
};

export default function InferenceWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // 支持从镜像商城模型卡片直达（/deployment/inference?model=llama-3.1-70b-instruct）
  const initial = modelBySlug(params.get('model') ?? '') ?? modelBySlug('llama-3.1-8b-instruct');
  const [step, setStep] = useState(0);
  const [base, setBase] = useState<ProjectRegionValue>({ project_id: 0, region: 'jp', name: '' });

  // 第 2 步：模型与容量
  const [modelSlug, setModelSlug] = useState(initial?.slug ?? 'llama-3.1-8b-instruct');
  const [quant, setQuant] = useState<Quant>((initial?.precision ?? 'bf16') as Quant);
  const [maxModelLen, setMaxModelLen] = useState(defaultLenOf(initial));
  const [concurrency, setConcurrency] = useState(32);
  const [avgContext, setAvgContext] = useState(4096);

  // 第 3 步：算力与副本
  const [pool, setPool] = useState<NodePoolCode>(
    initial?.recommendedPools[0] ?? 'H100_SXM',
  );
  const [gpuPerReplica, setGpuPerReplica] = useState(Math.max(initial?.minTp ?? 1, 1));
  const [replicas, setReplicas] = useState(2);
  // v0.7：原 hpa_enabled 升级为统一「弹性伸缩」开关，策略模型 = 服务副本伸缩（§4.2.4 / §4.2.6）
  const [elasticScaling, setElasticScaling] = useState(false);
  const [scaling, setScaling] = useState<ReplicaScalingValue>({
    strategy_model: 'replica',
    trigger_metric: 'ttft_p99',
    target_value: 800,
    min_size: 1,
    max_size: 8,
    scale_to_zero: false,
    drain_timeout_s: 300,
    fallback_enabled: true,
    cooldown_s: 300,
  });

  // 第 4 步：引擎与高级
  const [engine, setEngine] = useState<'vllm' | 'sglang' | 'trt-llm'>('vllm');
  const [port, setPort] = useState(8000);
  const [authEnabled, setAuthEnabled] = useState(true);
  const [maxBatchSize, setMaxBatchSize] = useState(64);
  const [prefixCaching, setPrefixCaching] = useState(true);
  const [chunkedPrefill, setChunkedPrefill] = useState(true);

  // 第 5 步：灰度与确认
  const [canaryEnabled, setCanaryEnabled] = useState(false);
  const [canaryReplicas, setCanaryReplicas] = useState(1);
  const [trafficPercent, setTrafficPercent] = useState(10);
  const [coldStandby, setColdStandby] = useState(false);

  const [discount, setDiscount] = useState<DiscountKey>('on_demand');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: poolViews = [] } = useNodePools(base.region);
  const { data: projects = [] } = useProjects() as {
    data: Array<{ id: number; name: string; is_default: boolean; default_region: RegionCode }>;
  };
  const create = useCreateOrder();

  const model = modelBySlug(modelSlug);
  const available = poolViews.filter((p) => p.available_in_region);

  const currentValues = {
    ...base,
    model_slug: modelSlug,
    quantization: quant,
    max_model_len: maxModelLen,
    concurrency,
    avg_context_tokens: avgContext,
    replicas,
    node_pool: pool,
    gpu_per_replica: gpuPerReplica,
    elastic_scaling: elasticScaling,
    scaling: elasticScaling ? scaling : null,
    engine,
    port,
    auth_enabled: authEnabled,
    max_batch_size: maxBatchSize,
    enable_prefix_caching: prefixCaching,
    enable_chunked_prefill: chunkedPrefill,
    canary_enabled: canaryEnabled,
    canary_replicas: canaryReplicas,
    traffic_percent: trafficPercent,
    cold_standby: coldStandby,
  };

  // ── 显存闸门（§7.7 派生，禁止硬编码） ──
  const memInput = {
    pool,
    paramsBillion: model?.paramsBillion ?? 0,
    precision: quant as Precision,
    gpusInTp: gpuPerReplica,
    concurrency,
    avgContextTokens: avgContext,
    layers: model?.layers ?? 0,
    kvHeads: model?.kvHeads ?? 0,
    headDim: model?.headDim ?? 0,
  };
  const plan = inferenceMemoryPlan(memInput);
  const planFp8 = inferenceMemoryPlan({ ...memInput, precision: 'fp8' });
  const planMoreTp =
    plan.minTp <= 8
      ? inferenceMemoryPlan({ ...memInput, gpusInTp: plan.minTp })
      : null;
  const kvPerConc = concurrency > 0 ? plan.kvGb / concurrency : 0;
  const concBudget =
    plan.capacityTotalGb -
    plan.weightsGb -
    (plan.activationsGbPerGpu + plan.overheadGbPerGpu) * gpuPerReplica;
  const concFit = kvPerConc > 0 ? Math.max(1, Math.floor(concBudget / kvPerConc)) : concurrency;

  const suggestions: string[] = [];
  if (!plan.fits && model) {
    if (planMoreTp) {
      suggestions.push(
        t('deploy.sugTp', { v0: plan.minTp, v1: NODE_POOL_LABEL[pool], v2: fmtGb(planMoreTp.requiredPerGpuGb) }),
      );
    }
    if (quant !== 'fp8') {
      suggestions.push(t('deploy.sugFp8', { v0: fmtGb(planFp8.requiredTotalGb) }));
    }
    if (concFit < concurrency) {
      suggestions.push(t('deploy.sugConcurrency', { v0: concFit }));
    }
  }

  const validate = (i: number): boolean => {
    if (i === 2 && model && !plan.fits) {
      toast.error(t('deploy.memBlocked'));
      setErrors({ gpu_per_replica: t('deploy.memInvalid') });
      return false;
    }
    const schema = WIZARD_STEP_SCHEMAS.inference[i];
    if (!schema) return true;
    const res = schema.safeParse(currentValues);
    if (res.success) {
      setErrors({});
      return true;
    }
    const map: Record<string, string> = {};
    for (const issue of res.error.issues) {
      const k = String(issue.path.join('.') ?? 'form');
      if (!map[k]) map[k] = issue.message;
    }
    setErrors(map);
    return false;
  };

  const jump = (i: number): void => {
    if (i > step && !validate(step)) return;
    setStep(i);
  };

  const pickModel = (slug: string): void => {
    const m = modelBySlug(slug);
    setModelSlug(slug);
    if (!m) return;
    const ctx = m.contextTokens > 0 ? m.contextTokens : 32768;
    const cap = Math.min(ctx, 131072);
    setQuant(m.precision as Quant);
    setMaxModelLen(Math.min(Math.max(cap, 4096), 32768));
    setAvgContext(4096);
    // 推荐机型优先（须在当前区域可用）
    const rec = m.recommendedPools.find(
      (c) => poolViews.find((p) => p.code === c)?.available_in_region,
    );
    if (rec) setPool(rec);
    setGpuPerReplica(Math.max(m.minTp, 1));
  };

  const price = plan.fits
    ? estimateInference({
        pool,
        region: base.region,
        replicas,
        gpuPerReplica,
        discount,
        scaling: elasticScaling
          ? { current: replicas, min: scaling.min_size, max: scaling.max_size }
          : null,
      })
    : EMPTY_PRICE;

  const submit = async (): Promise<void> => {
    if (!validate(STEPS.length - 1) || !plan.fits) {
      if (!plan.fits) toast.error(t('deploy.memNoSubmit'));
      return;
    }
    try {
      const res = await create.mutateAsync({
        resource_kind: 'inference',
        region: base.region,
        node_pool: pool,
        project_id: base.project_id,
        name: base.name,
        source_type: 'direct',
        requested_spec: {
          model_slug: modelSlug,
          quantization: quant,
          max_model_len: maxModelLen,
          concurrency,
          avg_context_tokens: avgContext,
          replicas,
          gpu_per_replica: gpuPerReplica,
          gpu_count: replicas * gpuPerReplica,
          // v0.7：弹性伸缩配置写入 requested_spec.scaling（服务副本伸缩策略）
          scaling: elasticScaling ? scaling : null,
          // spec_json 的 hpa 段保留为伸缩镜像视图（资源详情「弹性」Tab 读取同一策略）
          hpa: elasticScaling
            ? {
                enabled: true,
                min: scaling.min_size,
                max: scaling.max_size,
                metric: scaling.trigger_metric,
                target: scaling.target_value,
              }
            : { enabled: false, min: replicas, max: replicas, metric: 'ttft_p99', target: 0 },
          engine,
          port,
          auth_enabled: authEnabled,
          max_batch_size: maxBatchSize,
          enable_prefix_caching: prefixCaching,
          enable_chunked_prefill: chunkedPrefill,
          canary: canaryEnabled
            ? { enabled: true, replicas: canaryReplicas, traffic_percent: trafficPercent }
            : { enabled: false, replicas: 0, traffic_percent: 0 },
          cold_standby: coldStandby,
          storage_gb: 0,
        },
      });
      toast.success(t('deploy.infAccepted'));
      navigate(`/resources/inference/${res.resource_uuid}`);
    } catch {
      toast.error(t('deploy.createFailed'));
    }
  };

  const gpuOptions = [1, 2, 4, 8];
  const memParts = [
    { key: 'weights', label: t('deploy.memWeights'), color: 'var(--rs-brand)', value: plan.parts.weights },
    { key: 'kv', label: 'KV cache', color: 'var(--rs-info)', value: plan.parts.kv_cache },
    { key: 'act', label: t('deploy.memActivation'), color: 'var(--rs-warning)', value: plan.parts.activations },
    { key: 'oh', label: t('deploy.memOverhead'), color: 'var(--rs-purple)', value: plan.parts.framework_overhead },
  ];
  const usedPct = Math.min(100, Math.round(plan.usageRatio * 100));

  return (
    <WizardShell
      kind="inference"
      steps={STEPS}
      current={step}
      onJump={jump}
      price={price}
      discount={discount}
      onDiscount={setDiscount}
      onSubmit={() => void submit()}
      submitting={create.isPending}
    >
      {step === 0 && (
        <ProjectRegionStep
          value={base}
          onChange={(p) => setBase((v) => ({ ...v, ...p }))}
          projects={projects}
          errors={errors}
          nameHint={t('deploy.infNameHint')}
        />
      )}

      {step === 1 && (
        <div className={s.col} style={{ gap: 16 }}>
          <CardGrid>
            {MODELS.map((m) => (
              <PickCard
                key={m.slug}
                selected={m.slug === modelSlug}
                onClick={() => pickModel(m.slug)}
                title={m.name}
                meta={`${m.paramsBillion}B · ${MODALITY_LABEL[m.modality] ?? m.modality} · ${m.license}`}
                price={t('deploy.recommendFrom', { v0: m.minTp })}
              />
            ))}
          </CardGrid>
          {model && (
            <div className={s.muted} style={{ fontSize: 12 }}>
              {model.description}
            </div>
          )}
          <div className={s.formGrid}>
            <Field label={t('deploy.quantization')} required error={errors.quantization}>
              <Select value={quant} onChange={(e) => setQuant(e.target.value as Quant)}>
                {(Object.keys(QUANT_LABEL) as Quant[]).map((q) => (
                  <option key={q} value={q}>
                    {QUANT_LABEL[q]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('deploy.maxContext')} required error={errors.max_model_len}>
              <Input
                type="number"
                value={maxModelLen}
                onChange={(e) => setMaxModelLen(Number(e.target.value))}
              />
            </Field>
            <Field label={t('deploy.targetConcurrency')} required error={errors.concurrency}>
              <Input
                type="number"
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
              />
            </Field>
            <Field
              label={t('deploy.avgContext')}
              required
              error={errors.avg_context_tokens}
              hint={t('deploy.kvPlan', { v0: model && model.layers > 0 ? 'bytes/token' : '0' })}
            >
              <Input
                type="number"
                value={avgContext}
                onChange={(e) => setAvgContext(Number(e.target.value))}
              />
            </Field>
          </div>
          {model && model.layers > 0 ? (
            <div className={`${s.notice} ${s.noticeInfo}`}>
              <Info size={15} style={{ flex: 'none', marginTop: 2 }} color="var(--rs-info)" />
              <div>
                {t('inf.kvPlan1', { v0: concurrency, v1: avgContext })} tokens ×{' '}
                {(2 * model.layers * model.kvHeads * model.headDim * 2 / 1024).toFixed(0)} KiB/token
                = <b>{fmtGb(plan.kvGb)}</b>{t('inf.kvPlan2', { v0: fmtGb(plan.weightsGb), v1: model.paramsBillion })}B ×{t('inf.kvPlan3', { v0: { bf16: 2, fp8: 1, fp4: 0.5, awq: 0.56 }[quant] })}</div>
            </div>
          ) : (
            <div className={`${s.notice} ${s.noticeInfo}`}>
              <Info size={15} style={{ flex: 'none', marginTop: 2 }} color="var(--rs-info)" />
              <div>{t('deploy.noKvCache')}</div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div>
            <div className={s.sectionTitle}>{t('common.machineType')}</div>
            {available.length === 0 ? (
              <EmptyState icon="📭" title={t('pools.noMachines')} hint={t('deploy.backToStep1')} />
            ) : (
              <CardGrid>
                {available.map((pv) => (
                  <PickCard
                    key={pv.code}
                    selected={pv.code === pool}
                    onClick={() => setPool(pv.code)}
                    title={pv.display_name}
                    meta={t('deploy.specSummary', { v0: pv.gpu_model, v1: pv.vram_gb, v2: pv.interconnect })}
                    price={t('deploy.ratePerGpuHour', { v0: pv.unit_price.toFixed(2) })}
                  />
                ))}
              </CardGrid>
            )}
          </div>

          <div className={s.formGrid}>
            <Field label={t('deploy.tpSize')} required error={errors.gpu_per_replica}>
              <Select
                value={gpuPerReplica}
                onChange={(e) => setGpuPerReplica(Number(e.target.value))}
              >
                {gpuOptions.map((g) => (
                  <option key={g} value={g}>
                    {g} × {t('common.openParen', { v0: NODE_POOL_LABEL[pool] })}{g > 1 ? 'TP' : t('inf.singleGpu')}{t('common.closeParen')}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('common.replicas')} required error={errors.replicas}>
              <Input
                type="number"
                value={replicas}
                onChange={(e) => setReplicas(Number(e.target.value))}
              />
            </Field>
          </div>

          {/* ── 显存分解 + 闸门 ── */}
          <div style={{ border: '1px solid var(--rs-border)', borderRadius: 8, padding: 12 }}>
            <div className={s.row} style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <b>{t('deploy.memPerGpuUsage')}</b>
              <span className={s.muted} style={{ fontSize: 12 }}>
                {fmtGb(plan.requiredPerGpuGb)} / {t('common.parenPct', { v0: fmtGb(plan.capacityPerGpuGb), v1: usedPct })}</span>
            </div>
            <div className={s.memBar}>
              {memParts.map((p) => (
                <div
                  key={p.key}
                  className={s.memSeg}
                  style={{
                    width: `${Math.max(0, (p.value / plan.capacityPerGpuGb) * 100)}%`,
                    background: p.color,
                  }}
                />
              ))}
            </div>
            <div className={s.memLegend}>
              {memParts.map((p) => (
                <span className={s.memLegendItem} key={p.key}>
                  <span className={s.memDot} style={{ background: p.color }} />
                  {p.label} {fmtGb(p.value)}
                </span>
              ))}
              <span className={s.memLegendItem}>
                <span className={s.memDot} style={{ background: 'var(--rs-surface-2)' }} />
                {t('deploy.memHeadroom', { v0: fmtGb(Math.max(0, plan.capacityPerGpuGb - plan.requiredPerGpuGb)) })}
              </span>
            </div>
            <div className={s.muted} style={{ fontSize: 11, marginTop: 6 }}>
              {t('inf.replicaSummary1', { v0: fmtGb(plan.requiredTotalGb), v1: fmtGb(plan.capacityTotalGb), v2: gpuPerReplica })} × {t('inf.replicaSummary2', { v0: NODE_POOL_LABEL[pool] })}</div>
          </div>

          {!plan.fits && (
            <div className={`${s.notice} ${s.noticeDanger}`}>
              <AlertTriangle
                size={15}
                style={{ flex: 'none', marginTop: 2 }}
                color="var(--rs-danger)"
              />
              <div>
                <div className={s.noticeTitle}>{t('deploy.memBlockedShort')}</div>
                <div>
                  {t('deploy.memPerReplica', { v0: model?.name, v1: QUANT_LABEL[quant].split('（')[0], v2: ' ' })}
                  <b>{fmtGb(plan.requiredTotalGb)}</b>{t('inf.memShortage1', { v0: gpuPerReplica })} ×{t('inf.memShortage2', { v0: NODE_POOL_LABEL[pool], v1: fmtGb(plan.capacityTotalGb) })}</div>
                {suggestions.length > 0 && (
                  <ul className={s.noticeList}>
                    {suggestions.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          {plan.fits && plan.usageRatio > 0.85 && (
            <div className={`${s.notice} ${s.noticeWarn}`}>
              <AlertTriangle
                size={15}
                style={{ flex: 'none', marginTop: 2 }}
                color="var(--rs-warning)"
              />
              <div>
                {t('deploy.memTight', { v0: usedPct, v1: ' ', v2: fmtGb(Math.max(0, plan.capacityPerGpuGb - plan.requiredPerGpuGb)) })}
              </div>
            </div>
          )}

          <ScalingSwitch
            checked={elasticScaling}
            onChange={setElasticScaling}
            hint={t('deploy.scalingReplicaHint')}
          />
          {elasticScaling && <ReplicaScalingForm value={scaling} onChange={setScaling} />}
          {errors['scaling'] && <div className={s.fieldError}>{errors['scaling']}</div>}
          {errors['gpu_per_replica'] && (
            <div className={s.fieldError}>{errors['gpu_per_replica']}</div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div className={s.formGrid}>
            <Field label={t('deploy.engine')} required error={errors.engine}>
              <Select value={engine} onChange={(e) => setEngine(e.target.value as typeof engine)}>
                <option value="vllm">{t('inf.engineVllm')}</option>
                <option value="sglang">{t('inf.engineSglang')}</option>
                <option value="trt-llm">{t('inf.engineTrtllm')}</option>
              </Select>
            </Field>
            <Field label={t('deploy.port')} required error={errors.port}>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
              />
            </Field>
            <Field label={t('deploy.maxBatch')} error={errors.max_batch_size}>
              <Input
                type="number"
                value={maxBatchSize}
                onChange={(e) => setMaxBatchSize(Number(e.target.value))}
              />
            </Field>
          </div>
          <SwitchRow label={t('deploy.apiKeyAuth')} checked={authEnabled} onChange={setAuthEnabled} />
          <SwitchRow
            label={t('deploy.prefixCache')}
            checked={prefixCaching}
            onChange={setPrefixCaching}
          />
          <SwitchRow
            label={t('deploy.chunkedPrefill')}
            checked={chunkedPrefill}
            onChange={setChunkedPrefill}
          />
          <div className={s.muted} style={{ fontSize: 12 }}>
            {t('deploy.engineHint')}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className={s.col} style={{ gap: 16 }}>
          <SwitchRow
            label={t('deploy.canary')}
            checked={canaryEnabled}
            onChange={setCanaryEnabled}
          />
          {canaryEnabled && (
            <div className={s.formGrid}>
              <Field label={t('deploy.canaryReplicas')} error={errors.canary_replicas}>
                <Input
                  type="number"
                  value={canaryReplicas}
                  onChange={(e) => setCanaryReplicas(Number(e.target.value))}
                />
              </Field>
              <Field label={t('deploy.canaryTrafficPct')} error={errors.traffic_percent}>
                <Input
                  type="number"
                  value={trafficPercent}
                  onChange={(e) => setTrafficPercent(Number(e.target.value))}
                />
              </Field>
            </div>
          )}
          <SwitchRow label={t('deploy.warmStandby')} checked={coldStandby} onChange={setColdStandby} />

          <div style={{ border: '1px solid var(--rs-border)', borderRadius: 8, padding: 12 }}>
            <div className={s.sectionTitle}>{t('deploy.configConfirm')}</div>
            <div className={s.col} style={{ gap: 6, fontSize: 13 }}>
              <div className={s.row} style={{ justifyContent: 'space-between' }}>
                <span className={s.muted}>{t('common.model')}</span>
                <span>
                  {model?.name} · {QUANT_LABEL[quant].split('（')[0]}
                </span>
              </div>
              <div className={s.row} style={{ justifyContent: 'space-between' }}>
                <span className={s.muted}>{t('common.spec')}</span>
                <span>
                  {t('deploy.replicaSummary', { v0: replicas, v1: gpuPerReplica, v2: NODE_POOL_LABEL[pool] })}
                </span>
              </div>
              <div className={s.row} style={{ justifyContent: 'space-between' }}>
                <span className={s.muted}>{t('common.totalGpuCount')}</span>
                <span>{t('common.gpuCountValue', { v0: replicas * gpuPerReplica })}</span>
              </div>
              <div className={s.row} style={{ justifyContent: 'space-between' }}>
                <span className={s.muted}>{t('deploy.enginePort')}</span>
                <span className={s.nowrap}>
                  {engine} : {port}
                </span>
              </div>
              <div className={s.row} style={{ justifyContent: 'space-between' }}>
                <span className={s.muted}>{t('deploy.memPerGpuUsage')}</span>
                <span>
                  {fmtGb(plan.requiredPerGpuGb)} / {fmtGb(plan.capacityPerGpuGb)}
                </span>
              </div>
              <div className={s.row} style={{ justifyContent: 'space-between' }}>
                <span className={s.muted}>{t('deploy.elasticity')}</span>
                <span>
                  {elasticScaling
                    ? t('inf.hpaSummary', {
                        v0: scaling.min_size,
                        v1: scaling.max_size,
                        v2: METRIC_LABEL[scaling.trigger_metric],
                      })
                    : t('inf.fixedReplicas')}
                  {canaryEnabled ? t('inf.canarySuffix', { v0: trafficPercent }) : ''}
                </span>
              </div>
            </div>
          </div>
          <div className={s.row} style={{ gap: 8 }}>
            <Badge tone="muted">{t('deploy.infLoadingStage')}</Badge>
            <Badge tone={plan.fits ? 'success' : 'danger'}>
              {plan.fits ? t('inf.memCheckPass') : t('inf.memCheckFail')}
            </Badge>
          </div>
        </div>
      )}
    </WizardShell>
  );
}
