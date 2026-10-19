// Notebook / IDE 种子（v0.7 · PRD §4.5.1 · ARCH §12.5）
// v0.7：挂靠范围由「仅 GPU 云服务器」扩展为 **GPU 云服务器 / GPU 裸金属 / vGPU** 三类
// （推理服务无 SSH 面，不挂开发环境，仅在工作台提供 Playground 链接）。
import type { InternalId, NotebookItem, ResourceKind } from '../../types/domain';
import { RESOURCES } from './resources';
import { ORG } from './users-orgs';

const HOUR = 3600_000;
const bootAt = Date.now();
const iso = (msAgo: number): string => new Date(bootAt - msAgo).toISOString();

function byName(name: string) {
  const r = RESOURCES.find((x) => x.name === name && !x.deleted_at);
  if (!r) throw new Error(`notebooks fixture: 宿主资源不存在 ${name}`);
  return r;
}

interface Seed {
  name: string;
  /** 宿主资源名 */
  host: string;
  ide: NotebookItem['ide'];
  status: NotebookItem['status'];
  ageHours: number;
  autoShutdown: number;
  storageMountGb: number;
}

const SEEDS: Seed[] = [
  { name: 'jp-pretrain-eda', host: 'notebook-dev-01', ide: 'jupyter', status: 'running', ageHours: 30, autoShutdown: 60, storageMountGb: 200 },
  { name: 'jp-vscode-tune', host: 'llm-pretrain-01', ide: 'vscode', status: 'running', ageHours: 12, autoShutdown: 120, storageMountGb: 500 },
  { name: 'bm-h100-debug', host: 'bm-h100-jp07', ide: 'jupyter', status: 'running', ageHours: 8, autoShutdown: 0, storageMountGb: 1000 },
  { name: 'cks-jp-pipeline', host: 'cks-inference-jp', ide: 'vscode', status: 'stopped', ageHours: 96, autoShutdown: 30, storageMountGb: 300 },
  { name: 'th-finetune-lab', host: 'th-finetune-01', ide: 'jupyter', status: 'running', ageHours: 20, autoShutdown: 60, storageMountGb: 400 },
  { name: 'us-b200-profiling', host: 'bm-b200-rack01', ide: 'jupyter', status: 'error', ageHours: 5, autoShutdown: 30, storageMountGb: 800 },
];

const IMAGE = {
  jupyter: 'pytorch-2.5-cuda12.4-jupyter',
  vscode: 'ubuntu-22.04-cuda12.4-vscode',
} as const;

export const NOTEBOOKS: NotebookItem[] = SEEDS.map((seed, i) => {
  const host = byName(seed.host);
  return {
    id: (i + 1) as InternalId,
    org_id: ORG.id,
    name: seed.name,
    resource_id: host.id,
    resource_kind: host.kind,
    ide: seed.ide,
    type: seed.ide,
    status: seed.status,
    region: host.region,
    url_path: `/notebook/${i + 1}/${seed.ide === 'jupyter' ? 'lab' : 'vscode'}`,
    gpu_count: host.gpu_count,
    storage_mount_gb: seed.storageMountGb,
    auto_shutdown_idle_min: seed.autoShutdown,
    image_ref: IMAGE[seed.ide],
    created_at: iso(seed.ageHours * HOUR),
  };
});

let createdSeq = 0;

/** 可挂靠宿主资源（PRD §4.5.1：三类；推理不挂） */
export const ATTACHABLE_KINDS: ResourceKind[] = ['gpu_vm', 'gpu_baremetal', 'vgpu'];

export function attachableResources(region?: string | null) {
  return RESOURCES.filter(
    (r) => !r.deleted_at && ATTACHABLE_KINDS.includes(r.kind) && r.status !== 'terminating',
  ).filter((r) => !region || region === 'all' || r.region === region);
}

export interface NotebookCreateInput {
  name: string;
  resource_id: number;
  ide: NotebookItem['ide'];
  storage_mount_gb?: number;
  auto_shutdown_idle_min?: number;
}

export type NotebookCreateResult =
  | { ok: true; notebook: NotebookItem }
  | { ok: false; code: string; message: string };

/** 创建 Notebook（挂靠三类宿主；宿主不存在/形态不支持均拒绝） */
export function createNotebook(input: NotebookCreateInput): NotebookCreateResult {
  const host = RESOURCES.find((r) => r.id === input.resource_id && !r.deleted_at);
  if (!host) return { ok: false, code: 'RESOURCE_NOT_FOUND', message: '宿主资源不存在' };
  if (!ATTACHABLE_KINDS.includes(host.kind)) {
    return { ok: false, code: 'RESOURCE_KIND_NOT_ATTACHABLE', message: '该资源形态不支持挂靠 Notebook / IDE' };
  }
  const name = input.name.trim();
  if (!name) return { ok: false, code: 'INVALID_NAME', message: '名称不能为空' };
  createdSeq += 1;
  const nb: NotebookItem = {
    id: (100 + createdSeq) as InternalId,
    org_id: ORG.id,
    name,
    resource_id: host.id,
    resource_kind: host.kind,
    ide: input.ide,
    type: input.ide,
    status: 'provisioning',
    region: host.region,
    url_path: `/notebook/${100 + createdSeq}/${input.ide === 'jupyter' ? 'lab' : 'vscode'}`,
    gpu_count: host.gpu_count,
    storage_mount_gb: input.storage_mount_gb ?? 200,
    auto_shutdown_idle_min: input.auto_shutdown_idle_min ?? 60,
    image_ref: IMAGE[input.ide],
    created_at: new Date().toISOString(),
  };
  NOTEBOOKS.unshift(nb);
  return { ok: true, notebook: nb };
}

/** 删除 Notebook：只删开发环境，不删宿主资源（PRD §4.5.1 运行态归属） */
export function deleteNotebook(id: number): boolean {
  const idx = NOTEBOOKS.findIndex((n) => n.id === id);
  if (idx < 0) return false;
  NOTEBOOKS.splice(idx, 1);
  return true;
}

export function notebookById(id: number): NotebookItem | undefined {
  return NOTEBOOKS.find((n) => n.id === id);
}
