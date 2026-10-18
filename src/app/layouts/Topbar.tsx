// Topbar 顶部全局条（PRD §3.1 / DESIGN-SYSTEM §5.16；高度 56px，左→右三区）
// v0.6：移除全局常驻区域选择器（改为按页上下文，§3.3）；品牌区冻结常驻。
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus, Bell, HelpCircle, Sun, Moon, ChevronDown, Search, Menu,
} from 'lucide-react';
import s from './layout.module.css';
import { EP, api } from '../../lib/api-client';
import { useAuthStore, useThemeStore } from '../../stores/auth';
import { KIND_META, KIND_LIST, KIND_ICON } from '../../lib/ids';
import type { Project } from '../../types/domain';
import { ROLE_LABEL, ROLE_LIST } from '../../lib/rbac';
import { formatUsd } from '../../lib/money';

interface MeData {
  user: { display_name: string; email: string; role: string };
  org: { name: string; credit_balance: number };
  plan: { name: string } | null;
  projects: Project[];
}

/** 面包屑：资源 / GPU 云服务器 / srv-a1b2c3（统一 display_id，PRD §5.5） */
function useBreadcrumb(): string {
  const { pathname } = useLocation();
  const seg = pathname.split('/').filter(Boolean);
  return seg.length ? seg.join(' / ') : '总览';
}

export function Topbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const theme = useThemeStore((st) => st.theme);
  const toggleTheme = useThemeStore((st) => st.toggle);
  const role = useAuthStore((st) => st.role);
  const setRole = useAuthStore((st) => st.setRole);
  const project = useAuthStore((st) => st.project);
  const setProject = useAuthStore((st) => st.setProject);
  const [openMenu, setOpenMenu] = useState(false);
  const [openNew, setOpenNew] = useState(false);
  const crumbs = useBreadcrumb();

  const { data: me } = useQuery<MeData>({
    queryKey: ['me'],
    queryFn: () => api.get<MeData>(EP.me),
    staleTime: Infinity,
  });

  const org = me?.org;
  const plan = me?.plan;
  const unread = 3;

  return (
    <header className={s.topbar}>
      <div className={s.topbarLeft}>
        {onToggleSidebar && (
          <button className={s.iconBtn} onClick={onToggleSidebar} aria-label="打开导航">
            <Menu size={18} />
          </button>
        )}
        {/* 品牌区：冻结常驻（PRD §3.1） */}
        <Link to="/overview" className={s.topBrand} title="RunSun GPU Cloud">
          <span className={s.brandMark} aria-hidden>
            ☀
          </span>
          <span className={s.topBrandName}>RunSun</span>
        </Link>
        <div className={s.searchBox} role="button" tabIndex={0} title="全局搜索（⌘K）">
          <Search size={14} />
          <span>搜索资源 / 模型 / 文档</span>
          <span className={s.kbd}>⌘K</span>
        </div>
        <span className={s.crumbs}>{crumbs}</span>
      </div>

      <div className={s.topbarRight}>
        {/* + 新建资源（下拉 4 类，图标与资源类型唯一来源一致） */}
        <div style={{ position: 'relative' }}>
          <button className={s.iconBtn} onClick={() => setOpenNew((v) => !v)}>
            <Plus size={16} /> 新建
          </button>
          {openNew && (
            <div className={s.menu}>
              {KIND_LIST.map((k) => {
                const Icon = KIND_ICON[k];
                return (
                  <Link
                    key={k}
                    to={`/deployment/${KIND_META[k].routeKey === 'servers' ? 'server' : KIND_META[k].routeKey}`}
                    className={s.menuItem}
                    onClick={() => setOpenNew(false)}
                    style={{ textDecoration: 'none' }}
                  >
                    <span className={s.row}>
                      <Icon size={14} />
                      新建 {KIND_META[k].label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <button className={s.iconBtn} aria-label="通知中心">
          <Bell size={16} />
          {unread > 0 && <span className={s.badgeCount}>{unread}</span>}
        </button>
        <button className={s.iconBtn} aria-label="帮助">
          <HelpCircle size={16} />
        </button>
        <button className={s.iconBtn} onClick={toggleTheme} aria-label="切换主题">
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* 账号菜单：用户 / 组织 / 套餐 / 角色 / 项目（项目仅快速切换，新建在部署流程内 §3.5） */}
        <div style={{ position: 'relative' }}>
          <button className={s.accountBtn} onClick={() => setOpenMenu((v) => !v)}>
            <span className={s.avatar}>E</span>
            <span>{me?.user.display_name ?? 'Enzo Owner'}</span>
            <ChevronDown size={14} />
          </button>
          {openMenu && (
            <div className={s.menu}>
              <div className={s.menuLabel}>账号</div>
              <div className={s.menuItem}>
                <span>用户</span>
                <span>{me?.user.display_name ?? '—'}</span>
              </div>
              <div className={s.menuItem}>
                <span>组织</span>
                <span>{org?.name ?? '—'}</span>
              </div>
              <div className={s.menuItem}>
                <span>套餐</span>
                <span>{plan?.name ?? '—'}</span>
              </div>
              <div className={s.menuItem}>
                <span>余额</span>
                <span>{org ? formatUsd(org.credit_balance) : '—'}</span>
              </div>
              <div className={s.menuLabel}>角色（演示切换）</div>
              <div className={s.menuItem} style={{ flexWrap: 'wrap', gap: 4 }}>
                {ROLE_LIST.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={s.iconBtn}
                    style={{
                      fontSize: 11,
                      height: 24,
                      background: r === role ? 'var(--rs-brand-soft)' : undefined,
                      color: r === role ? 'var(--rs-brand-strong)' : undefined,
                    }}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
              <div className={s.menuLabel}>项目（快速切换 · 新建在部署向导内）</div>
              {(me?.projects ?? []).map((p) => (
                <button
                  key={p.id}
                  className={s.menuItem}
                  onClick={() => setProject(p)}
                  style={{
                    width: '100%',
                    background: p.id === project.id ? 'var(--rs-brand-soft)' : undefined,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span>
                    {p.name}
                    {p.is_default && <span className={s.muted}> · 默认</span>}
                  </span>
                  {p.id === project.id && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
