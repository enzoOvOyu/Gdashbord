// 全局命令面板（⌘K / Ctrl+K；README「已知待办」v0.8 已实现）
// 依赖 cmdk 1.1.1 —— 该版本不自带样式，仅输出结构类名（cmdk-root / cmdk-item …），
// 故视觉全部由 palette.css 以全局 CSS 实现（消费设计 Token，亮/暗自适应）。
// 四组内容：资源搜索（服务端 q 过滤）/ 页面导航（与 Sidebar 同源 + RBAC 过滤）/
// 新建资源（四类向导）/ 快捷操作（语言、主题）。
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Command } from 'cmdk';
import { Search, CornerDownLeft, ArrowUpDown, Languages, Moon, Sun, Rocket } from 'lucide-react';
import { t } from '../../i18n';
import { EP, api } from '../../lib/api-client';
import { KIND_META, KIND_LIST } from '../../lib/ids';
import { useAuthStore, useThemeStore } from '../../stores/auth';
import { useLocaleStore } from '../../stores/locale';
import { visibleNav } from '../../app/layouts/navModel';
import type { ResourceKind } from '../../types/domain';
import './palette.css';

interface ResourceHit {
  resource_uuid: string;
  display_id: string;
  name: string;
  kind: ResourceKind;
  project_name?: string;
}

/** 部署向导路由别名（与 Topbar「+ 新建」一致：servers → server） */
function deployRoute(kind: ResourceKind): string {
  const rk = KIND_META[kind].routeKey;
  return `/deployment/${rk === 'servers' ? 'server' : rk}`;
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const role = useAuthStore((st) => st.role);
  const theme = useThemeStore((st) => st.theme);
  const toggleTheme = useThemeStore((st) => st.toggle);
  const locale = useLocaleStore((st) => st.locale);
  const toggleLocale = useLocaleStore((st) => st.toggleLocale);
  const [search, setSearch] = useState('');

  // 全局快捷键：⌘K / Ctrl+K（焦点在输入框时由浏览器/系统处理，不重复拦截）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  // 关闭时清空搜索，下次打开是干净状态
  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const q = search.trim();
  const { data: hits = [], isFetching } = useQuery<ResourceHit[]>({
    queryKey: ['cmd', 'resource-search', q],
    queryFn: () =>
      api.get<ResourceHit[]>(`${EP.resources}?q=${encodeURIComponent(q)}&size=8`),
    enabled: open && q.length > 0,
    staleTime: 5_000,
  });

  const { direct, groups } = visibleNav(role);
  const go = (to: string) => {
    navigate(to);
    onOpenChange(false);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={t('cp.title')}
      overlayClassName="rs-cmdk-overlay"
      contentClassName="rs-cmdk-dialog"
    >
      <div className="rs-cmdk-inputwrap">
        <Search size={16} aria-hidden />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder={t('cp.placeholder')}
          autoFocus
        />
        {isFetching && <span className="rs-cmdk-spinner" aria-hidden />}
      </div>

      <Command.List>
        <Command.Empty>{t('cp.noResults')}</Command.Empty>

        {/* 资源搜索：命中服务端后展示，最多 8 条 */}
        {hits.length > 0 && (
          <Command.Group heading={t('cp.groupResources')}>
            {hits.map((r) => (
              <Command.Item
                key={r.resource_uuid}
                value={`res ${r.display_id} ${r.name} ${r.kind}`}
                keywords={[r.resource_uuid, r.display_id, r.name]}
                onSelect={() => {
                  navigate(
                    `/resources/${KIND_META[r.kind].routeKey}/${r.resource_uuid}`,
                  );
                  onOpenChange(false);
                }}
              >
                <span className="rs-cmdk-itemIcon">
                  <Search size={14} />
                </span>
                <span className="rs-cmdk-itemText">
                  <span className="rs-cmdk-itemTitle">{r.display_id}</span>
                  <span className="rs-cmdk-itemDesc">{r.name}</span>
                </span>
                <span className="rs-cmdk-itemMeta">
                  {KIND_META[r.kind].label}
                  {r.project_name ? ` · ${r.project_name}` : ''}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* 页面导航：与 Sidebar 同源（navModel + RBAC） */}
        <Command.Group heading={t('cp.groupNav')}>
          {direct.map((it) => (
            <Command.Item
              key={it.to}
              value={`nav ${it.to} ${it.label}`}
              keywords={[it.to, it.label]}
              onSelect={() => go(it.to)}
            >
              <span className="rs-cmdk-itemIcon">
                <it.icon size={14} />
              </span>
              <span className="rs-cmdk-itemText">
                <span className="rs-cmdk-itemTitle">{it.label}</span>
              </span>
              <span className="rs-cmdk-itemMeta">{it.to}</span>
            </Command.Item>
          ))}
          {groups.flatMap(({ group, items }) =>
            items.map((it) => (
              <Command.Item
                key={it.to}
                value={`nav ${it.to} ${it.label} ${group.title}`}
                keywords={[it.to, it.label, group.title]}
                onSelect={() => go(it.to)}
              >
                <span className="rs-cmdk-itemIcon">
                  <it.icon size={14} />
                </span>
                <span className="rs-cmdk-itemText">
                  <span className="rs-cmdk-itemTitle">{it.label}</span>
                </span>
                <span className="rs-cmdk-itemMeta">{group.title}</span>
              </Command.Item>
            )),
          )}
        </Command.Group>

        {/* 新建资源：四类向导 */}
        <Command.Group heading={t('cp.groupCreate')}>
          {KIND_LIST.map((k) => (
            <Command.Item
              key={k}
              value={`create ${deployRoute(k)} ${KIND_META[k].label}`}
              keywords={[KIND_META[k].label, '新建', 'create']}
              onSelect={() => go(deployRoute(k))}
            >
              <span className="rs-cmdk-itemIcon">
                <Rocket size={14} />
              </span>
              <span className="rs-cmdk-itemText">
                <span className="rs-cmdk-itemTitle">
                  {t('deploy.createKind', { v0: KIND_META[k].label })}
                </span>
              </span>
            </Command.Item>
          ))}
        </Command.Group>

        {/* 快捷操作 */}
        <Command.Group heading={t('cp.groupActions')}>
          <Command.Item
            value="action language locale 语言"
            keywords={['语言', 'language']}
            onSelect={() => {
              toggleLocale();
              onOpenChange(false);
            }}
          >
            <span className="rs-cmdk-itemIcon">
              <Languages size={14} />
            </span>
            <span className="rs-cmdk-itemText">
              <span className="rs-cmdk-itemTitle">{t('cp.actionLang')}</span>
            </span>
            <span className="rs-cmdk-itemMeta">{locale}</span>
          </Command.Item>
          <Command.Item
            value="action theme dark light 主题"
            keywords={['主题', 'theme']}
            onSelect={() => {
              toggleTheme();
              onOpenChange(false);
            }}
          >
            <span className="rs-cmdk-itemIcon">
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </span>
            <span className="rs-cmdk-itemText">
              <span className="rs-cmdk-itemTitle">{t('cp.actionTheme')}</span>
            </span>
          </Command.Item>
        </Command.Group>
      </Command.List>

      <div className="rs-cmdk-footer">
        <span>
          <ArrowUpDown size={12} aria-hidden /> {t('cp.hintMove')}
        </span>
        <span>
          <CornerDownLeft size={12} aria-hidden /> {t('cp.hintOpen')}
        </span>
        <span>
          <kbd>esc</kbd> {t('cp.hintClose')}
        </span>
      </div>
    </Command.Dialog>
  );
}
