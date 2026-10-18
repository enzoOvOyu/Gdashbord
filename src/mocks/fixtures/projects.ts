// 项目（PRD §3.5：真实功能，可增删改；不再写死 PROJECTS[0]）
// 注意：本模块被 users-orgs.ts 再导出，禁止反向 import users-orgs（避免循环依赖）。
import type { InternalId, Project, RegionCode } from '../../types/domain';

export const DEFAULT_PROJECT_SLUG = 'default';
const ORG_ID = 1 as InternalId;

export const PROJECTS: Project[] = [
  {
    id: 1 as InternalId,
    org_id: ORG_ID,
    name: 'llm-training',
    slug: 'llm-training',
    is_default: false,
    default_region: 'jp',
    created_at: '2026-06-11T08:00:00Z',
  },
  {
    id: 2 as InternalId,
    org_id: ORG_ID,
    name: 'inference-prod',
    slug: 'inference-prod',
    is_default: false,
    default_region: 'us',
    created_at: '2026-07-02T03:20:00Z',
  },
  {
    id: 3 as InternalId,
    org_id: ORG_ID,
    name: 'research-sandbox',
    slug: 'research-sandbox',
    is_default: false,
    default_region: 'sg',
    created_at: '2026-08-19T11:05:00Z',
  },
  {
    id: 4 as InternalId,
    org_id: ORG_ID,
    name: 'default',
    slug: DEFAULT_PROJECT_SLUG,
    is_default: true,
    default_region: 'jp',
    created_at: '2026-06-11T08:00:00Z',
  },
];

let seq = PROJECTS.length;

export const projectById = (id: InternalId): Project | undefined =>
  PROJECTS.find((p) => p.id === id);

export const projectName = (id: InternalId | null): string =>
  id === null ? '未分配' : (projectById(id)?.name ?? '已删除项目');

export const defaultProjectId = (): InternalId =>
  (PROJECTS.find((p) => p.is_default) ?? PROJECTS[0]).id;

const slugify = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'project';

export interface CreateProjectInput {
  name: string;
  default_region?: RegionCode;
}

/** 创建项目：名称在 org 内唯一（ARCH §12.10.2 C7） */
export function createProject(input: CreateProjectInput): Project {
  const takenSlugs = new Set(PROJECTS.map((p) => p.slug));
  let slug = slugify(input.name);
  if (takenSlugs.has(slug)) {
    let n = 2;
    while (takenSlugs.has(`${slug}-${n}`)) n += 1;
    slug = `${slug}-${n}`;
  }
  seq += 1;
  const p: Project = {
    id: seq as InternalId,
    org_id: ORG_ID,
    name: input.name.trim(),
    slug,
    is_default: false,
    default_region: input.default_region ?? 'jp',
    created_at: new Date().toISOString(),
  };
  PROJECTS.push(p);
  return p;
}

export type DeleteProjectResult =
  | { ok: true; project: Project }
  | { ok: false; code: 'PROJECT_IS_DEFAULT'; message: string }
  | { ok: false; code: 'PROJECT_HAS_RESOURCES'; message: string; resources: Array<{ uuid: string; name: string }> }
  | { ok: false; code: 'PROJECT_NOT_FOUND'; message: string };

/**
 * 删除项目（PRD §3.5 删除约束）：
 *  默认项目不可删；仍持有未释放资源的项目不可删（409 PROJECT_HAS_RESOURCES）。
 */
export function deleteProject(
  id: InternalId,
  liveResourcesOf: (pid: InternalId) => Array<{ uuid: string; name: string }>,
): DeleteProjectResult {
  const idx = PROJECTS.findIndex((p) => p.id === id);
  if (idx < 0) {
    return { ok: false, code: 'PROJECT_NOT_FOUND', message: '项目不存在' };
  }
  const p = PROJECTS[idx];
  if (p.is_default) {
    return { ok: false, code: 'PROJECT_IS_DEFAULT', message: '默认项目不可删除' };
  }
  const live = liveResourcesOf(id);
  if (live.length > 0) {
    return {
      ok: false,
      code: 'PROJECT_HAS_RESOURCES',
      message: `项目下仍有 ${live.length} 个未释放资源，请先释放或改归属`,
      resources: live,
    };
  }
  PROJECTS.splice(idx, 1);
  return { ok: true, project: p };
}
