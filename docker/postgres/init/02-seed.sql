-- ============================================================================
-- RunSun GPU Cloud 控制台 — 种子数据（静态参考/演示底座）
-- 对应 ARCH §12.1 plans / §12.6 node_pool_code / 示例 identity。
-- 时序指标不落 PG（见 ARCH §12.8），此处仅注入业务实体与计费聚合量底座。
-- ============================================================================

-- ---- 套餐（3 档）----
INSERT INTO plans (code, name, free_credit_usd, max_members, support_level) VALUES
  ('free',       'Free',        0.00,   5,  'community'),
  ('standard',   'Standard',    20.00,  20, 'email'),
  ('enterprise', 'Enterprise',  200.00, 100, 'dedicated')
ON CONFLICT (code) DO NOTHING;

-- ---- 节点池（5 类，对应 ARCH §12.6 node_pool_code）----
INSERT INTO node_pools (code, display_name, gpu_model, gpus_per_node, vram_gb, interconnect) VALUES
  ('H100_SXM',    'H100 SXM',    'H100',   8, 80,  'NVLink'),
  ('H200_NVL',    'H200 NVL',    'H200',   8, 141, 'NVLink'),
  ('B200_NVL72',  'B200 NVL72',  'B200',   72, 192, 'NVL72'),
  ('B300',        'B300',        'B300',   8, 192, 'NVLink'),
  ('GB300_NVL72', 'GB300 NVL72', 'GB300',  72, 288, 'NVL72')
ON CONFLICT (code) DO NOTHING;

-- ---- 示例组织 / 用户 / 项目（演示底座）----
INSERT INTO orgs (name, slug, plan_code, credit_balance, low_balance_threshold_usd, status) VALUES
  ('RunSun Demo Org', 'runsun-demo', 'standard', 1200.00, 50.00, 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (org_id, email, display_name, status, role, identity_provider, mfa_enabled) VALUES
  ((SELECT id FROM orgs WHERE slug = 'runsun-demo'), 'owner@runsun.demo', 'Demo Owner', 'active', 'owner', 'local', true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO projects (org_id, name, slug) VALUES
  ((SELECT id FROM orgs WHERE slug = 'runsun-demo'), 'Default Project', 'default')
ON CONFLICT (org_id, slug) DO NOTHING;

-- ---- 配额（PRD §7.3：作用域 (org_id, resource_kind?, region?)；used_value 为派生值默认 0）----
-- 与 Mock fixtures/users-orgs.ts 的 QUOTAS 严格同源：4 区域 × 4 指标 = 16 行，
-- limit 按种子资源在该区域的占用量预留 10%–40% 水位（th 的 GPU 为 94% 紧张水位，演示告警路径）。
INSERT INTO quotas (org_id, resource_kind, region, metric, limit_value)
SELECT o.id, NULL, q.region::region_code, q.metric::quota_metric, q.limit_value
FROM orgs o
CROSS JOIN (VALUES
  ('jp', 'gpu',         48),    ('jp', 'vcpu',        640),   ('jp', 'storage_gb',  12288), ('jp', 'public_ip',   6),
  ('th', 'gpu',         16),    ('th', 'vcpu',        256),   ('th', 'storage_gb',  4096),  ('th', 'public_ip',   8),
  ('sg', 'gpu',         32),    ('sg', 'vcpu',        320),   ('sg', 'storage_gb',  16384), ('sg', 'public_ip',   8),
  ('us', 'gpu',         96),    ('us', 'vcpu',        1280),  ('us', 'storage_gb',  40960), ('us', 'public_ip',   16)
) AS q(region, metric, limit_value)
WHERE o.slug = 'runsun-demo'
ON CONFLICT (org_id, resource_kind, region, metric) DO NOTHING;
