// 资源详情分发（PRD §4.3：四类为各自独立的页面组件与展示规则，禁止共用模板）
import { t, dt } from '../../i18n';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ui as s, Card, EmptyState, Button } from '../../components/ui';
import { useResource } from '../shared/api';
import { DetailShell, ProvisioningNotice } from './detail/DetailShell';
import { ServerDetail, SERVER_TABS } from './detail/ServerDetail';
import { BareMetalDetail, BAREMETAL_TABS } from './detail/BareMetalDetail';
import { VgpuDetail, VGPU_TABS } from './detail/VgpuDetail';
import { InferenceDetail, INFERENCE_TABS } from './detail/InferenceDetail';
import { ProvisioningSteps } from '../shared/ProvisioningSteps';

/** 订单失败原因码 → 用户可读文案（ARCH §12.11 错误码模式；未知码原样展示） */
function failureReasonText(code: string | null | undefined): string {
  if (!code) return t('common.unknownReason');
  if (code === 'InsufficientCapacity') return t('fx.errCapacity');
  if (code === 'ImagePullFailed') return t('fx.errPull');
  if (code === 'DriverMismatch') return t('fx.errDriver');
  if (code === 'QuotaExceeded') return t('fx.errQuota');
  return code;
}

export default function ResourceDetailPage() {
  const { resourceUuid } = useParams();
  const { data: detail, isLoading, isError } = useResource(resourceUuid);
  const [tab, setTab] = useState('overview');

  if (isLoading) {
    return <EmptyState icon="⏳" title={t('rdp.loading')} />;
  }
  if (isError || !detail) {
    return (
      <EmptyState
        icon="🔍"
        title={t('rdp.notFound')}
        hint={t('detail.uuidLabel', { v0: resourceUuid ?? '—' })}
      />
    );
  }

  const tabs =
    detail.kind === 'gpu_vm' ? SERVER_TABS
    : detail.kind === 'gpu_baremetal' ? BAREMETAL_TABS
    : detail.kind === 'vgpu' ? VGPU_TABS
    : INFERENCE_TABS;

  // 四类详情页默认 Tab 不同（概览 / 实例管理）
  const normalized = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;

  const body =
    detail.kind === 'gpu_vm' ? (
      <ServerDetail detail={detail} tab={normalized as Parameters<typeof ServerDetail>[0]['tab']} />
    ) : detail.kind === 'gpu_baremetal' ? (
      <BareMetalDetail detail={detail} tab={normalized as Parameters<typeof BareMetalDetail>[0]['tab']} />
    ) : detail.kind === 'vgpu' ? (
      <VgpuDetail detail={detail} tab={normalized as Parameters<typeof VgpuDetail>[0]['tab']} />
    ) : (
      <InferenceDetail detail={detail} tab={normalized as Parameters<typeof InferenceDetail>[0]['tab']} />
    );

  return (
    <DetailShell
      detail={detail}
      tabs={tabs}
      active={normalized}
      onTab={setTab}
    >
      <div className={s.col} style={{ gap: 16 }}>
        {detail.status === 'provisioning' && (
          <Card>
            <div className={s.cardBody}>
              <ProvisioningNotice steps={detail.steps} kindLabel={''} />
              <ProvisioningSteps steps={detail.steps} />
            </div>
          </Card>
        )}
        {detail.status === 'error' && (
          <div
            style={{
              border: '1px solid var(--rs-danger)',
              background: 'var(--rs-danger)14',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <b>{t('fx.provisionFailed')}</b>{t('detail.failReason', { v0: failureReasonText(detail.order?.failure_reason) })}<div className={s.muted} style={{ fontSize: 12, marginTop: 4 }}>
              {t('detail.failedSubsteps', { v0: dt(detail.steps.find((x) => x.state === 'failed')?.step_key ?? '—') })}</div>
          </div>
        )}
        {body}
      </div>
    </DetailShell>
  );
}

export { Button };
