// 公共第 1 步：项目与区域（PRD §4.2.0 / §3.5：项目必选 + 可内联新建）
import { t } from '../../../i18n';
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
      toast.error(t('val.projNameMin2'));
      return;
    }
    try {
      const created = (await create.mutateAsync({
        name: nm,
        default_region: value.region,
      })) as ProjectLite;
      onChange({ project_id: created.id });
      setNewName('');
      toast.success(t('deploy.projCreated', { v0: created.name }));
    } catch {
      toast.error(t('deploy.projCreateFailed'));
    }
  };

  return (
    <div className={s.col} style={{ gap: 16 }}>
      <div className={s.formGrid}>
        <Field label={t('common.project')} required error={errors.project_id}>
          <Select
            value={String(value.project_id)}
            onChange={(e) => onChange({ project_id: Number(e.target.value) })}
          >
            <option value={0}>{t('common.pickProject')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.is_default ? t('common.defaultMark') : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.region')} required error={errors.region}>
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
        <Field label={t('common.resourceName')} required error={errors.name} hint={nameHint}>
          <Input
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={t('deploy.nameExample')}
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
          {t('deploy.projInlineNew')}
        </div>
        <div className={s.row}>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('deploy.newProjName')}
            style={{ minWidth: 200 }}
          />
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus size={14} />}
            disabled={create.isPending}
            onClick={() => void doCreate()}
          >
            {create.isPending ? t('common.creating') : t('common.createAndSelect')}
          </Button>
        </div>
        <div className={s.muted} style={{ fontSize: 11, marginTop: 6 }}>
          {t('deploy.projNewHint')}
        </div>
      </div>

      <div className={s.row}>
        <Badge tone="info">{t('deploy.projRequired')}</Badge>
        <span className={s.muted} style={{ fontSize: 12 }}>
          {t('deploy.costChain')}
        </span>
      </div>
    </div>
  );
}
