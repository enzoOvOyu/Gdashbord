// 应用初始化：MSW 启动（受 VITE_ENABLE_MOCK 控制）+ QueryClient（ARCH §3 / §12.7）
// 注：mocks/browser 及其整棵 fixtures 依赖树**动态导入**——
// 仅在 VITE_ENABLE_MOCK=true 时才进入产物，生产构建（Mock 关闭）不打包 Mock 层。
import { QueryClient } from '@tanstack/react-query';
import { VITE_ENABLE_MOCK } from '../mocks/lib/env';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
});

export async function initProviders(): Promise<void> {
  if (VITE_ENABLE_MOCK) {
    const { worker } = await import('../mocks/browser');
    // 未拦截的请求放行，避免阻塞真实资源（如 /assets）
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  }
}
