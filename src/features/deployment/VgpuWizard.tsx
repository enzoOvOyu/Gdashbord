// 新建 vGPU（PRD §4.2.3：CoreWeave CKS / 火山引擎 VKE 托管 K8s）
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
import { useCreateOrder, useNodePools, useProjects } from '../shared/api';
import type { RegionCode } from '../../types/domain';

const STEPS = ['项目与区域', '控制面', '节点池与切片', '网络与存储', '访问与确认'];
const MIG_PROFILES = ['1g.24gb', '2g.48gb', '3g.96gb'];

interface PoolEntry {
  node_pool: NodePoolCode;
  node_count: number;
  slicing_policy: 'none' | 'mig' | 'time_slicing' | 'mps';
  mig_profile: string;
  time_slice_share: number;
}

export default function VgpuWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [base, setBase] = useState<ProjectRegionValue>({ project_id: 0, region: 'jp', name: '' });
  const [k8sVersion, setK8sVersion] = useState<'1.28' | '1.29' | '1.30' | '1.31'>('1.31');
  const [tier, setTier] = useState<'standard' | 'ha'>('standard');
  const [apiPublic, setApiPublic] = useState(false);
  const [pools, setPools] = useState<PoolEntry[]>([
    { node_pool: 'H100_SXM', node_count: 2, slicing_policy: 'none', mig_profile: '2g.48gb', time_slice_share: 4 },
  ]);
  const [vpc, setVpc] = useState('default-vpc');
  const [subnet, setSubnet] = useState('subnet-az1');
  const [cni, setCni] = useState<'cilium' | 'calico'>('cilium');
  const [ingress, setIngress] = useState(true);
  const [storageClass, setStorageClass] = useState<'ssd' | 'nvme' | 'shared-fs'>('nvme');
  const [pvcGb, setPvcGb] = useState(500);
  const [kubeconfig, setKubeconfig] = useState<'download' | 'console'>('console');
  const [rbacAdmin, setRbacAdmin] = useState(true);
  const [discount, setDiscount] = useState<DiscountKey>('on_demand');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: poolViews = [] } = useNodePools(base.region);
  const { data: projects = [] } = useProjects() as {
    data: Array<{ id: number; name: string; is_default: boolean; default_region: RegionCode }>;
  };
  const create = useCreateOrder();

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

  const price = estimateVgpu({
    region: base.region,
    ha: tier === 'ha',
    pools: pools.map((p) => ({ node_pool: p.node_pool, node_count: p.node_count, gpusPerNode: gpusPer(p.node_pool) })),
    pvcGb,
    discount,
  });

  const nodeTotal = pools.reduce((a, p) => a + p.node_count, 0);
  const gpuTotal = pools.reduce((a, p) => a + p.node_count * gpusPer(p.node_pool), 0);

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
        },
      });
      toast.success('订单已受理，托管控制面创建中');
      navigate(`/resources/vgpu/${res.resource_uuid}`);
    } catch {
      toast.error('创建失败，请检查配置');
    }
  };

  const available = poolViews.filter((p) => p.available_in_region);

  const updatePool = (idx: number, patch: Partial<PoolEntry>): void => {
    setPools((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
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
          nameHint="留空则自动命名为 cks-cluster-01"
        />
      )}

      {step === 1 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div className={s.formGrid}>
            <Field label="K8s 版本" required error={errors.k8s_version}>
              <Select value={k8sVersion} onChange={(e) => setK8sVersion(e.target.value as typeof k8sVersion)}>
                <option value="1.28">v1.28（维护期至 2026-08）</option>
                <option value="1.29">v1.29（维护期至 2026-12）</option>
                <option value="1.30">v1.30（维护期至 2027-04）</option>
                <option value="1.31">v1.31（当前推荐）</option>
              </Select>
            </Field>
            <Field label="控制面规格" required error={errors.control_plane_tier}>
              <Select value={tier} onChange={(e) => setTier(e.target.value as typeof tier)}>
                <option value="standard">Standard（单副本，$0.10/集群·时）</option>
                <option value="ha">HA（3 副本，$0.30/集群·时）</option>
              </Select>
            </Field>
          </div>
          <SwitchRow label="API Server 公网访问" checked={apiPublic} onChange={setApiPublic} />
        </div>
      )}

      {step === 2 && (
        <div className={s.col} style={{ gap: 16 }}>
          {available.length === 0 ? (
            <EmptyState icon="📭" title="该区域暂无可用节点池" hint="请返回第 1 步切换区域" />
          ) : (
            pools.map((p, idx) => (
              <div
                key={idx}
                style={{ border: '1px solid var(--rs-border)', borderRadius: 8, padding: 12 }}
              >
                <div className={s.row} style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <b>节点池 {idx + 1}</b>
                  {pools.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 size={13} color="var(--rs-danger)" />}
                      onClick={() => setPools((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      移除
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
                      meta={`${pv.gpus_per_node} 卡/节点 · ${pv.vram_gb} GB`}
                      price={`$${pv.unit_price.toFixed(2)}/GPU·时`}
                    />
                  ))}
                </CardGrid>
                <div className={s.formGrid} style={{ marginTop: 12 }}>
                  <Field label="节点数">
                    <Input
                      type="number"
                      value={p.node_count}
                      onChange={(e) => updatePool(idx, { node_count: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="GPU 切片策略">
                    <Select
                      value={p.slicing_policy}
                      onChange={(e) =>
                        updatePool(idx, { slicing_policy: e.target.value as PoolEntry['slicing_policy'] })
                      }
                    >
                      <option value="none">整卡直通（无切片）</option>
                      <option value="mig">MIG 切片</option>
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
                    <Field label="Time-Slicing 共享数">
                      <Input
                        type="number"
                        value={p.time_slice_share}
                        onChange={(e) => updatePool(idx, { time_slice_share: Number(e.target.value) })}
                      />
                    </Field>
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
                  },
                ])
              }
            >
              添加节点池
            </Button>
          )}
          {errors['pools'] && <div className={s.fieldError}>{errors['pools']}</div>}
          <div className={s.muted} style={{ fontSize: 12 }}>
            合计 {nodeTotal} 节点 / {gpuTotal} 卡 · 当前所选：
            {pools.map((p) => NODE_POOL_LABEL[p.node_pool]).join('、')}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div className={s.formGrid}>
            <Field label="VPC" required error={errors.vpc}>
              <Input value={vpc} onChange={(e) => setVpc(e.target.value)} />
            </Field>
            <Field label="子网（须与区域一致）" required error={errors.subnet}>
              <Select value={subnet} onChange={(e) => setSubnet(e.target.value)}>
                <option value="subnet-az1">{base.region}-az1</option>
                <option value="subnet-az2">{base.region}-az2</option>
              </Select>
            </Field>
            <Field label="网络插件" required>
              <Select value={cni} onChange={(e) => setCni(e.target.value as typeof cni)}>
                <option value="cilium">Cilium</option>
                <option value="calico">Calico</option>
              </Select>
            </Field>
            <Field label="StorageClass" required>
              <Select value={storageClass} onChange={(e) => setStorageClass(e.target.value as typeof storageClass)}>
                <option value="ssd">SSD</option>
                <option value="nvme">NVMe</option>
                <option value="shared-fs">共享文件系统</option>
              </Select>
            </Field>
            <Field label="默认 PVC（GB）">
              <Input type="number" value={pvcGb} onChange={(e) => setPvcGb(Number(e.target.value))} />
            </Field>
          </div>
          <SwitchRow label="启用 Ingress（Nginx）" checked={ingress} onChange={setIngress} />
        </div>
      )}

      {step === 4 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div className={s.formGrid}>
            <Field label="kubeconfig 获取方式" required>
              <Select value={kubeconfig} onChange={(e) => setKubeconfig(e.target.value as typeof kubeconfig)}>
                <option value="download">下载文件</option>
                <option value="console">托管控制台</option>
              </Select>
            </Field>
          </div>
          <SwitchRow label="默认授予集群管理员权限" checked={rbacAdmin} onChange={setRbacAdmin} />
          <div className={s.muted} style={{ fontSize: 12 }}>
            计费：控制面 + 各节点池 GPU·小时；费用明细见右侧（分三行）。
          </div>
        </div>
      )}
    </WizardShell>
  );
}
