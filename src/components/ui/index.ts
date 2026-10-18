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

/** 样式类映射（`import { ui as s } from '.../ui'`） */
export { uiStyles as ui };
