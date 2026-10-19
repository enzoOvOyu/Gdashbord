// nav store（ARCH §5 / DESIGN §5.10.1 / PRD §2.1）
// 侧边栏分组「用户收起意图」的持久化：localStorage key `rs.nav.collapsed`，值为分组 id 的 JSON 数组。
// 仅存用户意图 —— 激活路由所属分组的强制展开在渲染期派生（DESIGN §5.10.1「激活组强制展开」），
// 不写回本 store，离开该组后自然恢复用户收起态。
import { create } from 'zustand';

const STORAGE_KEY = 'rs.nav.collapsed';

function loadCollapsed(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

function saveCollapsed(list: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* 隐私模式 / 配额不足时静默降级为内存态 */
  }
}

interface NavState {
  /** 用户手动收起的分组 id（与角色解耦，角色变化不重置） */
  collapsedGroups: string[];
  toggleGroup: (id: string) => void;
  setCollapsed: (id: string, collapsed: boolean) => void;
}

export const useNavStore = create<NavState>((set, get) => ({
  collapsedGroups: loadCollapsed(),
  toggleGroup: (id) => {
    const cur = get().collapsedGroups;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    saveCollapsed(next);
    set({ collapsedGroups: next });
  },
  setCollapsed: (id, collapsed) => {
    const cur = get().collapsedGroups;
    const has = cur.includes(id);
    if (collapsed === has) return;
    const next = collapsed ? [...cur, id] : cur.filter((x) => x !== id);
    saveCollapsed(next);
    set({ collapsedGroups: next });
  },
}));
