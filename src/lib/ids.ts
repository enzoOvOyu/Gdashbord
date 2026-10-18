// 品牌类型：禁止 resourceUuid 与 display_id 混用（ARCH §6 / PRD §5.5）
export type ResourceUuid = string & { readonly __brand: 'ResourceUuid' };
export type DisplayId = string & { readonly __brand: 'DisplayId' };

// 区域码（单一事实来源：ARCH §12.6）
export type RegionCode = 'jp' | 'th' | 'sg' | 'us';

export const asResourceUuid = (v: string): ResourceUuid => v as ResourceUuid;
export const asDisplayId = (v: string): DisplayId => v as DisplayId;
