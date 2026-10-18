// 部署向导主控件（PRD §4.2 六步向导；ARCH §2 RHF + Zod）
// 下单产物为 deployment_orders（工作项），随后映射为 resources 并跳转详情（§5.3）。
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Loader2, ShieldAlert } from 'lucide-react';
import type { ResourceKind, NodePoolCode, RegionCode } from '../../types/domain';
import { Button, Card, Badge } from '../../components/ui';
import { ui as s } from '../../components/ui';
import { EP, api } from '../../lib/api-client';
import { KIND_META, NODE_POOL_LIST, REGION_LIST } from '../../lib/ids';
import { canCreateResource } from '../../lib/rbac';
import { NODE_PLATFORM } from '../../mocks/fixtures/gpu-specs';
import { useAuthStore, useRegionStore } from '../../stores/auth';
import {
  KIND_FORM_META,
  pickSpec,
} from './schemas';
import { buildSpec, defaultValues, fieldsOfStep, toPayload, wizardResolver, type WizardValues, type StepKey } from './form';
import { WIZARD_STEPS } from './form';
import { StepPool, StepImage, StepSpec, StepNetwork, StepEnv, StepConfirm } from './steps';
import w from './wizard.module.css';

/** 下单返回值（含异步映射出的资源 uuid，用于跳转 §5.3） */
interface OrderResult {
  id: number;
  order_uuid: string;
  status: string;
  resource_uuid?: string;
}

/** source_type 与来源实体映射（ARCH §13.1 来源追溯） */
function sourceOf(kind: ResourceKind): { source_type: string; source_ref_id: number | null } {
  if (kind === 'inference') return { source_type: 'model', source_ref_id: null };
  if (kind === 'gpu_vm' || kind === 'gpu_baremetal') return { source_type: 'image', source_ref_id: null };
  return { source_type: 'direct', source_ref_id: null };
}

export default function DeploymentWizard() {
  const { kind: kindParam } = useParams<{ kind: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((st) => st.role);
  const region = useRegionStore((st) => st.region);
  const [step, setStep] = useState(0);

  const kind = useMemo<ResourceKind>(() => mapRouteToKind(kindParam ?? ''), [kindParam]);

  const meta = KIND_FORM_META[kind];
  const pool0 = NODE_POOL_LIST[0] as NodePoolCode;

  const form = useForm<WizardValues>({
    resolver: wizardResolver(kind),
    mode: 'onChange',
    defaultValues: defaultValues(
      kind,
      pool0,
      (REGION_LIST.includes(region as RegionCode) ? region : 'jp') as RegionCode,
      NODE_PLATFORM[pool0],
      KIND_META[kind]?.label ?? '',
    ),
  });

  const allowed = canCreateResource(role);
  const stepKey = WIZARD_STEPS[step].key as StepKey;

  const create = useMutation<OrderResult, Error, WizardValues>({
    mutationFn: async (v) => {
      const src = sourceOf(kind);
      return api.post<OrderResult>(EP.orders, {
        resource_kind: kind,
        region: v.region,
        node_pool: v.node_pool,
        requested_spec: pickSpec(kind, toPayload(kind, v)),
        ...src,
      });
    },
    onSuccess: (order) => {
      // §5.3：下单成功跳转资源详情页；若后端尚未映射出资源则回列表
      if (order.resource_uuid) {
        navigate(`/resources/${KIND_META[kind].routeKey}/${order.resource_uuid}`);
      } else {
        navigate(`/resources/${KIND_META[kind].routeKey}`);
      }
    },
  });

  /** 下一步：先用 Zod 校验当前步字段（分步校验 §2） */
  const next = async () => {
    const ok = await form.trigger(fieldsOfStep(kind, stepKey) as Array<keyof WizardValues>);
    if (!ok) return;
    setStep((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
  };
  const prev = () => setStep((i) => Math.max(i - 1, 0));

  const submit = () => {
    form.handleSubmit((v) => create.mutate(v))();
  };

  if (!allowed) {
    return (
      <div className={w.page}>
        <Card title="无创建权限">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rs-s3)' }}>
            <ShieldAlert size={18} color="var(--rs-warning)" />
            <span className={s.secondary}>
              当前角色（{role}）不允许创建资源。请联系组织 Owner 或 Admin 调整角色。
            </span>
          </div>
        </Card>
      </div>
    );
  }

  const common = { kind, form };
  const isLast = step === WIZARD_STEPS.length - 1;

  return (
    <div className={w.page}>
      <div>
        <h1 className={w.title}>{meta.title}</h1>
        <p className={w.desc}>
          六步完成 {KIND_META[kind].label} 创建；下单生成工作项订单，并异步供给为资源实例。
        </p>
      </div>

      {/* 步骤条 */}
      <nav className={w.stepper}>
        {WIZARD_STEPS.map((st, i) => (
          <div key={st.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--rs-s2)' }}>
            {i > 0 && <span className={w.stepSep} />}
            <button
              type="button"
              className={`${w.stepItem} ${i === step ? w.stepActive : ''} ${i < step ? w.stepDone : ''}`}
              onClick={() => setStep(i)}
            >
              <span className={w.stepNum}>{i < step ? <Check size={12} /> : i + 1}</span>
              <span>{st.title}</span>
            </button>
          </div>
        ))}
      </nav>

      {/* 步骤内容 */}
      <div>
        {stepKey === 'pool' && <StepPool {...common} />}
        {stepKey === 'image' && <StepImage {...common} />}
        {stepKey === 'spec' && <StepSpec {...common} />}
        {stepKey === 'network' && <StepNetwork {...common} />}
        {stepKey === 'env' && <StepEnv {...common} />}
        {stepKey === 'confirm' && <StepConfirm {...common} />}
      </div>

      {create.error && (
        <Card title="下单失败">
          <span className={s.secondary}>{create.error.message}</span>
        </Card>
      )}

      {/* 操作条 */}
      <div className={w.actions}>
        <div className={w.actionsRight}>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ChevronLeft size={14} /> 取消
          </Button>
          {step > 0 && (
            <Button variant="secondary" onClick={prev}>
              <ChevronLeft size={14} /> 上一步
            </Button>
          )}
        </div>
        <div className={w.actionsRight}>
          <Badge tone="muted">
            第 {step + 1} / {WIZARD_STEPS.length} 步 · {WIZARD_STEPS[step].desc}
          </Badge>
          {isLast ? (
            <Button variant="primary" onClick={submit} disabled={create.isPending}>
              {create.isPending ? (
                <>
                  <Loader2 size={14} className="spin" /> 提交中…
                </>
              ) : (
                '确认创建'
              )}
            </Button>
          ) : (
            <Button variant="primary" onClick={next}>
              下一步 <ChevronRight size={14} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 路由段 → ResourceKind（与 lib/ids KIND_META.routeKey 单一映射）。
 * 兼容侧边栏语义入口：server / baremetal / vgpu / inference。
 */
const ROUTE_ALIAS: Record<string, ResourceKind> = {
  server: 'gpu_vm',
  servers: 'gpu_vm',
  gpu_vm: 'gpu_vm',
  baremetal: 'gpu_baremetal',
  gpu_baremetal: 'gpu_baremetal',
  vgpu: 'vgpu',
  inference: 'inference',
};

function mapRouteToKind(seg: string): ResourceKind {
  const hit = (Object.keys(KIND_META) as ResourceKind[]).find(
    (k) => KIND_META[k].routeKey === seg || k === seg,
  );
  return ROUTE_ALIAS[seg] ?? hit ?? 'gpu_vm';
}

export { buildSpec };
