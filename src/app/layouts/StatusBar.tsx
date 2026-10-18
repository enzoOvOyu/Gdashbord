// StatusBar 顶部状态栏（PRD §3.2：全部由接口真实派生，禁止前端写死常量）
// v0.6：移除被判定为假数据的「区域余额 / 月度消费 / 延迟」硬编码值与写死延迟。
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
  ok: { icon: CircleCheck, color: 'var(--rs-success)', label: '服务正常' },
  degraded: { icon: AlertTriangle, color: 'var(--rs-warning)', label: '部分降级' },
  down: { icon: XCircle, color: 'var(--rs-danger)', label: '服务故障' },
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
        title={`就绪节点占比 ${(data.healthy_ratio * 100).toFixed(1)}% · 近 24h 故障事件 ${data.incident_count} 起`}
      >
        <HealthIcon size={14} />
        {health.label}
      </span>

      <span className={s.statusItem} title={`当前区域共 ${data.total_nodes} 节点`}>
        <MapPin size={14} />
        {REGION_META[region].label} {REGION_META[region].iso}
        {tight.length > 0
          ? ` · ${tight.map((t) => t.display_name).join('、')} 紧张`
          : data.supplies.length > 0
            ? ` · ${data.supplies.map((x) => `${x.display_name} 可用 ${x.availableGpu}`).join(' / ')}`
            : ' · 该区域无节点池'}
      </span>

      <Link
        to="/ops/cost"
        className={clsx(s.statusItem, s.statusItemClickable)}
        style={{ color: lowBalance ? 'var(--rs-warning)' : undefined }}
        title={lowBalance ? `余额低于阈值 ${formatUsd(data.low_balance_threshold)}` : '账户余额'}
      >
        <CreditCard size={14} />
        余额 {formatUsd(data.credit_balance)}
      </Link>

      <Link
        to="/ops/cost"
        className={clsx(s.statusItem, s.statusItemClickable)}
        style={{ color: data.cost_mtd > data.budget * 0.8 ? 'var(--rs-warning)' : undefined }}
        title={`本月花费（由 billing_usage 按 ${REGION_META[region].iso} 区域聚合）`}
      >
        <TrendingUp size={14} />
        本月 {formatUsd(data.cost_mtd)} / 预算 {formatUsd(data.budget)}
      </Link>

      <span className={s.statusItem} title="该区域运行中的资源数（按类型分列）">
        <MonitorPlay size={14} />
        运行中 {data.running_total}
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
        title="监控/计费流心跳可达性（WS 实时；降级为轮询时显示轮询）"
      >
        <span className={s.pulse} />
        {data.heartbeat === 'live' ? '实时' : '轮询'}
        <Radio size={14} />
      </span>
    </div>
  );
}
