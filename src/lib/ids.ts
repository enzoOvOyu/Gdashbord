// 单一事实来源：资源类型 ↔ 路由 ↔ 标识 ↔ 色彩 ↔ 图标（PRD §5.2.1 / ARCH §12.6 / DESIGN §2.6）
// 任何页面/组件引用类型都必须取本表同一份常量，禁止第二套命名。
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

export const KIND_META: Record<ResourceKind, KindMeta> = {
  gpu_vm: {
    kind: 'gpu_vm',
    routeKey: 'servers',
    label: 'GPU 云服务器',
    prefix: 'srv-',
    colorVar: 'var(--rs-type-server)',
    icon: '🖥',
  },
  gpu_baremetal: {
    kind: 'gpu_baremetal',
    routeKey: 'baremetal',
    label: 'GPU 裸金属',
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
    label: '推理服务',
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
export const REGION_META: Record<RegionCode, { label: string; iso: string }> = {
  jp: { label: '日本', iso: 'JP' },
  th: { label: '泰国', iso: 'TH' },
  sg: { label: '新加坡', iso: 'SG' },
  us: { label: '美国', iso: 'US' },
};
export const REGION_LIST: RegionCode[] = ['jp', 'th', 'sg', 'us'];

// ─────────── 节点池显示名（PRD §9.1 / ARCH §12.6） ───────────
export const NODE_POOL_LABEL: Record<NodePoolCode, string> = {
  H100_SXM: 'H100 SXM',
  H200_NVL: 'H200 NVL',
  B200_NVL72: 'B200 NVL72（GB200 机柜）',
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
