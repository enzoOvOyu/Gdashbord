// UI 原语统一出口（ARCH §3 components/ui）
import uiStyles from './ui.module.css';

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
export { Card } from './Card';
export { Badge } from './Badge';
export type { BadgeTone } from './Badge';
export { StatTile } from './StatTile';
export { Tabs } from './Tabs';
export { Table, EmptyState } from './Table';
export type { Column } from './Table';
export { Input, Select } from './Input';

// v0.6 新增：三档展开、删除确认、字段展示、指标卡、计费与向导共用控件
export { Drawer, DrawerTabs } from './Drawer';
export { ConfirmDialog } from './ConfirmDialog';
export { KeyValue, InfoCard } from './KeyValue';
export type { KVItem } from './KeyValue';
export { MetricCard, Sparkline } from './MetricCard';
export type { MetricCardProps, SparkPoint } from './MetricCard';
export { PageHeader, SectionTitle, Toolbar } from './PageHeader';
export { Segmented, Progress } from './Segmented';
export type { SegmentedOption } from './Segmented';
export { Field, SwitchRow, PickCard, CardGrid } from './Field';
export { ToastHost, toast, useToastStore } from './Toast';
export { RegionSelect, RegionInline } from './RegionSelect';

/** 样式类映射（`import { ui as s } from '.../ui'`） */
export { uiStyles as ui };
