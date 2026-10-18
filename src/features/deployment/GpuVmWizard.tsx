// 新建 GPU 云服务器（PRD §4.2.1：阿里云/火山引擎骨架 + RunPod 卡片化；计费单位 = GPU·小时）
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ui as s,
  Field,
  Input,
  Select,
  SwitchRow,
  PickCard,
  CardGrid,
  toast,
  EmptyState,
} from '../../components/ui';
import { api, EP } from '../../lib/api-client';
import { NODE_POOL_LABEL } from '../../lib/ids';
import type { NodePoolCode, RegionCode } from '../../types/domain';
import { WIZARD_STEP_SCHEMAS } from './schemas';
import { WizardShell } from './shared/WizardShell';
import { ProjectRegionStep, type ProjectRegionValue } from './shared/ProjectRegionStep';
import { estimateVm, type DiscountKey } from './shared/pricing';
import { useCreateOrder, useNodePools, useProjects } from '../shared/api';
import type { NodePoolView } from '../shared/api';

interface ImageLite {
  id: number;
  name: string;
  framework: string;
  cuda_version: string;
  size_gb: number;
}

const STEPS = ['项目与区域', '规格选型', '镜像与存储', '网络与安全', '高级与确认'];

export default function GpuVmWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [base, setBase] = useState<ProjectRegionValue>({
    project_id: 0,
    region: 'jp',
    name: '',
  });
  const [pool, setPool] = useState<NodePoolCode>('H100_SXM');
  const [gpuCount, setGpuCount] = useState(1);
  const [vcpu, setVcpu] = useState(14);
  const [memoryGb, setMemoryGb] = useState(112);
  const [imageRef, setImageRef] = useState('');
  const [systemDiskGb, setSystemDiskGb] = useState(100);
  const [dataDiskGb, setDataDiskGb] = useState(0);
  const [diskType, setDiskType] = useState<'nvme_ssd' | 'ssd'>('nvme_ssd');
  const [vpc, setVpc] = useState('default-vpc');
  const [subnet, setSubnet] = useState('subnet-az1');
  const [sg, setSg] = useState('default');
  const [publicIp, setPublicIp] = useState(false);
  const [bandwidth, setBandwidth] = useState(10);
  const [sshKey, setSshKey] = useState('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEnzoDemoKey');
  const [quantity, setQuantity] = useState(1);
  const [idleShutdown, setIdleShutdown] = useState(0);
  const [discount, setDiscount] = useState<DiscountKey>('on_demand');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: pools = [] } = useNodePools(base.region);
  const { data: projects = [] } = useProjects() as {
    data: Array<{ id: number; name: string; is_default: boolean; default_region: RegionCode }>;
  };
  const { data: images = [] } = useQuery<ImageLite[]>({
    queryKey: ['images'],
    queryFn: () => api.get<ImageLite[]>(EP.images),
  });
  const create = useCreateOrder();

  const currentValues = {
    ...base,
    node_pool: pool,
    gpu_count: gpuCount,
    vcpu,
    memory_gb: memoryGb,
    image_ref: imageRef,
    system_disk_gb: systemDiskGb,
    data_disk_gb: dataDiskGb,
    system_disk_type: diskType,
    vpc,
    subnet,
    security_group: sg,
    public_ip: publicIp,
    bandwidth_mbps: bandwidth,
    ssh_pubkey: sshKey,
    quantity,
    auto_shutdown_idle_min: idleShutdown,
  };

  const validate = (i: number): boolean => {
    const schema = WIZARD_STEP_SCHEMAS.gpu_vm[i];
    if (!schema) return true;
    const res = schema.safeParse(currentValues);
    if (res.success) {
      setErrors({});
      return true;
    }
    const map: Record<string, string> = {};
    for (const issue of res.error.issues) {
      const k = String(issue.path[0] ?? 'form');
      if (!map[k]) map[k] = issue.message;
    }
    setErrors(map);
    return false;
  };

  const jump = (i: number): void => {
    if (i > step && !validate(step)) return;
    setStep(i);
  };

  const price = estimateVm({
    pool,
    region: base.region,
    gpuCount,
    systemDiskGb,
    dataDiskGb,
    publicIp,
    bandwidthMbps: bandwidth,
    quantity,
    discount,
  });

  const submit = async (): Promise<void> => {
    if (!validate(STEPS.length - 1)) return;
    try {
      const res = await create.mutateAsync({
        resource_kind: 'gpu_vm',
        region: base.region,
        node_pool: pool,
        project_id: base.project_id,
        name: base.name,
        source_type: 'image',
        requested_spec: {
          gpu_model: NODE_POOL_LABEL[pool],
          gpu_count: gpuCount,
          vcpu,
          memory_gb: memoryGb,
          storage_gb: systemDiskGb + dataDiskGb,
          image_ref: imageRef,
          env: { NVIDIA_VISIBLE_DEVICES: 'all' },
          ports: [22, 8888],
          ssh_pubkey: sshKey,
          public_ip: publicIp,
          bandwidth_mbps: bandwidth,
        },
      });
      toast.success(`订单已受理，开始供给（预估 ${price.hourly.toFixed(2)}/时）`);
      navigate(`/resources/servers/${res.resource_uuid}`);
    } catch {
      toast.error('创建失败，请检查配置');
    }
  };

  const available = pools.filter((p) => p.available_in_region);
  const unavailable = pools.filter((p) => !p.available_in_region);

  return (
    <WizardShell
      kind="gpu_vm"
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
          nameHint={`留空则自动命名为 ${'server'}-${pool}-01`}
        />
      )}

      {step === 1 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div>
            <div className={s.metricLabel} style={{ marginBottom: 8 }}>
              规格选型（卡片化比价 · 本区域单价已含区域系数）
            </div>
            {available.length === 0 ? (
              <EmptyState icon="📭" title="该区域暂无可用节点池" hint="请返回第 1 步切换区域" />
            ) : (
              <CardGrid>
                {available.map((p) => (
                  <PoolCard
                    key={p.code}
                    p={p}
                    selected={pool === p.code}
                    onSelect={() => {
                      setPool(p.code);
                      setGpuCount(Math.min(gpuCount, p.gpus_per_node));
                    }}
                  />
                ))}
              </CardGrid>
            )}
            {unavailable.length > 0 && (
              <div className={s.muted} style={{ fontSize: 12, marginTop: 8 }}>
                该区域不可用：
                {unavailable
                  .map((p) => `${NODE_POOL_LABEL[p.code]}（仅 ${p.fallback_regions.map((r) => r.toUpperCase()).join('/')}）`)
                  .join('、')}
              </div>
            )}
            {errors.node_pool && <div className={s.fieldError}>{errors.node_pool}</div>}
          </div>
          <div className={s.formGrid}>
            <Field label="GPU 数量" required error={errors.gpu_count}>
              <Select value={gpuCount} onChange={(e) => setGpuCount(Number(e.target.value))}>
                {[1, 2, 4, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} 卡
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="vCPU" required error={errors.vcpu}>
              <Select value={vcpu} onChange={(e) => setVcpu(Number(e.target.value))}>
                {[14, 28, 56, 112, 224].map((n) => (
                  <option key={n} value={n}>
                    {n} vCPU
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="内存" required error={errors.memory_gb}>
              <Select value={memoryGb} onChange={(e) => setMemoryGb(Number(e.target.value))}>
                {[112, 224, 448, 896, 1792].map((n) => (
                  <option key={n} value={n}>
                    {n} GB
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className={s.muted} style={{ fontSize: 12 }}>
            规格族：gpu.{gpuCount}x{NODE_POOL_LABEL[pool].replace(/\s/g, '')}.{vcpu}c.{memoryGb}g
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div>
            <div className={s.metricLabel} style={{ marginBottom: 8 }}>
              镜像
            </div>
            <CardGrid>
              {images.slice(0, 8).map((img) => (
                <PickCard
                  key={img.id}
                  selected={imageRef === img.name}
                  onClick={() => setImageRef(img.name)}
                  title={img.name}
                  meta={`${img.framework} · CUDA ${img.cuda_version} · ${img.size_gb} GB`}
                />
              ))}
            </CardGrid>
            {errors.image_ref && <div className={s.fieldError}>{errors.image_ref}</div>}
          </div>
          <div className={s.formGrid}>
            <Field label="系统盘（GB）" required error={errors.system_disk_gb}>
              <Input
                type="number"
                value={systemDiskGb}
                onChange={(e) => setSystemDiskGb(Number(e.target.value))}
              />
            </Field>
            <Field label="系统盘类型" required>
              <Select value={diskType} onChange={(e) => setDiskType(e.target.value as 'nvme_ssd' | 'ssd')}>
                <option value="nvme_ssd">NVMe SSD</option>
                <option value="ssd">SSD</option>
              </Select>
            </Field>
            <Field label="数据盘（GB）" error={errors.data_disk_gb}>
              <Input
                type="number"
                value={dataDiskGb}
                onChange={(e) => setDataDiskGb(Number(e.target.value))}
              />
            </Field>
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
            <Field label="安全组" required error={errors.security_group}>
              <Select value={sg} onChange={(e) => setSg(e.target.value)}>
                <option value="default">default</option>
                <option value="web">web</option>
              </Select>
            </Field>
          </div>
          <SwitchRow label="分配公网 IP" checked={publicIp} onChange={setPublicIp} />
          {publicIp && (
            <Field label="带宽（Mbps）" error={errors.bandwidth_mbps}>
              <Input
                type="number"
                value={bandwidth}
                onChange={(e) => setBandwidth(Number(e.target.value))}
              />
            </Field>
          )}
          <Field label="SSH 公钥" required error={errors.ssh_pubkey}>
            <Input value={sshKey} onChange={(e) => setSshKey(e.target.value)} />
          </Field>
        </div>
      )}

      {step === 4 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div className={s.formGrid}>
            <Field label="创建数量（实例）" required error={errors.quantity}>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </Field>
            <Field label="闲置自动关机（分钟）" error={errors.auto_shutdown_idle_min}>
              <Select value={idleShutdown} onChange={(e) => setIdleShutdown(Number(e.target.value))}>
                <option value={0}>不自动关机</option>
                <option value={30}>闲置 30 分钟</option>
                <option value={60}>闲置 60 分钟</option>
                <option value={120}>闲置 120 分钟</option>
              </Select>
            </Field>
          </div>
          <div className={s.muted} style={{ fontSize: 12 }}>
            创建后按 GPU·小时计费；停止后仅计存储。费用明细以右侧为准。
          </div>
        </div>
      )}
    </WizardShell>
  );
}

function PoolCard({
  p,
  selected,
  onSelect,
}: {
  p: NodePoolView;
  selected: boolean;
  onSelect: () => void;
}) {
  const avail = p.supply?.availableGpu ?? 0;
  return (
    <PickCard
      selected={selected}
      onClick={onSelect}
      title={
        <span>
          {p.display_name}
          <span className={s.muted}> · {p.gpus_per_node} 卡/节点</span>
        </span>
      }
      meta={`${p.gpu_model} · ${p.vram_gb} GB 显存 · ${p.interconnect}`}
      price={`$${p.unit_price.toFixed(2)}/GPU·时`}
      extra={
        <span className={s.muted} style={{ fontSize: 11 }}>
          本区域可用 {avail} / {p.supply?.totalGpu ?? 0} 卡
        </span>
      }
    />
  );
}
