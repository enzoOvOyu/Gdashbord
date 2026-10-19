// 新建 vGPU（PRD §4.2.3：CoreWeave CKS / 火山引擎 VKE 托管 K8s）
import { t } from '../../i18n';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ui as s,
  Field,
  Input,
  Select,
  SwitchRow,
  Button,
  PickCard,
  CardGrid,
  toast,
  EmptyState,
} from '../../components/ui';
import { Trash2, Plus } from 'lucide-react';
import { NODE_POOL_LABEL } from '../../lib/ids';
import type { NodePoolCode } from '../../types/domain';
import { WIZARD_STEP_SCHEMAS } from './schemas';
import { WizardShell } from './shared/WizardShell';
import { ProjectRegionStep, type ProjectRegionValue } from './shared/ProjectRegionStep';
import { estimateVgpu, type DiscountKey } from './shared/pricing';
import {
  NodePoolScalingForm,
  ScalingSwitch,
  type NodePoolScalingValue,
} from './shared/ScalingForm';
import { useCreateOrder, useNodePools, useProjects } from '../shared/api';
import type { RegionCode } from '../../types/domain';

const STEPS = [t('deploy.stepProjectRegion'), t('deploy.cpStep'), t('deploy.poolSliceStep'), t('detail.netStorage'), t('deploy.accessStep')];
const MIG_PROFILES = ['1g.24gb', '2g.48gb', '3g.96gb'];

interface PoolEntry {
  node_pool: NodePoolCode;
  node_count: number;
  slicing_policy: 'none' | 'mig' | 'time_slicing' | 'mps';
  mig_profile: string;
  time_slice_share: number;
  /** v0.7 弹性区间（每池节点数）；未开启弹性时等于 node_count */
  min_nodes: number;
  max_nodes: number;
}

