// 新建 GPU 裸金属（PRD §4.2.2：Lambda 整机采购，**按「台」计费**，数量语义 = 台数）
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
import { estimateBareMetal, type DiscountKey } from './shared/pricing';
import { useCreateOrder, useNodePools, useProjects } from '../shared/api';

interface ImageLite {
  id: number;
  name: string;
  framework: string;
  size_gb: number;
}

const STEPS = ['项目与区域', '机型选型', '台数与直通策略', '网络与带外', 'OS 与确认'];
const MIG_PROFILES = ['1g.24gb', '2g.48gb', '3g.96gb', '4g.96gb'];

export default function BareMetalWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [base, setBase] = useState<ProjectRegionValue>({ project_id: 0, region: 'us', name: '' });
  const [machineType, setMachineType] = useState<NodePoolCode>('H100_SXM');
  const [machineCount, setMachineCount] = useState(1);
  const [passthrough, setPassthrough] = useState(true);
  const [mig, setMig] = useState('2g.48gb');
  const [raid, setRaid] = useState<'none' | 'raid0' | 'raid1' | 'raid10'>('raid0');
  const [vpc, setVpc] = useState('default-vpc');
  const [subnet, setSubnet] = useState('subnet-az1');
  const [ib, setIb] = useState(true);
  const [ipmi, setIpmi] = useState(true);
  const [bmcNet, setBmcNet] = useState<'shared' | 'dedicated'>('dedicated');
  const [imageRef, setImageRef] = useState('');
  const [hostPrefix, setHostPrefix] = useState('bm-node');
  const [sshKey, setSshKey] = useState('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEnzoDemoKey');
  const [fw, setFw] = useState<'recommended' | 'latest'>('recommended');
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

  // 裸金属仅展示支持裸金属的 OS 镜像（过滤容器镜像）
  const osImages = images.filter((i) => /ubuntu|centos|rocky|debian/i.test(i.name));

  const selected = pools.find((p) => p.code === machineType);
  const gpusPerNode = selected?.gpus_per_node ?? 8;

  const currentValues = {
    ...base,
    machine_type: machineType,
    machine_count: machineCount,
    passthrough,
    mig_partition: passthrough ? undefined : mig,
    raid_level: raid,
    vpc,
    subnet,
    ib_enabled: ib,
    ipmi_enabled: ipmi,
    bmc_network: bmcNet,
    image_ref: imageRef,
    hostname_prefix: hostPrefix,
    ssh_pubkey: sshKey,
    firmware_baseline: fw,
  };

  const validate = (i: number): boolean => {
    const schema = WIZARD_STEP_SCHEMAS.gpu_baremetal[i];
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

  const price = estimateBareMetal({
    pool: machineType,
    region: base.region,
    machineCount,
    gpusPerNode,
    discount,
  });

  const submit = async (): Promise<void> => {
    if (!validate(STEPS.length - 1)) return;
    try {
      const res = await create.mutateAsync({
        resource_kind: 'gpu_baremetal',
        region: base.region,
        node_pool: machineType,
        project_id: base.project_id,
        name: base.name,
        source_type: 'image',
        requested_spec: {
          machine_type: `${NODE_POOL_LABEL[machineType]} Node`,
          machine_count: machineCount,
          gpu_model: NODE_POOL_LABEL[machineType],
          gpu_count: machineCount * gpusPerNode,
          passthrough,
          mig_partition: passthrough ? null : mig,
          cpu_model: selected?.platform.cpu ?? '',
          local_nvme_gb: Number((selected?.platform.localNvme.match(/\d+/) ?? ['3840'])[0]) * 8,
          raid_level: raid,
          ipmi_enabled: ipmi,
          bmc_network: bmcNet,
          ib_enabled: ib,
          hostname_prefix: hostPrefix,
          firmware_baseline: fw,
          image_ref: imageRef,
          ssh_pubkey: sshKey,
        },
      });
      toast.success(`订单已受理：${machineCount} 台整机开始供给`);
      navigate(`/resources/baremetal/${res.resource_uuid}`);
    } catch {
      toast.error('创建失败，请检查配置');
    }
  };

  const available = pools.filter((p) => p.available_in_region);
  const unavailable = pools.filter((p) => !p.available_in_region);

  return (
    <WizardShell
      kind="gpu_baremetal"
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
          nameHint="留空则自动命名为 baremetal-<机型>-01"
        />
      )}

      {step === 1 && (
        <div className={s.col} style={{ gap: 12 }}>
          <div className={s.metricLabel}>整机采购（一台 = {gpusPerNode} 卡，不可按卡拆分）</div>
          {available.length === 0 ? (
            <EmptyState icon="📭" title="该区域暂无可用机型" hint="请返回第 1 步切换区域" />
          ) : (
            <CardGrid>
              {available.map((p) => (
                <PickCard
                  key={p.code}
                  selected={machineType === p.code}
                  onClick={() => setMachineType(p.code)}
                  title={`${p.display_name} 服务器`}
                  meta={`${p.gpus_per_node} × ${p.gpu_model} · ${p.platform.cpu}`}
                  price={`$${p.machine_unit_price.toFixed(2)}/台·时`}
                  extra={
                    <span className={s.muted} style={{ fontSize: 11 }}>
                      {p.platform.localNvme} · {p.platform.network}
                    </span>
                  }
                />
              ))}
            </CardGrid>
          )}
          {unavailable.length > 0 && (
            <div className={s.muted} style={{ fontSize: 12 }}>
              该区域不可用：
              {unavailable
                .map((p) => `${p.display_name}（仅 ${p.fallback_regions.map((r) => r.toUpperCase()).join('/')}）`)
                .join('、')}
            </div>
          )}
          {errors.machine_type && <div className={s.fieldError}>{errors.machine_type}</div>}
        </div>
      )}

      {step === 2 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div className={s.formGrid}>
            <Field
              label="采购台数"
              required
              error={errors.machine_count}
              hint={`整机总卡数 = ${machineCount} × ${gpusPerNode} = ${machineCount * gpusPerNode} 卡（仅展示，计费按台）`}
            >
              <Input
                type="number"
                value={machineCount}
                onChange={(e) => setMachineCount(Number(e.target.value))}
              />
            </Field>
            <Field label="RAID 级别" required>
              <Select value={raid} onChange={(e) => setRaid(e.target.value as typeof raid)}>
                <option value="none">none</option>
                <option value="raid0">RAID 0</option>
                <option value="raid1">RAID 1</option>
                <option value="raid10">RAID 10</option>
              </Select>
            </Field>
          </div>
          <SwitchRow
            label="整卡直通（passthrough）"
            checked={passthrough}
            onChange={(v) => setPassthrough(v)}
            hint="关闭直通时启用 MIG 切分"
          />
          {!passthrough && (
            <Field label="MIG 切片规格">
              <Select value={mig} onChange={(e) => setMig(e.target.value)}>
                {MIG_PROFILES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
          )}
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
          </div>
          <SwitchRow
            label="启用 InfiniBand（8 × 400 Gb/s NDR）"
            checked={ib}
            onChange={setIb}
          />
          <SwitchRow label="启用带外 IPMI 纳管" checked={ipmi} onChange={setIpmi} />
          {ipmi && (
            <Field label="BMC 网络">
              <Select value={bmcNet} onChange={(e) => setBmcNet(e.target.value as typeof bmcNet)}>
                <option value="dedicated">独立管理网口</option>
                <option value="shared">共享业务网口</option>
              </Select>
            </Field>
          )}
        </div>
      )}

      {step === 4 && (
        <div className={s.col} style={{ gap: 16 }}>
          <div>
            <div className={s.metricLabel} style={{ marginBottom: 8 }}>
              OS 镜像（仅裸金属可用）
            </div>
            <CardGrid>
              {osImages.slice(0, 6).map((img) => (
                <PickCard
                  key={img.id}
                  selected={imageRef === img.name}
                  onClick={() => setImageRef(img.name)}
                  title={img.name}
                  meta={`${img.framework} · ${img.size_gb} GB`}
                />
              ))}
            </CardGrid>
            {errors.image_ref && <div className={s.fieldError}>{errors.image_ref}</div>}
          </div>
          <div className={s.formGrid}>
            <Field label="主机名前缀" required error={errors.hostname_prefix}>
              <Input value={hostPrefix} onChange={(e) => setHostPrefix(e.target.value)} />
            </Field>
            <Field label="固件基线">
              <Select value={fw} onChange={(e) => setFw(e.target.value as typeof fw)}>
                <option value="recommended">推荐基线</option>
                <option value="latest">最新版本</option>
              </Select>
            </Field>
          </div>
          <Field label="SSH 公钥" required error={errors.ssh_pubkey}>
            <Input value={sshKey} onChange={(e) => setSshKey(e.target.value)} />
          </Field>
          <div className={s.muted} style={{ fontSize: 12 }}>
            计费口径：机器 {machineCount} 台 × ${price.lines[0]?.hourly ? (price.lines[0].hourly / machineCount).toFixed(2) : '0.00'}/台·时
            ；整机不支持按卡扩缩。
          </div>
        </div>
      )}
    </WizardShell>
  );
}
