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
