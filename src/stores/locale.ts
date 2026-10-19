// locale store（ARCH §5/§10：持久化 rs.locale，同步 <html lang> 与 i18n 模块态）
// 注意：locale 不进 Query key（DS §5.24）——ConsoleLayout 订阅本 store 实现整树重渲染
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setLocale, type LocaleCode } from '../i18n';
import { VITE_I18N_DEFAULT_LOCALE } from '../mocks/lib/env';

interface LocaleState {
  locale: LocaleCode;
  setLocale: (l: LocaleCode) => void;
  toggleLocale: () => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      locale: VITE_I18N_DEFAULT_LOCALE,
      setLocale: (locale) => {
        setLocale(locale);
        set({ locale });
      },
      toggleLocale: () => {
        const next: LocaleCode = get().locale === 'zh-CN' ? 'en-US' : 'zh-CN';
        setLocale(next);
        set({ locale: next });
      },
    }),
    { name: 'rs.locale' },
  ),
);

// persist 默认同步 rehydrate；此处兜底同步模块态与 <html lang>
setLocale(useLocaleStore.getState().locale);
