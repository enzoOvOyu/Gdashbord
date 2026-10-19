// StatusBar 顶部状态栏（PRD §3.2：全部由接口真实派生，禁止前端写死常量）
// v0.6：移除被判定为假数据的「区域余额 / 月度消费 / 延迟」硬编码值与写死延迟。
import { t } from '../../i18n';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CircleCheck, AlertTriangle, XCircle, MapPin,
  CreditCard, TrendingUp, MonitorPlay, Radio,
} from 'lucide-react';
import clsx from 'clsx';
import s from './layout.module.css';
import { EP, api, withQuery } from '../../lib/api-client';
import { useRegionStore } from '../../stores/auth';
import { REGION_META, KIND_META, KIND_LIST, KIND_ICON } from '../../lib/ids';
import { formatUsd } from '../../lib/money';
import type { StatusBarView } from '../../features/shared/api';

const HEALTH = {
  ok: { icon: CircleCheck, color: 'var(--rs-success)', get label() { return t('sb.healthy'); } },
  degraded: { icon: AlertTriangle, color: 'var(--rs-warning)', get label() { return t('sb.degraded'); } },
  down: { icon: XCircle, color: 'var(--rs-danger)', get label() { return t('sb.down'); } },
} as const;

export function StatusBar() {
  const region = useRegionStore((st) => st.region);
  const { data } = useQuery<StatusBarView>({
    queryKey: ['status-bar', region],
    queryFn: () => api.get<StatusBarView>(withQuery(EP.statusBar, { region })),
    refetchInterval: 30_000,
  });

  if (!data) {
    return (
      <div className={s.statusbar}>
        <span className={s.statusItem}>…</span>
      </div>
    );
  }

  const health = HEALTH[data.service_health as keyof typeof HEALTH] ?? HEALTH.ok;
  const HealthIcon = health.icon;
  const tight = data.supplies.filter((x) => x.tight);
  const lowBalance = data.credit_balance < data.low_balance_threshold;

  return (
    <div className={s.statusbar}>
      <span
        className={clsx(s.statusItem, s.statusItemClickable)}
        style={{ color: health.color }}
        title={t('sb.nodeRatio', { v0: (data.healthy_ratio * 100).toFixed(1), v1: data.incident_count })}
      >
        <HealthIcon size={14} />
        {health.label}
      </span>

      <span className={s.statusItem} title={t('sb.nodesInRegion', { v0: data.total_nodes })}>
        <MapPin size={14} />
        {REGION_META[region].label} {REGION_META[region].iso}
        {tight.length > 0
          ? ` · ${t('sb.tightSupplies', { v0: tight.map((x) => x.display_name).join('、') })}`
          : data.supplies.length > 0
            ? ` · ${t('sb.availableSupplies', { v0: data.supplies.map((x) => `${x.display_name} ${x.availableGpu}`).join(' / ') })}`
            : ` · ${t('sb.noPoolsInRegion')}`}
      </span>

      <Link
        to="/ops/cost"
        className={clsx(s.statusItem, s.statusItemClickable)}
        style={{ color: lowBalance ? 'var(--rs-warning)' : undefined }}
        title={lowBalance ? t('sb.lowBalance', { v0: formatUsd(data.low_balance_threshold) }) : t('sb.balance')}
      >
        <CreditCard size={14} />
        {t('sb.balanceValue', { v0: formatUsd(data.credit_balance) })}
      </Link>

      <Link
        to="/ops/cost"
        className={clsx(s.statusItem, s.statusItemClickable)}
        style={{ color: data.cost_mtd > data.budget * 0.8 ? 'var(--rs-warning)' : undefined }}
        title={t('sb.costMtdHint', { v0: REGION_META[region].iso })}
      >
        <TrendingUp size={14} />
        {t('sb.costVsBudget', { v0: formatUsd(data.cost_mtd), v1: formatUsd(data.budget) })}
      </Link>

      <span className={s.statusItem} title={t('sb.runningByType')}>
        <MonitorPlay size={14} />
        {t('sb.runningTotal', { v0: data.running_total })}
        {KIND_LIST.map((k) =>
          data.running_by_kind[k] ? (
            <span key={k} className={s.statusItem} title={KIND_META[k].label}>
              {(() => {
                const Icon = KIND_ICON[k];
                return <Icon size={12} />;
              })()}
              {data.running_by_kind[k]}
            </span>
          ) : null,
        )}
      </span>

      <span
        className={s.statusItem}
        title={t('sb.heartbeatHint')}
      >
        <span className={s.pulse} />
        {data.heartbeat === 'live' ? t('sb.live') : t('sb.polling')}
        <Radio size={14} />
      </span>
    </div>
  );
}
