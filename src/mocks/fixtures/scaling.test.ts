// 弹性伸缩种子契约测试（MOCK-DATA §6.9 / §9.4）
// 覆盖：策略模型与形态一致、min≤max、裸金属 warm floor、方向与数值自洽、
//       触发快照越过/低于目标值、末值=资源实际规格、耗时按形态、含人工干预与库存回退。
import { describe, expect, it } from 'vitest';
import {
  SCALING_EVENTS, SCALING_POLICIES, actualSizeOf, createPolicy, deletePolicy,
  eventsOfPolicy, hasActivePolicy, policyRows, strategyModelOf,
} from './scaling';
import { RESOURCES } from './resources';
import type { ScalingPolicy } from '../../types/domain';

const NOW = Date.now();
const byId = (id: number) => RESOURCES.find((r) => r.id === id)!;

describe('策略集合', () => {
  it('共 11 条策略，覆盖两类模型（node_pool 8 / replica 3）', () => {
    expect(SCALING_POLICIES).toHaveLength(11);
    const models = SCALING_POLICIES.map((p) => p.strategy_model);
    expect(models.filter((m) => m === 'node_pool')).toHaveLength(8);
    expect(models.filter((m) => m === 'replica')).toHaveLength(3);
  });

  it('id / policy_uuid 唯一', () => {
    expect(new Set(SCALING_POLICIES.map((p) => p.id)).size).toBe(11);
    expect(new Set(SCALING_POLICIES.map((p) => p.policy_uuid)).size).toBe(11);
  });

  it('策略模型由资源形态唯一决定（推理=replica，其余=node_pool）', () => {
    for (const p of SCALING_POLICIES) {
      expect(p.strategy_model).toBe(strategyModelOf(byId(p.resource_id).kind));
    }
  });

  it('含 1 条 paused 与 1 条 cooldown；状态合法', () => {
    const statuses = SCALING_POLICIES.map((p) => p.status);
    expect(statuses.filter((s) => s === 'paused')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'cooldown')).toHaveLength(1);
    for (const s of statuses) expect(['active', 'paused', 'cooldown']).toContain(s);
  });

  it('min ≤ max；裸金属 min ≥ 1（warm floor 铁律）；scale_to_zero 仅 replica', () => {
    for (const p of SCALING_POLICIES) {
      expect(p.min_size).toBeLessThanOrEqual(p.max_size);
      if (byId(p.resource_id).kind === 'gpu_baremetal') {
        expect(p.min_size).toBeGreaterThanOrEqual(1);
        // 裸金属 cooldown 10–30min（600–1800s）
        expect(p.cooldown_s).toBeGreaterThanOrEqual(600);
        expect(p.cooldown_s).toBeLessThanOrEqual(1800);
      }
      if (p.strategy_model !== 'replica') expect(p.scale_to_zero).toBe(false);
    }
  });
});

describe('伸缩事件（§9.4 契约）', () => {
  it('每条策略 6–15 条事件，全部早于当前时刻', () => {
    for (const p of SCALING_POLICIES) {
      const evs = eventsOfPolicy(p.id);
      expect(evs.length).toBeGreaterThanOrEqual(6);
      expect(evs.length).toBeLessThanOrEqual(15);
      for (const e of evs) {
        expect(new Date(e.created_at).getTime()).toBeLessThan(NOW);
      }
    }
  });

  it('方向与数值自洽：scale_out ⇒ to > from；scale_in ⇒ to < from；且落在 [min,max]', () => {
    for (const p of SCALING_POLICIES) {
      for (const e of eventsOfPolicy(p.id)) {
        expect(e.from_size).toBeGreaterThanOrEqual(p.min_size);
        expect(e.to_size).toBeGreaterThanOrEqual(p.min_size);
        expect(e.from_size).toBeLessThanOrEqual(p.max_size);
        expect(e.to_size).toBeLessThanOrEqual(p.max_size);
        if (e.direction === 'scale_out') expect(e.to_size).toBeGreaterThan(e.from_size);
        else expect(e.to_size).toBeLessThan(e.from_size);
      }
    }
  });

  it('触发快照与策略一致，且数值越过/低于目标值（方向可解释）', () => {
    for (const p of SCALING_POLICIES) {
      for (const e of eventsOfPolicy(p.id)) {
        expect(e.trigger_snapshot.metric).toBe(p.trigger_metric);
        expect(e.trigger_snapshot.target).toBe(p.target_value);
        if (e.direction === 'scale_out') {
          expect(e.trigger_snapshot.value).toBeGreaterThan(e.trigger_snapshot.target);
        } else {
          expect(e.trigger_snapshot.value).toBeLessThan(e.trigger_snapshot.target);
        }
        expect(e.trigger_snapshot.windowS).toBeGreaterThan(0);
      }
    }
  });

  it('末值 = 资源实际规格（paused 策略末值 = min）', () => {
    for (const p of SCALING_POLICIES) {
      const evs = eventsOfPolicy(p.id); // 按 created_at 倒序
      const latest = evs[0];
      const expected = p.status === 'paused' ? p.min_size : actualSizeOf(byId(p.resource_id));
      expect(latest.to_size).toBe(expected);
    }
  });

  it('耗时按形态：裸金属 300–1800s；vGPU 30–120s；推理 warm 命中 ≤10s', () => {
    for (const e of SCALING_EVENTS) {
      const r = byId(e.resource_id);
      expect(e.duration_s).not.toBeNull();
      if (r.kind === 'gpu_baremetal') {
        expect(e.duration_s!).toBeGreaterThanOrEqual(300);
        expect(e.duration_s!).toBeLessThanOrEqual(1800);
      }
      if (r.kind === 'vgpu') {
        expect(e.duration_s!).toBeGreaterThanOrEqual(30);
        expect(e.duration_s!).toBeLessThanOrEqual(120);
      }
      if (r.kind === 'inference') {
        if (e.warm_pool_hit) expect(e.duration_s!).toBeLessThanOrEqual(10);
        else expect(e.duration_s!).toBeGreaterThanOrEqual(30);
      } else {
        expect(e.warm_pool_hit).toBeNull(); // 仅推理有 warm pool 口径
      }
    }
  });

  it('含人工干预事件与库存不足回退事件（§9.4 异常事件禁止全部成功）', () => {
    const manual = SCALING_EVENTS.filter((e) => e.reason?.includes('人工'));
    const fallback = SCALING_EVENTS.filter((e) => e.reason?.includes('库存不足'));
    expect(manual.length).toBeGreaterThan(0);
    expect(fallback.length).toBeGreaterThan(0);
    // 回退事件必须是扩容方向
    for (const e of fallback) expect(e.direction).toBe('scale_out');
  });

  it('SCALING_EVENTS 按时间倒序且 id 唯一', () => {
    for (let i = 1; i < SCALING_EVENTS.length; i++) {
      expect(SCALING_EVENTS[i - 1].created_at >= SCALING_EVENTS[i].created_at).toBe(true);
    }
    expect(new Set(SCALING_EVENTS.map((e) => e.id)).size).toBe(SCALING_EVENTS.length);
  });
});

