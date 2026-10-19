// 单一事实来源：资源类型 ↔ 路由 ↔ 标识 ↔ 色彩 ↔ 图标（PRD §5.2.1 / ARCH §12.6 / DESIGN §2.6）
// 任何页面/组件引用类型都必须取本表同一份常量，禁止第二套命名。
import { t } from '../i18n';
import { Boxes, Cpu, Server, Zap, type LucideIcon } from 'lucide-react';
import type {
  DisplayId,
  NodePoolCode,
  RegionCode,
  ResourceKind,
  ResourceUuid,
} from '../types/domain';

/**
 * 资源类型图标唯一来源（DESIGN §2.6）。
 * 部署中心入口、资源列表、资源详情、类型筛选器必须引用同一套图标组件，
 * 禁止各写一套 emoji 或图标（v0.5 的「图标不对应」缺陷已修复）。
 */
export const KIND_ICON: Record<ResourceKind, LucideIcon> = {
  gpu_vm: Server,
  gpu_baremetal: Cpu,
  vgpu: Boxes,
  inference: Zap,
};

export type { DisplayId, ResourceUuid };
export type RouteKey = 'servers' | 'baremetal' | 'vgpu' | 'inference';

export interface KindMeta {
  kind: ResourceKind;
  routeKey: RouteKey;
  label: string;
  prefix: string;
  colorVar: string;
  icon: string;
}

// 注意：label 用 getter 惰性求值——模块级 t() 在加载时只算一次，切换语言后不更新；
// getter 每次访问重新调用 t()，配合 ConsoleLayout 订阅 locale store 实现即时刷新（DESIGN §5.24）。
export const KIND_META: Record<ResourceKind, KindMeta> = {
  gpu_vm: {
    kind: 'gpu_vm',
    routeKey: 'servers',
    get label() {
      return t('kind.server');
    },
    prefix: 'srv-',
    colorVar: 'var(--rs-type-server)',
    icon: '🖥',
  },
  gpu_baremetal: {
    kind: 'gpu_baremetal',
    routeKey: 'baremetal',
    get label() {
      return t('kind.baremetal');
    },
    prefix: 'bm-',
    colorVar: 'var(--rs-type-baremetal)',
    icon: '🔩',
  },
  vgpu: {
    kind: 'vgpu',
    routeKey: 'vgpu',
    label: 'vGPU',
    prefix: 'vgpu-',
    colorVar: 'var(--rs-type-vgpu)',
    icon: '🧩',
  },
  inference: {
    kind: 'inference',
    routeKey: 'inference',
    get label() {
      return t('kind.inference');
    },
    prefix: 'inf-',
    colorVar: 'var(--rs-type-inference)',
    icon: '⚡',
  },
};

export const KIND_LIST: ResourceKind[] = [
  'gpu_vm',
  'gpu_baremetal',
  'vgpu',
  'inference',
];

export const kindMeta = (kind: ResourceKind): KindMeta => KIND_META[kind];
export const routeKeyOf = (kind: ResourceKind): RouteKey => KIND_META[kind].routeKey;
export const kindOfRouteKey = (routeKey: string): ResourceKind | undefined =>
  KIND_LIST.find((k) => KIND_META[k].routeKey === routeKey);

// ─────────── 区域（PRD §9.2 / ARCH §12.6） ───────────
// label getter 化：语言切换后即时更新（见 KIND_META 注释）
export const REGION_META: Record<RegionCode, { label: string; iso: string }> = {
  jp: {
    iso: 'JP',
    get label() {
      return t('region.jp');
    },
  },
  th: {
    iso: 'TH',
    get label() {
      return t('region.th');
    },
  },
  sg: {
    iso: 'SG',
    get label() {
      return t('region.sg');
    },
  },
  us: {
    iso: 'US',
    get label() {
      return t('region.us');
    },
  },
};
export const REGION_LIST: RegionCode[] = ['jp', 'th', 'sg', 'us'];

// ─────────── 节点池显示名（PRD §9.1 / ARCH §12.6） ───────────
// getter 化：fixtures/handlers 消费本表时同样拿到当前语言（数据操作用途除外，
// 如标签后缀剥离走中文源，须用 NODE_POOL_LABEL 前先确认语言，或直接用池码）
export const NODE_POOL_LABEL: Record<NodePoolCode, string> = {
  H100_SXM: 'H100 SXM',
  H200_NVL: 'H200 NVL',
  get B200_NVL72() {
    return t('spec.b200nvl72');
  },
  B300: 'B300',
  GB300_NVL72: 'GB300 NVL72',
};
export const NODE_POOL_LIST: NodePoolCode[] = [
  'H100_SXM',
  'H200_NVL',
  'B200_NVL72',
  'B300',
  'GB300_NVL72',
];

// ─────────── ID 构造与校验（PRD §5.5） ───────────
const ALPHANUM = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** display_id = <类型前缀><6位小写字母数字>，全局唯一 */
export function makeDisplayId(kind: ResourceKind, rand: () => number): DisplayId {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHANUM[Math.floor(rand() * ALPHANUM.length)];
  return `${KIND_META[kind].prefix}${s}` as DisplayId;
}

export const asResourceUuid = (v: string): ResourceUuid => v as ResourceUuid;
export const asDisplayId = (v: string): DisplayId => v as DisplayId;

/** 面包屑/搜索展示统一用 display_id（PRD §5.5） */
export const displayIdText = (d: DisplayId): string => d as string;

/** ⌘K 搜索：可按 display_id 或 resource_uuid 检索（ARCH §12.6） */
export function matchesResourceQuery(
  displayId: DisplayId,
  uuid: ResourceUuid,
  q: string,
): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    (displayId as string).toLowerCase().includes(s) ||
    (uuid as string).toLowerCase().includes(s)
  );
}

/** 详情路由（ARCH §4.1：参数统一为 resourceUuid） */
export const resourceDetailPath = (kind: ResourceKind, uuid: ResourceUuid): string =>
  `/resources/${KIND_META[kind].routeKey}/${uuid as string}`;
export const resourceListPath = (kind: ResourceKind): string =>
  `/resources/${KIND_META[kind].routeKey}`;
