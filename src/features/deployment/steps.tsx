// 部署向导六步 UI（PRD §4.2；四类共用分步向导，按 kind 渲染差异项）
import type { UseFormReturn } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import type { NodePool, RegionCode, ResourceKind } from '../../types/domain';
import { Card, Input, Select, Badge } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { REGION_META, REGION_LIST, KIND_META } from '../../lib/ids';
import { formatUsd } from '../../lib/money';
import { ui as s } from '../../components/ui';
import { K8S_VERSIONS, NETWORK_PLUGINS, HPA_TARGETS, KIND_FORM_META } from './schemas';
import { estimatePrice, slicingPolicies, machineTypes, SUPPORTS } from './pricing';
import { parseEnv, parsePorts, type WizardValues } from './form';
import w from './wizard.module.css';

export interface StepProps {
  kind: ResourceKind;
  form: UseFormReturn<WizardValues>;
}

/** 节点池行（含 API 附加字段） */
export interface PoolRow extends NodePool {
  available_regions: RegionCode[];
  unit_price_jp: number;
  unit_price_us: number;
  unit_price_sg: number;
  unit_price_th: number;
  supply?: { totalGpu: number; availableGpu: number; nodeCount: number };
  platform: { cpu: string; systemMemoryGb: number; localNvme: string; network: string };
}

function unitPriceOf(p: PoolRow, region: RegionCode): number {
  const key = `unit_price_${region}` as keyof PoolRow;
  return p[key] as number;
}

/** 通用字段行 */
function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={w.field}>
      <label className={`${w.label} ${required ? w.req : ''}`}>{label}</label>
      {children}
      {hint && <span className={w.hint}>{hint}</span>}
      {error && <span className={w.err}>{error}</span>}
    </div>
  );
}