describe('policyRows 展示行', () => {
  it('current_size 与资源实际规格一致', () => {
    for (const row of policyRows()) {
      expect(row.current_size).toBe(actualSizeOf(byId(row.resource_id)));
    }
  });

  it('按区域 / 模型过滤生效', () => {
    const jp = policyRows('jp');
    expect(jp.every((r) => r.region === 'jp')).toBe(true);
    const replica = policyRows(null, 'replica');
    expect(replica.every((r) => r.strategy_model === 'replica')).toBe(true);
    expect(replica.length).toBe(3);
  });
});

describe('createPolicy 写入口铁律', () => {
  const unboundVm = RESOURCES.find(
    (r) => !r.deleted_at && r.kind === 'gpu_vm' && r.status !== 'running' && r.status !== 'provisioning' && !hasActivePolicy(r.id),
  );

  it('模型与形态不匹配时拒绝', () => {
    const r = RESOURCES.find((x) => x.kind === 'gpu_vm' && !x.deleted_at)!;
    const res = createPolicy({
      resource_id: r.id, strategy_model: 'replica', trigger_metric: 'qpm',
      min_size: 1, max_size: 4,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('MODEL_KIND_MISMATCH');
  });

  it('裸金属 min < 1 拒绝（warm floor）', () => {
    const bm = RESOURCES.find((x) => x.kind === 'gpu_baremetal' && !x.deleted_at && !hasActivePolicy(x.id));
    if (!bm) return; // 无可用样本时跳过（种子已绑定全部裸金属的场景）
    const res = createPolicy({
      resource_id: bm.id, strategy_model: 'node_pool', trigger_metric: 'queue_depth',
      min_size: 0, max_size: 2,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('WARM_FLOOR_REQUIRED');
  });

  it('node_pool 模型不允许 scale_to_zero', () => {
    if (!unboundVm) return;
    const res = createPolicy({
      resource_id: unboundVm.id, strategy_model: 'node_pool', trigger_metric: 'qpm',
      min_size: 1, max_size: 4, scale_to_zero: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('SCALE_TO_ZERO_NOT_ALLOWED');
  });

  it('合法输入创建成功且不写事件（首次评估未触发）', () => {
    if (!unboundVm) return;
    const before = SCALING_POLICIES.length;
    const res = createPolicy({
      resource_id: unboundVm.id, strategy_model: 'node_pool', trigger_metric: 'qpm',
      min_size: 1, max_size: 4,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(SCALING_POLICIES.length).toBe(before + 1);
    expect(eventsOfPolicy(res.policy.id)).toHaveLength(0);
    expect(hasActivePolicy(unboundVm.id)).toBe(true);
    // 重复绑定拒绝
    const again = createPolicy({
      resource_id: unboundVm.id, strategy_model: 'node_pool', trigger_metric: 'qpm',
      min_size: 1, max_size: 4,
    });
    expect(again.ok).toBe(false);
    // 清理：恢复模块态（资源非 running，可解绑）
    const del = deletePolicy(res.policy.id);
    expect(del.ok).toBe(true);
    expect(SCALING_POLICIES.length).toBe(before);
  });

  it('paused 策略不占「已绑定」判定（hasActivePolicy 排除 paused）', () => {
    const paused = SCALING_POLICIES.find((p: ScalingPolicy) => p.status === 'paused')!;
    expect(hasActivePolicy(paused.resource_id)).toBe(false);
  });
});