export default function VgpuWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [base, setBase] = useState<ProjectRegionValue>({ project_id: 0, region: 'jp', name: '' });
  const [k8sVersion, setK8sVersion] = useState<'1.28' | '1.29' | '1.30' | '1.31'>('1.31');
  const [tier, setTier] = useState<'standard' | 'ha'>('standard');
  const [apiPublic, setApiPublic] = useState(false);
  const [pools, setPools] = useState<PoolEntry[]>([
    {
      node_pool: 'H100_SXM',
      node_count: 2,
      slicing_policy: 'none',
      mig_profile: '2g.48gb',
      time_slice_share: 4,
      min_nodes: 2,
      max_nodes: 4,
    },
  ]);
  const [vpc, setVpc] = useState('default-vpc');
  const [subnet, setSubnet] = useState('subnet-az1');
  const [cni, setCni] = useState<'cilium' | 'calico'>('cilium');
  const [ingress, setIngress] = useState(true);
  const [storageClass, setStorageClass] = useState<'ssd' | 'nvme' | 'shared-fs'>('nvme');
  const [pvcGb, setPvcGb] = useState(500);
  const [kubeconfig, setKubeconfig] = useState<'download' | 'console'>('console');
  const [rbacAdmin, setRbacAdmin] = useState(true);
  // v0.7 弹性伸缩开关（vGPU：由原 autoscale 升级；策略模型 = 节点池伸缩，每池 min/max 节点）
  const [elasticScaling, setElasticScaling] = useState(false);
  const [scalingCfg, setScalingCfg] = useState<NodePoolScalingValue>({
    strategy_model: 'node_pool',
    trigger_metric: 'queue_depth',
    target_value: 20,
    min_size: 2,
    max_size: 4,
    fallback_enabled: true,
    cooldown_s: 600,
  });
  const [discount, setDiscount] = useState<DiscountKey>('on_demand');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: poolViews = [] } = useNodePools(base.region);
  const { data: projects = [] } = useProjects() as {
    data: Array<{ id: number; name: string; is_default: boolean; default_region: RegionCode }>;
  };
  const create = useCreateOrder();

  const minNodes = pools.reduce((a, p) => a + p.min_nodes, 0);
  const maxNodes = pools.reduce((a, p) => a + p.max_nodes, 0);

  const currentValues = {
    ...base,
    k8s_version: k8sVersion,
    control_plane_tier: tier,
    api_server_public: apiPublic,
    pools,
    vpc,
    subnet,
    network_plugin: cni,
    ingress_enabled: ingress,
    storage_class: storageClass,
    default_pvc_gb: pvcGb,
    kubeconfig_access: kubeconfig,
    rbac_default_admin: rbacAdmin,
    elastic_scaling: elasticScaling,
    // 策略区间的 min/max = 各池 min/max 之和（§4.2.6.3 与工作台同一数据模型）
    scaling: elasticScaling ? { ...scalingCfg, min_size: minNodes, max_size: maxNodes } : null,
  };

  const validate = (i: number): boolean => {
    const schema = WIZARD_STEP_SCHEMAS.vgpu[i];
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

  const gpusPer = (code: NodePoolCode): number =>
    poolViews.find((p) => p.code === code)?.gpus_per_node ?? 8;

  const nodeTotal = pools.reduce((a, p) => a + p.node_count, 0);
  const gpuTotal = pools.reduce((a, p) => a + p.node_count * gpusPer(p.node_pool), 0);

  const price = estimateVgpu({
    region: base.region,
    ha: tier === 'ha',
    pools: pools.map((p) => ({ node_pool: p.node_pool, node_count: p.node_count, gpusPerNode: gpusPer(p.node_pool) })),
    pvcGb,
    discount,
    scaling: elasticScaling ? { current: nodeTotal, min: minNodes, max: maxNodes } : null,
  });

  const submit = async (): Promise<void> => {
    if (!validate(STEPS.length - 1)) return;
    try {
      const res = await create.mutateAsync({
        resource_kind: 'vgpu',
        region: base.region,
        node_pool: pools[0].node_pool,
        project_id: base.project_id,
        name: base.name,
        source_type: 'direct',
        requested_spec: {
          k8s_version: k8sVersion,
          control_plane_tier: tier,
          api_server_public: apiPublic,
          api_server_allow_cidrs: [],
          pools: pools.map((p) => ({
            ...p,
            mig_profile: p.slicing_policy === 'mig' ? p.mig_profile : null,
            time_slice_share: p.slicing_policy === 'time_slicing' ? p.time_slice_share : null,
          })),
          node_count: nodeTotal,
          gpu_count: gpuTotal,
          network_plugin: cni,
          ingress_enabled: ingress,
          ingress_class: ingress ? 'nginx' : null,
          ib_enabled: false,
          storage_class: storageClass,
          default_pvc_gb: pvcGb,
          storage_gb: pvcGb,
          kubeconfig_access: kubeconfig,
          rbac_default_admin: rbacAdmin,
          scaling: elasticScaling
            ? { ...scalingCfg, min_size: minNodes, max_size: maxNodes }
            : null,
        },
      });
      toast.success(t('deploy.vgpuAccepted'));
      navigate(`/resources/vgpu/${res.resource_uuid}`);
    } catch {
      toast.error(t('deploy.createFailed'));
    }
  };

  const available = poolViews.filter((p) => p.available_in_region);

  const updatePool = (idx: number, patch: Partial<PoolEntry>): void => {
    setPools((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  /**
   * 开启弹性时以各池当前节点数为基线初始化弹性区间（min = 当前节点数，max = 当前 + 2），
   * 保证「当前节点数 ∈ [min, max]」且策略 min/max 为各池之和（§4.2.6.3）。
   */
  const setElasticScalingWithDefaults = (v: boolean): void => {
    setElasticScaling(v);
    if (v) {
      setPools((prev) =>
        prev.map((p) => ({
          ...p,
          min_nodes: Math.max(1, p.node_count),
          max_nodes: Math.min(64, p.node_count + 2),
        })),
      );
    }
  };

  return (
    <WizardShell
      kind="vgpu"
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
          nameHint={t('deploy.vgpuNameHint')}
        />
      )}

      {step === 1 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div className={s.formGrid}>
            <Field label={t('deploy.k8sVersion')} required error={errors.k8s_version}>
              <Select value={k8sVersion} onChange={(e) => setK8sVersion(e.target.value as typeof k8sVersion)}>
                <option value="1.28">{t('vgpu.k8s128')}</option>
                <option value="1.29">{t('vgpu.k8s129')}</option>
                <option value="1.30">{t('vgpu.k8s130')}</option>
                <option value="1.31">{t('vgpu.k8s131')}</option>
              </Select>
            </Field>
            <Field label={t('deploy.cpSpec')} required error={errors.control_plane_tier}>
              <Select value={tier} onChange={(e) => setTier(e.target.value as typeof tier)}>
                <option value="standard">{t('vgpu.tierStandard')}</option>
                <option value="ha">{t('vgpu.tierHa')}</option>
              </Select>
            </Field>
          </div>
          <SwitchRow label={t('deploy.apiPublic')} checked={apiPublic} onChange={setApiPublic} />
        </div>
      )}

      {step === 2 && (
        <div className={s.col} style={{ gap: 16 }}>
          {available.length === 0 ? (
            <EmptyState icon="📭" title={t('deploy.noPoolsInRegion')} hint={t('deploy.backToStep1')} />
          ) : (
            pools.map((p, idx) => (
              <div
                key={idx}
                style={{ border: '1px solid var(--rs-border)', borderRadius: 8, padding: 12 }}
              >
                <div className={s.row} style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <b>{t('deploy.poolValue', { v0: idx + 1 })}</b>
                  {pools.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 size={13} color="var(--rs-danger)" />}
                      onClick={() => setPools((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      {t('common.remove')}
                    </Button>
                  )}
                </div>
                <CardGrid>
                  {available.map((pv) => (
                    <PickCard
                      key={pv.code}
                      selected={p.node_pool === pv.code}
                      onClick={() => updatePool(idx, { node_pool: pv.code })}
                      title={pv.display_name}
                      meta={t('deploy.poolSummary', { v0: pv.gpus_per_node, v1: pv.vram_gb })}
                      price={t('deploy.ratePerGpuHour', { v0: pv.unit_price.toFixed(2) })}
                    />
                  ))}
                </CardGrid>
                <div className={s.formGrid} style={{ marginTop: 12 }}>
                  <Field label={t('common.nodeCount')}>
                    <Input
                      type="number"
                      value={p.node_count}
                      onChange={(e) => updatePool(idx, { node_count: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label={t('deploy.slicePolicy')}>
                    <Select
                      value={p.slicing_policy}
                      onChange={(e) =>
                        updatePool(idx, { slicing_policy: e.target.value as PoolEntry['slicing_policy'] })
                      }
                    >
                      <option value="none">{t('deploy.fullPassthrough')}</option>
                      <option value="mig">{t('vgpu.migSlices')}</option>
                      <option value="time_slicing">Time-Slicing</option>
                      <option value="mps">MPS</option>
                    </Select>
                  </Field>
                  {p.slicing_policy === 'mig' && (
                    <Field label="MIG profile">
                      <Select value={p.mig_profile} onChange={(e) => updatePool(idx, { mig_profile: e.target.value })}>
                        {MIG_PROFILES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  {p.slicing_policy === 'time_slicing' && (
                    <Field label={t('deploy.timeSlicing')}>
                      <Input
                        type="number"
                        value={p.time_slice_share}
                        onChange={(e) => updatePool(idx, { time_slice_share: Number(e.target.value) })}
                      />
                    </Field>
                  )}
                  {/* v0.7：开启弹性后每池显示 min/max 节点数（§4.2.3 / §4.2.6） */}
                  {elasticScaling && (
                    <>
                      <Field label={t('deploy.poolMinNodes')}>
                        <Input
                          type="number"
                          min={1}
                          value={p.min_nodes}
                          onChange={(e) => updatePool(idx, { min_nodes: Number(e.target.value) })}
                        />
                      </Field>
                      <Field label={t('deploy.poolMaxNodes')}>
                        <Input
                          type="number"
                          min={1}
                          value={p.max_nodes}
                          onChange={(e) => updatePool(idx, { max_nodes: Number(e.target.value) })}
                        />
                      </Field>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
          {pools.length < 5 && available.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus size={14} />}
              onClick={() =>
                setPools((prev) => [
                  ...prev,
                  {
                    node_pool: available[0].code,
                    node_count: 1,
                    slicing_policy: 'none',
                    mig_profile: '2g.48gb',
                    time_slice_share: 4,
                    min_nodes: 1,
                    max_nodes: 3,
                  },
                ])
              }
            >
              {t('deploy.addPool')}
            </Button>
          )}
          {errors['pools'] && <div className={s.fieldError}>{errors['pools']}</div>}
          <div className={s.muted} style={{ fontSize: 12 }}>
            {t('vgpu.poolTotals', { v0: nodeTotal, v1: gpuTotal })}{pools.map((p) => NODE_POOL_LABEL[p.node_pool]).join(t('common.listSep'))}
          </div>

          {/* v0.7 弹性伸缩（§4.2.3 第 3 步 / §4.2.6）：由原 autoscale 升级为统一开关 */}
          <ScalingSwitch checked={elasticScaling} onChange={setElasticScalingWithDefaults} />
          {elasticScaling && (
            <>
              <NodePoolScalingForm
                value={{ ...scalingCfg, min_size: minNodes, max_size: maxNodes }}
                onChange={(v) => setScalingCfg(v)}
                sizeUnit={t('deploy.unitNode')}
                hideSizeFields
                sizeSummary={t('deploy.vgpuBandSummary', { v0: minNodes, v1: maxNodes })}
              />
              <div className={s.muted} style={{ fontSize: 12 }}>
                ⚠ {t('vgpu.licenseHint')}
              </div>
            </>
          )}
          {errors['scaling'] && <div className={s.fieldError}>{errors['scaling']}</div>}
        </div>
      )}

      {step === 3 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div className={s.formGrid}>
            <Field label="VPC" required error={errors.vpc}>
              <Input value={vpc} onChange={(e) => setVpc(e.target.value)} />
            </Field>
            <Field label={t('deploy.subnet')} required error={errors.subnet}>
              <Select value={subnet} onChange={(e) => setSubnet(e.target.value)}>
                <option value="subnet-az1">{base.region}-az1</option>
                <option value="subnet-az2">{base.region}-az2</option>
              </Select>
            </Field>
            <Field label={t('deploy.cni')} required>
              <Select value={cni} onChange={(e) => setCni(e.target.value as typeof cni)}>
                <option value="cilium">Cilium</option>
                <option value="calico">Calico</option>
              </Select>
            </Field>
            <Field label="StorageClass" required>
              <Select value={storageClass} onChange={(e) => setStorageClass(e.target.value as typeof storageClass)}>
                <option value="ssd">SSD</option>
                <option value="nvme">NVMe</option>
                <option value="shared-fs">{t('deploy.sharedFs')}</option>
              </Select>
            </Field>
            <Field label={t('deploy.defaultPvc')}>
              <Input type="number" value={pvcGb} onChange={(e) => setPvcGb(Number(e.target.value))} />
            </Field>
          </div>
          <SwitchRow label={t('deploy.ingress')} checked={ingress} onChange={setIngress} />
        </div>
      )}

      {step === 4 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div className={s.formGrid}>
            <Field label={t('deploy.kubeconfig')} required>
              <Select value={kubeconfig} onChange={(e) => setKubeconfig(e.target.value as typeof kubeconfig)}>
                <option value="download">{t('common.download')}</option>
                <option value="console">{t('common.managedConsole')}</option>
              </Select>
            </Field>
          </div>
          <SwitchRow label={t('deploy.clusterAdmin')} checked={rbacAdmin} onChange={setRbacAdmin} />
          <div className={s.muted} style={{ fontSize: 12 }}>
            {t('deploy.vgpuBillingHint')}
          </div>
        </div>
      )}
    </WizardShell>
  );
}
