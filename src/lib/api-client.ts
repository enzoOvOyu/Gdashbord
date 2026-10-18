// 统一 API 客户端：Mock 关闭时（VITE_ENABLE_MOCK=false）指向真实后端网关（ARCH §12.7）
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export const apiClient = { BASE_URL, get: apiGet };
