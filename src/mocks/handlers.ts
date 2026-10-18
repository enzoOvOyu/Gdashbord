// MSW 拦截示例：仅 /api/*（ARCH §6）。完整契约随特性实现逐步补全。
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/health', () =>
    HttpResponse.json({ status: 'ok', mock: true, ts: Date.now() }),
  ),
];
