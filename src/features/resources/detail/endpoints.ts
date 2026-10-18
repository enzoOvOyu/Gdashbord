// 接入端点派生（由资源身份确定性派生，禁止随机数；与 MOCK-DATA §5 同源口径）
import type { ResourceDetail } from '../../shared/api';

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

export interface Endpoints {
  privateIp: string;
  publicIp: string | null;
  ssh: string;
  jupyter: string;
  fileManager: string;
  apiBase: string;
}

/**
 * 私网 IP 由资源 uuid 确定性派生（10.42.<a>.<b>），同一资源刷新后不变。
 * 公网 IP 仅在 spec 显式开启时给出，否则为 null（不编造）。
 */
export function endpointsOf(d: ResourceDetail): Endpoints {
  const h = hash(d.resource_uuid as string);
  const a = (h % 250) + 2;
  const b = ((h >> 8) % 250) + 2;
  const privateIp = `10.42.${a}.${b}`;
  const hasPublic = (d.spec_json as { public_ip?: boolean }).public_ip === true;
  const publicIp = hasPublic ? `203.0.113.${(h % 250) + 2}` : null;
  const host = publicIp ?? privateIp;
  return {
    privateIp,
    publicIp,
    ssh: `ssh -p 22 ubuntu@${host}`,
    jupyter: `https://${host}:8888/lab?token=${(d.resource_uuid as string).slice(0, 12)}`,
    fileManager: `https://${host}:8888/files`,
    apiBase: `http://${host}:8000/v1`,
  };
}

/** 复制到剪贴板（真实能力，失败时返回 false） */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
