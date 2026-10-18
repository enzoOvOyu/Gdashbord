// 公共第 1 步：项目与区域（PRD §4.2.0 / §3.5：项目必选 + 可内联新建）
import { useState } from 'react';
import { Plus, FolderPlus } from 'lucide-react';
import {
  ui as s,
  Field,
  Input,
  Select,
  Button,
  Badge,
  toast,
} from '../../../components/ui';
import { REGION_LIST, REGION_META } from '../../../lib/ids';
import type { RegionCode } from '../../../types/domain';
import { useCreateProject } from '../../shared/api';

export interface ProjectRegionValue {
  project_id: number;
  region: RegionCode;
  name: string;
}

interface ProjectLite {
  id: number;
  name: string;
  is_default: boolean;
  default_region: RegionCode;
}

export function ProjectRegionStep({
  value,
  onChange,
  projects,
  errors,
  nameHint,
}: {
  value: ProjectRegionValue;
  onChange: (patch: Partial<ProjectRegionValue>) => void;
  projects: ProjectLite[];
  errors: Record<string, string>;
  nameHint?: string;
}) {
  const [newName, setNewName] = useState('');
  const create = useCreateProject();

  const doCreate = async (): Promise<void> => {
    const nm = newName.trim();
    if (nm.length < 2) {
      toast.error('项目名称至少 2 个字符');
      return;
    }
    try {
      const created = (await create.mutateAsync({
        name: nm,
        default_region: value.region,
      })) as ProjectLite;
      onChange({ project_id: created.id });
      setNewName('');
      toast.success(`已创建项目 ${created.name} 并选中`);
    } catch {
      toast.error('创建项目失败（可能重名）');
    }
  };

  return (
    <div className={s.col} style={{ gap: 16 }}>
      <div className={s.formGrid}>
        <Field label="项目" required error={errors.project_id}>
          <Select
            value={String(value.project_id)}
            onChange={(e) => onChange({ project_id: Number(e.target.value) })}
          >
            <option value={0}>请选择项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.is_default ? '（默认）' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="区域" required error={errors.region}>
          <Select
            value={value.region}
            onChange={(e) => onChange({ region: e.target.value as RegionCode })}
          >
            {REGION_LIST.map((r) => (
              <option key={r} value={r}>
                {REGION_META[r].label} {REGION_META[r].iso}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="资源名称" required error={errors.name} hint={nameHint}>
          <Input
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="如 llm-pretrain-01"
          />
        </Field>
      </div>

      {/* 内联新建项目（§3.5 主入口） */}
      <div
        style={{
          border: '1px dashed var(--rs-border)',
          borderRadius: 8,
          padding: 12,
        }}
      >
        <div className={s.metricLabel} style={{ marginBottom: 8 }}>
          <FolderPlus size={14} />
          没有合适的项目？直接新建
        </div>
        <div className={s.row}>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新项目名称"
            style={{ minWidth: 200 }}
          />
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus size={14} />}
            disabled={create.isPending}
            onClick={() => void doCreate()}
          >
            {create.isPending ? '创建中…' : '新建并选中'}
          </Button>
        </div>
        <div className={s.muted} style={{ fontSize: 11, marginTop: 6 }}>
          新项目默认区域取当前所选区域；创建后自动选中，成本将按该项目归集。
        </div>
      </div>

      <div className={s.row}>
        <Badge tone="info">项目必选</Badge>
        <span className={s.muted} style={{ fontSize: 12 }}>
          成本归集链路：orders.project_id → resources.project_id → billing_usage.project_id
        </span>
      </div>
    </div>
  );
}
