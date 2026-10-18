// 区域选择器（PRD §3.3：区域为按页上下文控件，不再是全局常驻条）
import { REGION_LIST, REGION_META } from '../../lib/ids';
import type { RegionCode } from '../../types/domain';
import { Select } from './Input';
import s from './ui.module.css';

export interface RegionSelectProps {
  value: RegionCode;
  onChange: (r: RegionCode) => void;
  /** 非 region 维度的页面：渲染为禁用 + tooltip 说明，不做假控件（§4.4.1） */
  disabledReason?: string;
  includeAll?: boolean;
  ariaLabel?: string;
}

export function RegionSelect({
  value,
  onChange,
  disabledReason,
  includeAll,
  ariaLabel = '区域',
}: RegionSelectProps) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <Select
        value={value}
        aria-label={ariaLabel}
        title={disabledReason ?? '切换区域后数据将按该区域重新计算'}
        disabled={Boolean(disabledReason)}
        onChange={(e) => onChange(e.target.value as RegionCode)}
        style={{ minWidth: includeAll ? 148 : 118 }}
      >
        {includeAll && <option value="all">全部区域</option>}
        {REGION_LIST.map((r) => (
          <option key={r} value={r}>
            {REGION_META[r].label} {REGION_META[r].iso}
          </option>
        ))}
      </Select>
      {disabledReason && (
        <span className={s.muted} style={{ fontSize: 11 }}>
          {disabledReason}
        </span>
      )}
    </div>
  );
}

/** 页头内嵌区域标签（只读展示当前上下文） */
export function RegionInline({ region }: { region: RegionCode }) {
  return (
    <span className={s.secondary} style={{ fontSize: 13 }}>
      {REGION_META[region].label} {REGION_META[region].iso}
    </span>
  );
}
