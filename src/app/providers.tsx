// 应用初始化：MSW 启动（受 VITE_ENABLE_MOCK 控制）+ QueryClient（ARCH §3 / §12.7）
import { QueryClient } from '@tanstack/react-query';
import { worker } from '../mocks/browser';
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
    // 未拦截的请求放行，避免阻塞真实资源（如 /assets）
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  }
}