/** 开关行 */
function Toggle({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={w.switchRow}>
      <div className={w.switchText}>
        <span className={w.switchTitle}>{title}</span>
        <span className={w.switchDesc}>{desc}</span>
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

// ───────────────────────── ① 选型 ─────────────────────────
export function StepPool({ kind, form }: StepProps) {
  const { register, watch, setValue, formState } = form;
  const region = watch('region');
  const pool = watch('node_pool');
  const err = formState.errors;

  const { data: pools = [] } = useQuery<PoolRow[]>({
    queryKey: ['node-pools', region],
    queryFn: () => api.get<PoolRow[]>(`${EP.nodePools}?region=${region}`),
  });

  const selectPool = (code: string) => {
    setValue('node_pool', code as PoolRow['code'], { shouldValidate: true });
    const p = pools.find((x) => x.code === code);
    if (p) {
      setValue('gpu_model', p.gpu_model, { shouldValidate: true });
      if (kind === 'gpu_baremetal') {
        setValue('machine_type', code, { shouldValidate: true });
        setValue('gpu_count', p.gpus_per_node, { shouldValidate: true });
      }
    }
  };

  return (
    <div className={w.panel}>
      <Card title="基本信息">
        <div className={w.grid2}>
          <Field
            label="名称"
            required
            hint="创建后可在资源详情重命名"
            error={err.name?.message as string | undefined}
          >
            <Input placeholder="例如 training-01" {...register('name')} />
          </Field>
          <Field label="区域" required error={err.region?.message as string | undefined}>
            <Select {...register('region')}>
              {REGION_LIST.map((r) => (
                <option key={r} value={r}>
                  {REGION_META[r].label}（{REGION_META[r].iso}）
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {kind === 'gpu_baremetal' && (
        <Card title="机型">
          <div className={w.field}>
            <Field label="服务器机型" required error={err.machine_type?.message as string | undefined}>
              <Select {...register('machine_type')}>
                {machineTypes().map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <span className={w.hint}>
              {machineTypes().find((m) => m.value === watch('machine_type'))?.detail ?? '选择机型后展示平台规格'}
            </span>
          </div>
        </Card>
      )}

      {kind === 'vgpu' && (
        <Card title="托管集群配置">
          <div className={w.grid2}>
            <Field label="Kubernetes 版本" required error={err.k8s_version?.message as string | undefined}>
              <Select {...register('k8s_version')}>
                {K8S_VERSIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="GPU 切片策略"
              required
              hint="由机型 MIG 能力派生"
              error={err.slicing_policy?.message as string | undefined}
            >
              <Select {...register('slicing_policy')}>
                {slicingPolicies(pool).map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>
      )}

      <Card title={KIND_FORM_META[kind].gpuStepLabel} actions={<Badge tone="info">{pools.length} 个节点池</Badge>}>
        <div className={w.cardGrid}>
          {pools
            .filter((p) => p.available_regions.includes(region))
            .map((p) => {
              const active = p.code === pool;
              const tight = p.supply ? p.supply.availableGpu / Math.max(1, p.supply.totalGpu) < 0.15 : false;
              return (
                <button
                  type="button"
                  key={p.code}
                  className={`${w.pickCard} ${active ? w.pickActive : ''}`}
                  onClick={() => selectPool(p.code)}
                >
                  <span className={w.pickTitle}>
                    {p.gpu_model}
                    {kind === 'vgpu' && <span className={s.mono}>{p.code}</span>}
                  </span>
                  <span className={w.pickMeta}>
                    {p.gpus_per_node} GPU / 节点 · {p.vram_gb} GB 显存
                    <br />
                    {p.interconnect}
                    <br />
                    {p.platform.localNvme} · {p.platform.systemMemoryGb} GB 内存
                  </span>
                  <span className={w.pickPrice}>{formatUsd(unitPriceOf(p, region))} / GPU·时</span>
                  <span className={w.kvLine}>
                    <span>
                      可用 {p.supply?.availableGpu ?? 0} / {p.supply?.totalGpu ?? 0} GPU
                    </span>
                    {tight && <Badge tone="warning">容量紧张</Badge>}
                  </span>
                </button>
              );
            })}
        </div>
        {err.node_pool?.message && <span className={w.err}>{err.node_pool.message as string}</span>}
      </Card>
    </div>
  );
}

// ───────────────────────── ② 镜像 / 模型 ─────────────────────────
export function StepImage({ kind, form }: StepProps) {
  const { register, watch, setValue, formState } = form;
  const err = formState.errors;

  const { data: images = [] } = useQuery<
    Array<{ id: number; name: string; registry: string; tag: string; cuda_version: string; size_gb: number; is_official: boolean; framework: string }>
  >({ queryKey: ['images'], queryFn: () => api.get(EP.images), enabled: SUPPORTS[kind].image });

  const { data: models = [] } = useQuery<
    Array<{ id: number; slug: string; name: string; paramsBillion: number; precision: string; contextTokens: number; recommendedPools: string[]; modality: string }>
  >({ queryKey: ['models'], queryFn: () => api.get(EP.models), enabled: SUPPORTS[kind].model });

  if (kind === 'inference') {
    const selected = models.find((m) => m.slug === watch('model_ref'));
    return (
      <div className={w.panel}>
        <Card title="选择模型">
          <div className={w.cardGrid}>
            {models.map((m) => {
              const active = m.slug === watch('model_ref');
              const recommended = m.recommendedPools.includes(watch('node_pool'));
              return (
                <button
                  type="button"
                  key={m.slug}
                  className={`${w.pickCard} ${active ? w.pickActive : ''}`}
                  onClick={() => setValue('model_ref', m.slug, { shouldValidate: true })}
                >
                  <span className={w.pickTitle}>
                    {m.name}
                    {recommended && <Badge tone="success">推荐机型</Badge>}
                  </span>
                  <span className={w.pickMeta}>
                    {m.paramsBillion}B · {m.precision.toUpperCase()} · {m.modality}
                    <br />
                    上下文 {m.contextTokens.toLocaleString()} tokens
                  </span>
                </button>
              );
            })}
          </div>
          {err.model_ref?.message && <span className={w.err}>{err.model_ref.message as string}</span>}
        </Card>
        {selected && (
          <Card title="模型摘要">
            <div className={w.summary}>
              <div className={w.sumRow}>
                <span className={w.sumKey}>模型标识</span>
                <span className={w.sumVal}>{selected.slug}</span>
              </div>
              <div className={w.sumRow}>
                <span className={w.sumKey}>参数规模</span>
                <span className={w.sumVal}>{selected.paramsBillion}B</span>
              </div>
              <div className={w.sumRow}>
                <span className={w.sumKey}>默认精度</span>
                <span className={w.sumVal}>{selected.precision}</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  }

  if (kind === 'gpu_baremetal') {
    return (
      <div className={w.panel}>
        <Card title="操作系统与本地存储">
          <div className={w.grid2}>
            <Field
              label="CPU 型号"
              required
              hint="由机型平台派生，可微调"
              error={err.cpu_model?.message as string | undefined}
            >
              <Input placeholder="自动填充" {...register('cpu_model')} />
            </Field>
            <Field
              label="本地 NVMe 容量（GB）"
              error={err.local_nvme_gb?.message as string | undefined}
            >
              <Input type="number" {...register('local_nvme_gb', { valueAsNumber: true })} />
            </Field>
          </div>
        </Card>
      </div>
    );
  }

  const official = images.filter((i) => i.is_official);
  const community = images.filter((i) => !i.is_official);
  const render = (list: typeof images) => (
    <div className={w.cardGrid}>
      {list.map((i) => {
        const ref = `${i.registry}/${i.name}:${i.tag}`;
        const active = watch('image_ref') === ref;
        return (
          <button
            type="button"
            key={i.id}
            className={`${w.pickCard} ${active ? w.pickActive : ''}`}
            onClick={() => setValue('image_ref', ref, { shouldValidate: true })}
          >
            <span className={w.pickTitle}>
              {i.name}
              {i.is_official && <Badge tone="success">官方</Badge>}
            </span>
            <span className={w.pickMeta}>
              {i.framework} · CUDA {i.cuda_version} · {i.size_gb} GB
            </span>
            <span className={w.mono}>{ref}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={w.panel}>
      <Card title="官方镜像">{official.length > 0 ? render(official) : <span className={s.muted}>加载中…</span>}</Card>
      {community.length > 0 && <Card title="社区镜像">{render(community)}</Card>}
      {err.image_ref?.message && <span className={w.err}>{err.image_ref.message as string}</span>}
    </div>
  );
}

// ───────────────────────── ③ 规格 ─────────────────────────
export function StepSpec({ kind, form }: StepProps) {
  const { register, watch, formState } = form;
  const err = formState.errors;
  const pool = watch('node_pool');

  const { data: pools = [] } = useQuery<PoolRow[]>({
    queryKey: ['node-pools', watch('region')],
    queryFn: () => api.get<PoolRow[]>(`${EP.nodePools}?region=${watch('region')}`),
  });
  const spec = pools.find((p) => p.code === pool);
  const maxGpu = spec?.gpus_per_node ?? 8;
  const maxMem = spec?.platform.systemMemoryGb ?? 2048;

  return (
    <div className={w.panel}>
      <Card title="算力规格" actions={spec && <Badge tone="info">单机 {maxGpu} GPU</Badge>}>
        <div className={w.grid3}>
          <Field label="GPU 数量" required error={err.gpu_count?.message as string | undefined}>
            <Input
              type="number"
              min={1}
              max={maxGpu}
              {...register('gpu_count', { valueAsNumber: true })}
            />
          </Field>
          {kind === 'vgpu' && (
            <Field label="节点数" required error={err.node_count?.message as string | undefined}>
              <Input type="number" min={1} max={64} {...register('node_count', { valueAsNumber: true })} />
            </Field>
          )}
          {kind === 'inference' && (
            <Field label="副本数" required error={err.replicas?.message as string | undefined}>
              <Input type="number" min={1} max={64} {...register('replicas', { valueAsNumber: true })} />
            </Field>
          )}
          {kind === 'gpu_vm' && (
            <>
              <Field label="vCPU" required error={err.vcpu?.message as string | undefined}>
                <Input type="number" min={2} max={224} {...register('vcpu', { valueAsNumber: true })} />
              </Field>
              <Field label="内存（GB）" required error={err.memory_gb?.message as string | undefined}>
                <Input type="number" min={8} max={maxMem} {...register('memory_gb', { valueAsNumber: true })} />
              </Field>
            </>
          )}
        </div>
      </Card>

      {(kind === 'gpu_vm' || kind === 'vgpu') && (
        <Card title="存储">
          <div className={w.grid2}>
            <Field
              label={kind === 'vgpu' ? '集群存储（GB）' : '系统盘（GB）'}
              required
              hint="块存储跟随实例，停止后仍计费（PRD §7.4）"
              error={err.storage_gb?.message as string | undefined}
            >
              <Input type="number" min={20} {...register('storage_gb', { valueAsNumber: true })} />
            </Field>
          </div>
        </Card>
      )}

      {kind === 'inference' && (
        <Card title="自动扩缩（HPA）">
          <Toggle
            title="启用自动扩缩"
            desc="基于 QPS / GPU 利用率 / 延迟触发（§7.1：推理按 GPU·小时计费，非按调用量）"
            checked={!!watch('hpa_enabled')}
            onChange={(v) => form.setValue('hpa_enabled', v)}
          />
          {watch('hpa_enabled') && (
            <div className={w.grid3} style={{ marginTop: 'var(--rs-s4)' }}>
              <Field label="最小副本" error={err.hpa_min?.message as string | undefined}>
                <Input type="number" min={1} {...register('hpa_min', { valueAsNumber: true })} />
              </Field>
              <Field label="最大副本" error={err.hpa_max?.message as string | undefined}>
                <Input type="number" min={1} {...register('hpa_max', { valueAsNumber: true })} />
              </Field>
              <Field label="扩缩容目标">
                <Select {...register('hpa_target')}>
                  {HPA_TARGETS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ───────────────────────── ④ 网络与端口 ─────────────────────────
export function StepNetwork({ kind, form }: StepProps) {
  const { register, watch, formState } = form;
  const err = formState.errors;

  if (kind === 'inference') {
    return (
      <div className={w.panel}>
        <Card title="服务端口与鉴权">
          <div className={w.grid2}>
            <Field label="服务端口" required error={err.port?.message as string | undefined}>
              <Input type="number" min={1} max={65535} {...register('port', { valueAsNumber: true })} />
            </Field>
          </div>
          <div style={{ marginTop: 'var(--rs-s4)' }}>
            <Toggle
              title="启用网关鉴权"
              desc="经推理网关鉴权后调用；关闭则端点公开"
              checked={!!watch('auth_enabled')}
              onChange={(v) => form.setValue('auth_enabled', v)}
            />
          </div>
        </Card>
      </div>
    );
  }

  if (kind === 'vgpu') {
    return (
      <div className={w.panel}>
        <Card title="集群网络">
          <div className={w.grid2}>
            <Field label="网络插件" error={err.network_plugin?.message as string | undefined}>
              <Select {...register('network_plugin')}>
                {NETWORK_PLUGINS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div style={{ marginTop: 'var(--rs-s4)' }}>
            <Toggle
              title="启用 Ingress"
              desc="为集群服务创建对外 HTTP 入口"
              checked={!!watch('ingress_enabled')}
              onChange={(v) => form.setValue('ingress_enabled', v)}
            />
          </div>
        </Card>
      </div>
    );
  }

  if (kind === 'gpu_baremetal') {
    return (
      <div className={w.panel}>
        <Card title="带外管理与物理网络">
          <div className={w.grid2}>
            <Toggle
              title="启用 IPMI 带外管理"
              desc="通过 BMC 访问控制台与硬件日志（SEL）"
              checked={!!watch('ipmi_enabled')}
              onChange={(v) => form.setValue('ipmi_enabled', v)}
            />
            <Toggle
              title="启用 InfiniBand"
              desc="多机训练的 RDMA 高速互联"
              checked={!!watch('ib_enabled')}
              onChange={(v) => form.setValue('ib_enabled', v)}
            />
          </div>
          <Toggle
            title="GPU 直通"
            desc="GPU 以直通方式挂载，不经虚拟化层"
            checked={!!watch('passthrough')}
            onChange={(v) => form.setValue('passthrough', v)}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className={w.panel}>
      <Card title="网络">
        <Toggle
          title="分配公网 IP"
          desc={`${formatUsd(0.005)}/小时；通过 SSH 或自定义端口访问实例`}
          checked={!!watch('public_ip')}
          onChange={(v) => form.setValue('public_ip', v)}
        />
      </Card>
      <Card title="端口映射">
        <Field
          label="开放端口"
          hint="逗号或空格分隔，例如 22, 8888, 6006"
          error={err.ports?.message as string | undefined}
        >
          <Input placeholder="22, 8888" {...register('ports')} />
        </Field>
        {parsePorts(watch()).length > 0 && (
          <div className={w.rowInline} style={{ marginTop: 'var(--rs-s3)', flexWrap: 'wrap' }}>
            {parsePorts(watch()).map((p) => (
              <Badge key={p} tone="info">
                {p}
              </Badge>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ───────────────────────── ⑤ 环境变量 / 启动命令 ─────────────────────────
export function StepEnv({ kind, form }: StepProps) {
  const { watch, setValue } = form;
  const envPairs = watch('envPairs');

  if (kind === 'gpu_baremetal' || kind === 'vgpu' || kind === 'inference') {
    return (
      <div className={w.panel}>
        <Card title="环境变量">
          <EnvEditor pairs={envPairs} onChange={(p) => setValue('envPairs', p)} />
        </Card>
      </div>
    );
  }

  return (
    <div className={w.panel}>
      <Card title="环境变量">
        <EnvEditor pairs={envPairs} onChange={(p) => setValue('envPairs', p)} />
      </Card>
      <Card title="SSH 公钥">
        <div className={w.field}>
          <label className={w.label}>公钥内容（可选）</label>
          <textarea
            className={s.input}
            rows={4}
            placeholder="ssh-ed25519 AAAA..."
            value={watch('ssh_pubkey')}
            onChange={(e) => setValue('ssh_pubkey', e.target.value)}
          />
          <span className={w.hint}>注入后可直接以密钥方式登录实例（存于 spec_json.ssh_pubkey）</span>
        </div>
      </Card>
    </div>
  );
}

function EnvEditor({
  pairs,
  onChange,
}: {
  pairs: WizardValues['envPairs'];
  onChange: (p: WizardValues['envPairs']) => void;
}) {
  const list = pairs.length > 0 ? pairs : [{ key: '', value: '' }];
  const update = (i: number, patch: Partial<{ key: string; value: string }>) => {
    const next = list.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    onChange(next);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rs-s3)' }}>
      {list.map((p, i) => (
        <div className={w.envRow} key={i}>
          <Input placeholder="KEY" value={p.key} onChange={(e) => update(i, { key: e.target.value })} />
          <Input placeholder="VALUE" value={p.value} onChange={(e) => update(i, { value: e.target.value })} />
          <input
            type="button"
            className={s.btn}
            value="删除"
            onClick={() => onChange(list.filter((_, idx) => idx !== i))}
          />
        </div>
      ))}
      <div>
        <input
          type="button"
          className={s.btn}
          value="+ 添加变量"
          onClick={() => onChange([...list, { key: '', value: '' }])}
        />
      </div>
      {Object.keys(parseEnv({ envPairs: list } as WizardValues)).length > 0 && (
        <span className={w.hint}>
          将写入 spec_json.env（{Object.keys(parseEnv({ envPairs: list } as WizardValues)).length} 项）
        </span>
      )}
    </div>
  );
}

// ───────────────────────── ⑥ 确认与价格预估 ─────────────────────────
export function StepConfirm({ kind, form }: StepProps) {
  const v = form.watch();
  const price = estimatePrice({
    kind,
    pool: v.node_pool,
    region: v.region,
    gpu_count: v.gpu_count,
    storage_gb: v.storage_gb,
    public_ip: v.public_ip,
    node_count: v.node_count,
    replicas: v.replicas,
  });

  const rows: Array<[string, string]> = [
    ['资源类型', KIND_META[kind].label],
    ['名称', v.name],
    ['区域', `${REGION_META[v.region].label}（${REGION_META[v.region].iso}）`],
    ['节点池', v.node_pool],
  ];
  const spec = (pairs: Array<[string, unknown]>) =>
    pairs.forEach(([k, val]) => rows.push([k, String(val ?? '—')]));

  if (kind === 'gpu_vm') {
    spec([
      ['GPU', `${v.gpu_model} × ${v.gpu_count}`],
      ['vCPU / 内存', `${v.vcpu} vCPU / ${v.memory_gb} GB`],
      ['系统盘', `${v.storage_gb} GB`],
      ['镜像', v.image_ref],
      ['公网 IP', v.public_ip ? '已分配' : '不分配'],
      ['开放端口', parsePorts(v).join(', ') || '—'],
      ['SSH 公钥', v.ssh_pubkey.trim() ? '已注入' : '未注入'],
    ]);
  } else if (kind === 'gpu_baremetal') {
    spec([
      ['机型', v.machine_type],
      ['GPU 直通', `${v.gpu_model} × ${v.gpu_count}（${v.passthrough ? '直通' : '非直通'}）`],
      ['CPU', v.cpu_model],
      ['本地 NVMe', `${v.local_nvme_gb} GB`],
      ['IPMI', v.ipmi_enabled ? '启用' : '关闭'],
      ['InfiniBand', v.ib_enabled ? '启用' : '关闭'],
    ]);
  } else if (kind === 'vgpu') {
    spec([
      ['K8s 版本', v.k8s_version],
      ['节点数', String(v.node_count)],
      ['GPU', `${v.gpu_count} / 节点`],
      ['切片策略', v.slicing_policy],
      ['网络插件', v.network_plugin],
      ['Ingress', v.ingress_enabled ? '启用' : '关闭'],
    ]);
  } else {
    spec([
      ['模型', v.model_ref],
      ['副本数', String(v.replicas)],
      ['GPU', `${v.gpu_count} / 副本`],
      ['端口 / 鉴权', `${v.port}（${v.auth_enabled ? '鉴权' : '公开'}）`],
      ['HPA', v.hpa_enabled ? `${v.hpa_min}–${v.hpa_max} @ ${v.hpa_target}` : '未启用'],
    ]);
  }
  const envN = Object.keys(parseEnv(v)).length;
  if (envN > 0) rows.push(['环境变量', `${envN} 项`]);

  return (
    <div className={w.panel}>
      <Card title="配置确认">
        <div className={w.summary}>
          {rows.map(([k, val]) => (
            <div className={w.sumRow} key={k}>
              <span className={w.sumKey}>{k}</span>
              <span className={w.sumVal}>{val || '—'}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="价格预估">
        <div className={w.summary}>
          {price.lines.map((l) => (
            <div className={w.sumRow} key={l.label}>
              <span className={w.sumKey}>
                {l.label}
                <span className={w.hint}> · {l.detail}</span>
              </span>
              <span className={w.sumVal}>
                {formatUsd(l.hourly)} / 小时 · {formatUsd(l.monthly)} / 月
              </span>
            </div>
          ))}
        </div>
        <div className={w.totalBox} style={{ marginTop: 'var(--rs-s4)' }}>
          <div className={w.totalLine}>
            <span className={w.totalSub}>预估费用（running 口径，USD）</span>
            <span className={w.totalSub}>{price.gpuHours} GPU·时</span>
          </div>
          <div className={w.totalLine}>
            <span className={w.totalBig}>{formatUsd(price.hourly)}</span>
            <span className={w.totalSub}>每小时 · 约 {formatUsd(price.monthly)} / 月</span>
          </div>
          <span className={w.hint}>
            实际计费以生命周期为准：provisioning 不计，running 计算力+存储，stopped 仅计存储（PRD §7.4）
          </span>
        </div>
      </Card>
    </div>
  );
}
