// 新建推理服务（PRD §4.2.4：模型→量化→算力→引擎→灰度）
// 核心闸门：单副本显存 = 权重 + KV + 激活 + 框架开销，超出卡容量即阻断（§7.7 派生）
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
import { useCreateOrder, useNodePools, useProjects } from '../shared/api';
import { MODELS, modelBySlug } from '../../mocks/fixtures/models';
import { inferenceMemoryPlan, type Precision } from '../../mocks/lib/derive';

const STEPS = ['项目与区域', '模型与容量', '算力与副本', '引擎与高级', '灰度与确认'];
const EMPTY_PRICE = { lines: [], hourly: 0, monthly: 0 };

type Quant = 'bf16' | 'fp8' | 'fp4' | 'awq';
type HpaMetric = 'ttft_p99' | 'kv_cache_usage' | 'requests_waiting';

const QUANT_LABEL: Record<Quant, string> = {
  bf16: 'BF16（2 bytes/参数）',
  fp8: 'FP8（1 byte/参数）',
  fp4: 'FP4（0.5 byte/参数）',
  awq: 'AWQ 4bit（≈0.56 byte/参数）',
};
const MODALITY_LABEL: Record<string, string> = {
  llm: 'LLM',
  multimodal: '多模态',
  diffusion: '文生图',
  embedding: '向量',
  rerank: '重排序',
};
const METRIC_LABEL: Record<HpaMetric, string> = {
  ttft_p99: 'TTFT P99（ms）',
  kv_cache_usage: 'KV Cache 使用率（%）',
  requests_waiting: '排队请求数',
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
  const [hpaEnabled, setHpaEnabled] = useState(true);
  const [hpaMin, setHpaMin] = useState(2);
  const [hpaMax, setHpaMax] = useState(8);
  const [hpaMetric, setHpaMetric] = useState<HpaMetric>('ttft_p99');
  const [hpaTarget, setHpaTarget] = useState(500);

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
    hpa_enabled: hpaEnabled,
    hpa_min: hpaMin,
    hpa_max: hpaMax,
    hpa_metric: hpaMetric,
    hpa_target: hpaTarget,
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
        `提升张量并行到 ${plan.minTp}×${NODE_POOL_LABEL[pool]}（每卡约 ${fmtGb(planMoreTp.requiredPerGpuGb)}）`,
      );
    }
    if (quant !== 'fp8') {
      suggestions.push(`改用 FP8 量化（单副本降至 ${fmtGb(planFp8.requiredTotalGb)}）`);
    }
    if (concFit < concurrency) {
      suggestions.push(`将目标并发降至 ${concFit}（KV cache 相应下降）`);
    }
  }

  const validate = (i: number): boolean => {
    if (i === 2 && model && !plan.fits) {
      toast.error('显存不足：请按右侧建议调整量化、并发或卡数');
      setErrors({ gpu_per_replica: '当前配置显存不足，无法通过校验' });
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
      })
    : EMPTY_PRICE;

  const submit = async (): Promise<void> => {
    if (!validate(STEPS.length - 1) || !plan.fits) {
      if (!plan.fits) toast.error('显存不足，无法提交');
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
          hpa: hpaEnabled
            ? { enabled: true, min: hpaMin, max: hpaMax, metric: hpaMetric, target: hpaTarget }
            : { enabled: false, min: replicas, max: replicas, metric: hpaMetric, target: hpaTarget },
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
      toast.success('订单已受理，模型加载中');
      navigate(`/resources/inference/${res.resource_uuid}`);
    } catch {
      toast.error('创建失败，请检查配置');
    }
  };

  const gpuOptions = [1, 2, 4, 8];
  const memParts = [
    { key: 'weights', label: '权重', color: 'var(--rs-brand)', value: plan.parts.weights },
    { key: 'kv', label: 'KV cache', color: 'var(--rs-info)', value: plan.parts.kv_cache },
    { key: 'act', label: '激活', color: 'var(--rs-warning)', value: plan.parts.activations },
    { key: 'oh', label: '框架开销', color: 'var(--rs-purple)', value: plan.parts.framework_overhead },
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
          nameHint="留空则自动命名为 inference-01"
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
                price={`推荐 ${m.minTp} 卡起`}
              />
            ))}
          </CardGrid>
          {model && (
            <div className={s.muted} style={{ fontSize: 12 }}>
              {model.description}
            </div>
          )}
          <div className={s.formGrid}>
            <Field label="量化精度" required error={errors.quantization}>
              <Select value={quant} onChange={(e) => setQuant(e.target.value as Quant)}>
                {(Object.keys(QUANT_LABEL) as Quant[]).map((q) => (
                  <option key={q} value={q}>
                    {QUANT_LABEL[q]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="最大上下文（tokens）" required error={errors.max_model_len}>
              <Input
                type="number"
                value={maxModelLen}
                onChange={(e) => setMaxModelLen(Number(e.target.value))}
              />
            </Field>
            <Field label="目标并发（max_num_seqs）" required error={errors.concurrency}>
              <Input
                type="number"
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
              />
            </Field>
            <Field
              label="平均上下文（tokens）"
              required
              error={errors.avg_context_tokens}
              hint={`KV cache 规划 = 并发 × 平均上下文 × ${model && model.layers > 0 ? 'bytes/token' : '0'}`}
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
                本次 KV 规划：并发 {concurrency} × 平均 {avgContext} tokens ×{' '}
                {(2 * model.layers * model.kvHeads * model.headDim * 2 / 1024).toFixed(0)} KiB/token
                = <b>{fmtGb(plan.kvGb)}</b>；权重 {fmtGb(plan.weightsGb)}（{model.paramsBillion}B ×{' '}
                {{ bf16: 2, fp8: 1, fp4: 0.5, awq: 0.56 }[quant]} bytes）
              </div>
            </div>
          ) : (
            <div className={`${s.notice} ${s.noticeInfo}`}>
              <Info size={15} style={{ flex: 'none', marginTop: 2 }} color="var(--rs-info)" />
              <div>该模型无自回归 KV cache（扩散/图生图类），显存占用以权重与激活为主。</div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div>
            <div className={s.sectionTitle}>机型</div>
            {available.length === 0 ? (
              <EmptyState icon="📭" title="该区域暂无可用机型" hint="请返回第 1 步切换区域" />
            ) : (
              <CardGrid>
                {available.map((pv) => (
                  <PickCard
                    key={pv.code}
                    selected={pv.code === pool}
                    onClick={() => setPool(pv.code)}
                    title={pv.display_name}
                    meta={`${pv.gpu_model} · ${pv.vram_gb} GB 显存 · ${pv.interconnect}`}
                    price={`$${pv.unit_price.toFixed(2)}/GPU·时`}
                  />
                ))}
              </CardGrid>
            )}
          </div>

          <div className={s.formGrid}>
            <Field label="单副本 GPU 数（张量并行 TP）" required error={errors.gpu_per_replica}>
              <Select
                value={gpuPerReplica}
                onChange={(e) => setGpuPerReplica(Number(e.target.value))}
              >
                {gpuOptions.map((g) => (
                  <option key={g} value={g}>
                    {g} × {NODE_POOL_LABEL[pool]}（{g > 1 ? 'TP' : '单卡'}）
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="副本数" required error={errors.replicas}>
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
              <b>单卡显存占用</b>
              <span className={s.muted} style={{ fontSize: 12 }}>
                {fmtGb(plan.requiredPerGpuGb)} / {fmtGb(plan.capacityPerGpuGb)}（{usedPct}%）
              </span>
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
                余量 {fmtGb(Math.max(0, plan.capacityPerGpuGb - plan.requiredPerGpuGb))}
              </span>
            </div>
            <div className={s.muted} style={{ fontSize: 11, marginTop: 6 }}>
              单副本合计 {fmtGb(plan.requiredTotalGb)} · 可用 {fmtGb(plan.capacityTotalGb)}（
              {gpuPerReplica} × {NODE_POOL_LABEL[pool]}）· 派生：weights = params × bytes/param（§7.3）；
              kv = 并发 × 平均上下文 × kv_bytes_per_token（§7.4）
            </div>
          </div>

          {!plan.fits && (
            <div className={`${s.notice} ${s.noticeDanger}`}>
              <AlertTriangle
                size={15}
                style={{ flex: 'none', marginTop: 2 }}
                color="var(--rs-danger)"
              />
              <div>
                <div className={s.noticeTitle}>显存不足，无法继续</div>
                <div>
                  {model?.name}（{QUANT_LABEL[quant].split('（')[0]}）单副本需{' '}
                  <b>{fmtGb(plan.requiredTotalGb)}</b>，当前 {gpuPerReplica} ×{' '}
                  {NODE_POOL_LABEL[pool]}（{fmtGb(plan.capacityTotalGb)}）不足。
                </div>
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
                显存占用已达 {usedPct}%，KV cache 余量仅{' '}
                {fmtGb(Math.max(0, plan.capacityPerGpuGb - plan.requiredPerGpuGb))}，
                高并发下可能触发抢占/排队。
              </div>
            </div>
          )}

          <SwitchRow
            label="启用 HPA 自动扩缩容"
            checked={hpaEnabled}
            onChange={setHpaEnabled}
          />
          {hpaEnabled && (
            <div className={s.formGrid}>
              <Field label="最小副本" error={errors.hpa_min}>
                <Input
                  type="number"
                  value={hpaMin}
                  onChange={(e) => setHpaMin(Number(e.target.value))}
                />
              </Field>
              <Field label="最大副本" error={errors.hpa_max}>
                <Input
                  type="number"
                  value={hpaMax}
                  onChange={(e) => setHpaMax(Number(e.target.value))}
                />
              </Field>
              <Field label="扩缩指标" error={errors.hpa_metric}>
                <Select value={hpaMetric} onChange={(e) => setHpaMetric(e.target.value as HpaMetric)}>
                  {(Object.keys(METRIC_LABEL) as HpaMetric[]).map((m) => (
                    <option key={m} value={m}>
                      {METRIC_LABEL[m]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="目标值" error={errors.hpa_target}>
                <Input
                  type="number"
                  value={hpaTarget}
                  onChange={(e) => setHpaTarget(Number(e.target.value))}
                />
              </Field>
            </div>
          )}
          {errors['gpu_per_replica'] && (
            <div className={s.fieldError}>{errors['gpu_per_replica']}</div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div className={s.formGrid}>
            <Field label="推理引擎" required error={errors.engine}>
              <Select value={engine} onChange={(e) => setEngine(e.target.value as typeof engine)}>
                <option value="vllm">vLLM（PagedAttention，通用推荐）</option>
                <option value="sglang">SGLang（RadixAttention，高并发）</option>
                <option value="trt-llm">TensorRT-LLM（编译优化，固定形状最快）</option>
              </Select>
            </Field>
            <Field label="服务端口" required error={errors.port}>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
              />
            </Field>
            <Field label="最大批处理大小" error={errors.max_batch_size}>
              <Input
                type="number"
                value={maxBatchSize}
                onChange={(e) => setMaxBatchSize(Number(e.target.value))}
              />
            </Field>
          </div>
          <SwitchRow label="启用 API Key 鉴权" checked={authEnabled} onChange={setAuthEnabled} />
          <SwitchRow
            label="Prefix Caching（前缀缓存）"
            checked={prefixCaching}
            onChange={setPrefixCaching}
          />
          <SwitchRow
            label="Chunked Prefill（分块预填充）"
            checked={chunkedPrefill}
            onChange={setChunkedPrefill}
          />
          <div className={s.muted} style={{ fontSize: 12 }}>
            引擎参数仅影响运行时行为，不参与计费（v1 按 GPU·小时计费，不按调用量）。
          </div>
        </div>
      )}

      {step === 4 && (
        <div className={s.col} style={{ gap: 16 }}>
          <SwitchRow
            label="启用灰度（Canary）副本"
            checked={canaryEnabled}
            onChange={setCanaryEnabled}
          />
          {canaryEnabled && (
            <div className={s.formGrid}>
              <Field label="灰度副本数" error={errors.canary_replicas}>
                <Input
                  type="number"
                  value={canaryReplicas}
                  onChange={(e) => setCanaryReplicas(Number(e.target.value))}
                />
              </Field>
              <Field label="灰度流量比例（%）" error={errors.traffic_percent}>
                <Input
                  type="number"
                  value={trafficPercent}
                  onChange={(e) => setTrafficPercent(Number(e.target.value))}
                />
              </Field>
            </div>
          )}
          <SwitchRow label="保留冷备副本（低峰不缩容到 0）" checked={coldStandby} onChange={setColdStandby} />

          <div style={{ border: '1px solid var(--rs-border)', borderRadius: 8, padding: 12 }}>
            <div className={s.sectionTitle}>配置确认</div>
            <div className={s.col} style={{ gap: 6, fontSize: 13 }}>
              <div className={s.row} style={{ justifyContent: 'space-between' }}>
                <span className={s.muted}>模型</span>
                <span>
                  {model?.name} · {QUANT_LABEL[quant].split('（')[0]}
                </span>
              </div>
              <div className={s.row} style={{ justifyContent: 'space-between' }}>
                <span className={s.muted}>规格</span>
                <span>
                  {replicas} 副本 × {gpuPerReplica} × {NODE_POOL_LABEL[pool]}
                </span>
              </div>
              <div className={s.row} style={{ justifyContent: 'space-between' }}>
                <span className={s.muted}>总卡数</span>
                <span>{replicas * gpuPerReplica} 卡</span>
              </div>
              <div className={s.row} style={{ justifyContent: 'space-between' }}>
                <span className={s.muted}>引擎 / 端口</span>
                <span className={s.nowrap}>
                  {engine} : {port}
                </span>
              </div>
              <div className={s.row} style={{ justifyContent: 'space-between' }}>
                <span className={s.muted}>单卡显存占用</span>
                <span>
                  {fmtGb(plan.requiredPerGpuGb)} / {fmtGb(plan.capacityPerGpuGb)}
                </span>
              </div>
              <div className={s.row} style={{ justifyContent: 'space-between' }}>
                <span className={s.muted}>弹性</span>
                <span>
                  {hpaEnabled ? `HPA ${hpaMin}–${hpaMax}（${METRIC_LABEL[hpaMetric]}）` : '固定副本'}
                  {canaryEnabled ? ` · 灰度 ${trafficPercent}%` : ''}
                </span>
              </div>
            </div>
          </div>
          <div className={s.row} style={{ gap: 8 }}>
            <Badge tone="muted">创建后进入「模型加载」阶段</Badge>
            <Badge tone={plan.fits ? 'success' : 'danger'}>
              {plan.fits ? '显存校验通过' : '显存校验未通过'}
            </Badge>
          </div>
        </div>
      )}
    </WizardShell>
  );
}
