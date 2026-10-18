// auth store（ARCH §5：用户 uuid/role + 当前 org + 当前 project）
import { create } from 'zustand';
import type { InternalId, Org, Project, User, UserRole } from '../types/domain';
import { VITE_DEFAULT_REGION } from '../mocks/lib/env';
import type { RegionCode } from '../types/domain';

interface AuthState {
  user: User;
  org: Org;
  project: Project;
  role: UserRole;
  setUser: (u: User) => void;
  setOrg: (o: Org) => void;
  setProject: (p: Project) => void;
  /** 演示用角色切换（5 种角色，PRD §8） */
  setRole: (r: UserRole) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: {
    id: 1 as InternalId,
    uuid: 'u-00000001-0000-4000-8000-000000000001',
    org_id: 1 as InternalId,
    email: 'owner@enzo.ai',
    display_name: 'Enzo Owner',
    role: 'owner',
    status: 'active',
  },
  org: {
    id: 1 as InternalId,
    name: 'Enzo AI Lab',
    slug: 'enzo-ai-lab',
    plan_code: 'standard',
    credit_balance: 1234.56,
    currency: 'USD',
    low_balance_threshold_usd: 50,
    created_at: '2026-06-11T08:00:00Z',
  },
  project: { id: 1 as InternalId, org_id: 1 as InternalId, name: 'llm-training', slug: 'llm-training' },
  role: 'owner',
  setUser: (u) => set({ user: u, role: u.role }),
  setOrg: (o) => set({ org: o }),
  setProject: (p) => set({ project: p }),
  setRole: (r) => set({ role: r, user: { ...useAuthStore.getState().user, role: r } }),
}));

// ─────────── region store（ARCH §5：驱动列表过滤与 Query key） ───────────
interface RegionState {
  region: RegionCode;
  setRegion: (r: RegionCode) => void;
}
export const useRegionStore = create<RegionState>((set) => ({
  region: VITE_DEFAULT_REGION,
  setRegion: (region) => set({ region }),
}));

// ─────────── theme store（ARCH §10：写入 data-theme） ───────────
type Theme = 'light' | 'dark';
interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}
const apply = (t: Theme): void => {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = t;
};
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  setTheme: (theme) => {
    apply(theme);
    set({ theme });
  },
  toggle: () => {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light';
    apply(next);
    set({ theme: next });
  },
}));
