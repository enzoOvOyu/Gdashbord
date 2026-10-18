// 应用初始化：受 VITE_ENABLE_MOCK 控制的 MSW 启动（ARCH §3 app/providers / §12.7）
import { worker } from '../mocks/browser';

export async function initProviders(): Promise<void> {
  const enableMock = import.meta.env.VITE_ENABLE_MOCK === 'true';
  if (enableMock) {
    // 未拦截的请求放行，避免阻塞真实资源（如 /assets）
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  }
}
