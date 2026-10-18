-- ============================================================================
-- RunSun GPU Cloud 控制台 — PostgreSQL 初始化 DDL（后端蓝图，ARCHITECTURE.md §12）
-- 目标：PostgreSQL 15+ 可建表语句；前端 Mock 实体须与本 DDL 同构。
--
-- 执行顺序（按依赖，见 ARCH §12 顶部说明）：
--   identity(§12.1) → supply(§12.3) → deployment(§12.2) → billing(§12.4) → content(§12.5)
--   （resource_placements.node_id 外键指向 gpu_nodes，故 supply 先于 deployment）
--
-- 本文件仅建 schema；种子数据见 02-seed.sql。
-- 由 docker-compose 挂载到 /docker-entrypoint-initdb.d 自动执行（仅首次初始化）。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. 枚举类型（集中定义，避免表间引用顺序问题）
-- ---------------------------------------------------------------------------
CREATE TYPE user_status     AS ENUM ('active','suspended','pending','deleted');
CREATE TYPE user_role       AS ENUM ('owner','admin','member','billing','viewer');
CREATE TYPE project_role    AS ENUM ('admin','member','viewer');

CREATE TYPE region_code     AS ENUM ('jp','th','sg','us');
CREATE TYPE node_pool_code  AS ENUM ('H100_SXM','H200_NVL','B200_NVL72','B300','GB300_NVL72');
CREATE TYPE resource_kind   AS ENUM ('gpu_vm','gpu_baremetal','vgpu','inference');
CREATE TYPE resource_status AS ENUM ('provisioning','running','stopped','error','terminating');
CREATE TYPE order_status    AS ENUM ('pending','provisioning','fulfilled','failed');
CREATE TYPE source_type     AS ENUM ('direct','image','model','template','notebook');
CREATE TYPE step_state      AS ENUM ('pending','running','done','failed','skipped');
CREATE TYPE event_level     AS ENUM ('info','warning','error','success');

CREATE TYPE node_state      AS ENUM ('ready','cordoned','draining','remediation','notready');

CREATE TYPE rate_unit          AS ENUM ('per_gpu_hour','per_gb_hour','per_instance_hour');
CREATE TYPE invoice_status     AS ENUM ('open','paid','overdue','void');
CREATE TYPE txn_type           AS ENUM ('charge','refund','credit','adjustment');
CREATE TYPE voucher_status     AS ENUM ('unused','partial','used','expired','void');
CREATE TYPE reservation_status AS ENUM ('scheduled','active','expired','cancelled','refunded');
CREATE TYPE quota_metric       AS ENUM ('gpu','vcpu','storage_gb','public_ip');

CREATE TYPE ticket_status    AS ENUM ('open','pending','resolved','closed');
CREATE TYPE ticket_priority AS ENUM ('low','normal','high','urgent');

-- ---------------------------------------------------------------------------
-- §12.1 identity — 用户与组织（计费与配额主体）
-- ---------------------------------------------------------------------------
CREATE TABLE plans (
  code              VARCHAR(32) PRIMARY KEY,
  name              VARCHAR(64)  NOT NULL,
  free_credit_usd   NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_members       INT          NOT NULL DEFAULT 20,
  support_level     VARCHAR(32)  NOT NULL DEFAULT 'community',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE orgs (
  id                        BIGSERIAL PRIMARY KEY,
  name                      VARCHAR(128) NOT NULL,
  slug                      VARCHAR(64)  NOT NULL UNIQUE,
  plan_code                 VARCHAR(32)  NOT NULL REFERENCES plans(code) ON UPDATE CASCADE,
  credit_balance            NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency                  CHAR(3)      NOT NULL DEFAULT 'USD',
  low_balance_threshold_usd NUMERIC(12,2) NOT NULL DEFAULT 50.00,
  status                    VARCHAR(16)  NOT NULL DEFAULT 'active',
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_orgs_slug ON orgs(slug);

CREATE TABLE users (
  id                BIGSERIAL PRIMARY KEY,
  uuid              UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  org_id            BIGINT       NOT NULL REFERENCES orgs(id) ON DELETE RESTRICT,
  email             VARCHAR(255) NOT NULL UNIQUE,
  display_name      VARCHAR(128) NOT NULL,
  status            user_status  NOT NULL DEFAULT 'active',
  role              user_role    NOT NULL DEFAULT 'member',
  identity_provider VARCHAR(32),
  mfa_enabled       BOOLEAN      NOT NULL DEFAULT false,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_users_org   ON users(org_id);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE projects (
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT      NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name       VARCHAR(128) NOT NULL,
  slug       VARCHAR(64)  NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE TABLE project_members (
  project_id BIGINT       NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    BIGINT       NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  role       project_role NOT NULL DEFAULT 'member',
  PRIMARY KEY (project_id, user_id)
);

-- ---------------------------------------------------------------------------
-- §12.3 supply — 供给侧（集群模块）
-- ---------------------------------------------------------------------------
CREATE TABLE node_pools (
  code          node_pool_code PRIMARY KEY,
  display_name  VARCHAR(32)  NOT NULL,
  gpu_model     VARCHAR(32)  NOT NULL,
  gpus_per_node INT          NOT NULL DEFAULT 8,
  vram_gb       INT          NOT NULL,
  interconnect  VARCHAR(32),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE gpu_nodes (
  id           BIGSERIAL PRIMARY KEY,
  node_uid     VARCHAR(64)  NOT NULL UNIQUE,
  pool_code    node_pool_code NOT NULL REFERENCES node_pools(code),
  region       region_code  NOT NULL,
  rack_id      VARCHAR(64),
  switch_group VARCHAR(64),
  gpu_count    INT          NOT NULL DEFAULT 0,
  state        node_state   NOT NULL DEFAULT 'ready',
  straggler    BOOLEAN      NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_nodes_pool_region ON gpu_nodes(pool_code, region);
CREATE INDEX idx_nodes_state       ON gpu_nodes(state);

CREATE TABLE node_events (
  id            BIGSERIAL PRIMARY KEY,
  node_id       BIGINT      NOT NULL REFERENCES gpu_nodes(id) ON DELETE CASCADE,
  type          VARCHAR(48) NOT NULL,
  level         event_level NOT NULL DEFAULT 'info',
  message       TEXT,
  actor_user_id BIGINT      REFERENCES users(id),
  payload       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_node_events ON node_events(node_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- §12.2 deployment — 资源映射（下单 → 资源实例 → 落位）
-- 循环外键已拆除：仅保留单向 resources.order_id。
-- ---------------------------------------------------------------------------
CREATE TABLE deployment_orders (
  id             BIGSERIAL PRIMARY KEY,
  order_uuid     UUID          NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  org_id         BIGINT        NOT NULL REFERENCES orgs(id),
  owner_id       BIGINT        NOT NULL REFERENCES users(id),
  project_id     BIGINT        REFERENCES projects(id),
  resource_kind  resource_kind NOT NULL,
  requested_spec JSONB         NOT NULL,
  region         region_code   NOT NULL,
  node_pool      node_pool_code,
  source_type    source_type   NOT NULL DEFAULT 'direct',
  source_ref_id  BIGINT,
  price_snapshot NUMERIC(14,4),
  status         order_status  NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_org ON deployment_orders(org_id, status);

CREATE TABLE resources (
  id             BIGSERIAL PRIMARY KEY,
  resource_uuid  UUID          NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  display_id     VARCHAR(32)   NOT NULL UNIQUE,
  org_id         BIGINT        NOT NULL REFERENCES orgs(id),
  owner_id       BIGINT        NOT NULL REFERENCES users(id),
  project_id     BIGINT        REFERENCES projects(id),
  order_id       BIGINT        REFERENCES deployment_orders(id),
  kind           resource_kind NOT NULL,
  name           VARCHAR(128)  NOT NULL,
  region         region_code   NOT NULL,
  node_pool      node_pool_code NOT NULL,
  spec_json      JSONB         NOT NULL,
  gpu_count      INT           NOT NULL DEFAULT 0,
  storage_gb     NUMERIC(12,2) NOT NULL DEFAULT 0,
  status         resource_status NOT NULL DEFAULT 'provisioning',
  running_since  TIMESTAMPTZ,
  stopped_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX idx_resources_org_kind ON resources(org_id, kind);
CREATE INDEX idx_resources_status   ON resources(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_resources_order    ON resources(order_id);

CREATE TABLE resource_placements (
  id           BIGSERIAL PRIMARY KEY,
  resource_id  BIGINT         NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  node_pool    node_pool_code NOT NULL,
  node_id      BIGINT         REFERENCES gpu_nodes(id),
  rack_id      VARCHAR(64),
  gpu_indices  INT[],
  assigned_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_placements_resource ON resource_placements(resource_id);

CREATE TABLE resource_events (
  id            BIGSERIAL PRIMARY KEY,
  resource_id   BIGINT      NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  org_id        BIGINT      NOT NULL REFERENCES orgs(id),
  type          VARCHAR(48) NOT NULL,
  level         event_level NOT NULL DEFAULT 'info',
  message       TEXT        NOT NULL,
  actor_user_id BIGINT      REFERENCES users(id),
  payload       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_res_events ON resource_events(resource_id, created_at DESC);

CREATE TABLE resource_provisioning_steps (
  id          BIGSERIAL PRIMARY KEY,
  resource_id BIGINT     NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  seq         SMALLINT   NOT NULL,
  step_key    VARCHAR(48) NOT NULL,
  state       step_state NOT NULL DEFAULT 'pending',
  message     TEXT,
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  UNIQUE (resource_id, step_key)
);

-- ---------------------------------------------------------------------------
-- §12.4 billing — 计费与资产
-- ---------------------------------------------------------------------------
CREATE TABLE billing_rates (
  id             BIGSERIAL PRIMARY KEY,
  resource_kind  resource_kind NOT NULL,
  node_pool      node_pool_code NOT NULL,
  region         region_code   NOT NULL,
  unit           rate_unit     NOT NULL,
  price          NUMERIC(10,4) NOT NULL,
  currency       CHAR(3)       NOT NULL DEFAULT 'USD',
  effective_from DATE          NOT NULL,
  effective_to   DATE,
  UNIQUE (resource_kind, node_pool, region, unit, effective_from)
);

CREATE TABLE billing_usage (
  id             BIGSERIAL PRIMARY KEY,
  org_id         BIGINT        NOT NULL REFERENCES orgs(id),
  project_id     BIGINT        REFERENCES projects(id),
  resource_id    BIGINT        NOT NULL REFERENCES resources(id),
  resource_kind  resource_kind NOT NULL,
  node_pool      node_pool_code NOT NULL,
  region         region_code   NOT NULL,
  unit           rate_unit     NOT NULL,
  quantity       NUMERIC(12,4) NOT NULL,
  unit_price     NUMERIC(10,4) NOT NULL,
  amount         NUMERIC(14,4) NOT NULL,
  billing_period DATE          NOT NULL,
  usage_hour     TIMESTAMPTZ   NOT NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (resource_id, usage_hour, unit)
);
CREATE INDEX idx_usage_org_period ON billing_usage(org_id, billing_period);
CREATE INDEX idx_usage_resource   ON billing_usage(resource_id);

CREATE TABLE invoices (
  id             BIGSERIAL PRIMARY KEY,
  invoice_uuid   UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  org_id         BIGINT       NOT NULL REFERENCES orgs(id),
  billing_period DATE         NOT NULL,
  subtotal       NUMERIC(14,2) NOT NULL,
  tax            NUMERIC(14,2) NOT NULL DEFAULT 0,
  total          NUMERIC(14,2) NOT NULL,
  currency       CHAR(3)      NOT NULL DEFAULT 'USD',
  status         invoice_status NOT NULL DEFAULT 'open',
  due_at         TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_org_period ON invoices(org_id, billing_period);

CREATE TABLE billing_transactions (
  id             BIGSERIAL PRIMARY KEY,
  org_id         BIGINT       NOT NULL REFERENCES orgs(id),
  type           txn_type     NOT NULL,
  amount         NUMERIC(14,2) NOT NULL,
  currency       CHAR(3)      NOT NULL DEFAULT 'USD',
  balance_after  NUMERIC(14,2) NOT NULL,
  reference_type VARCHAR(32),
  reference_id   BIGINT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_org ON billing_transactions(org_id, created_at DESC);

CREATE TABLE vouchers (
  id               BIGSERIAL PRIMARY KEY,
  org_id           BIGINT      NOT NULL REFERENCES orgs(id),
  code             VARCHAR(48) NOT NULL UNIQUE,
  amount           NUMERIC(12,2) NOT NULL,
  balance          NUMERIC(12,2) NOT NULL,
  currency         CHAR(3)      NOT NULL DEFAULT 'USD',
  applicable_kind  resource_kind,
  applicable_region region_code,
  status           voucher_status NOT NULL DEFAULT 'unused',
  valid_from       TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to         TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE voucher_redemptions (
  id          BIGSERIAL PRIMARY KEY,
  voucher_id  BIGINT       NOT NULL REFERENCES vouchers(id),
  invoice_id  BIGINT       REFERENCES invoices(id),
  amount      NUMERIC(12,2) NOT NULL,
  applied_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_redemptions_voucher ON voucher_redemptions(voucher_id);

CREATE TABLE reservations (
  id                        BIGSERIAL PRIMARY KEY,
  org_id                    BIGINT        NOT NULL REFERENCES orgs(id),
  node_pool                 node_pool_code NOT NULL,
  region                    region_code   NOT NULL,
  gpu_count                 INT           NOT NULL,
  committed_price_per_gpu_hour NUMERIC(10,4) NOT NULL,
  start_at                  TIMESTAMPTZ   NOT NULL,
  end_at                    TIMESTAMPTZ   NOT NULL,
  status                    reservation_status NOT NULL DEFAULT 'scheduled',
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_reservations_org ON reservations(org_id, status);

CREATE TABLE storage_packs (
  id           BIGSERIAL PRIMARY KEY,
  org_id       BIGINT       NOT NULL REFERENCES orgs(id),
  size_gb      NUMERIC(12,2) NOT NULL,
  remaining_gb NUMERIC(12,2) NOT NULL,
  valid_from   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  valid_to     TIMESTAMPTZ  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE quotas (
  id            BIGSERIAL PRIMARY KEY,
  org_id        BIGINT      NOT NULL REFERENCES orgs(id),
  resource_kind resource_kind,
  region        region_code,
  metric        quota_metric NOT NULL,
  limit_value   NUMERIC(14,2) NOT NULL,
  used_value    NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (org_id, resource_kind, region, metric)
);

-- ---------------------------------------------------------------------------
-- §12.5 content / 支撑实体（模型库、商城、数据、工单、通知）
-- ---------------------------------------------------------------------------
CREATE TABLE models (
  id           BIGSERIAL PRIMARY KEY,
  slug         VARCHAR(128) NOT NULL UNIQUE,
  name         VARCHAR(160) NOT NULL,
  source       VARCHAR(32)  NOT NULL,
  modality     VARCHAR(32),
  param_size   VARCHAR(16),
  license      VARCHAR(64),
  quantization VARCHAR(32),
  description  TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE model_favorites (
  user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_id BIGINT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, model_id)
);

CREATE TABLE images (
  id            BIGSERIAL PRIMARY KEY,
  name          VARCHAR(128) NOT NULL,
  registry      VARCHAR(255) NOT NULL,
  tag           VARCHAR(64)  NOT NULL,
  framework     VARCHAR(64),
  cuda_version  VARCHAR(32),
  size_gb       NUMERIC(10,2),
  is_official   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app_templates (
  id              BIGSERIAL PRIMARY KEY,
  slug            VARCHAR(128) NOT NULL UNIQUE,
  name            VARCHAR(160) NOT NULL,
  category        VARCHAR(64),
  default_image_id BIGINT REFERENCES images(id),
  form_schema     JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notebooks (
  id          BIGSERIAL PRIMARY KEY,
  org_id      BIGINT      NOT NULL REFERENCES orgs(id),
  user_id     BIGINT      NOT NULL REFERENCES users(id),
  resource_id BIGINT      REFERENCES resources(id) ON DELETE SET NULL,
  type        VARCHAR(16) NOT NULL DEFAULT 'jupyter',
  status      VARCHAR(16) NOT NULL DEFAULT 'running',
  url_path    VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE datasets (
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT      NOT NULL REFERENCES orgs(id),
  name       VARCHAR(160) NOT NULL,
  version    VARCHAR(32) NOT NULL DEFAULT 'v1',
  size_gb    NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE buckets (
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT      NOT NULL REFERENCES orgs(id),
  name       VARCHAR(128) NOT NULL,
  region     region_code NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE TABLE objects (
  id         BIGSERIAL PRIMARY KEY,
  bucket_id  BIGINT      NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
  key        VARCHAR(512) NOT NULL,
  size_bytes BIGINT      NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE pipelines (
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT      NOT NULL REFERENCES orgs(id),
  name       VARCHAR(160) NOT NULL,
  dag_json   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  id          BIGSERIAL PRIMARY KEY,
  org_id      BIGINT      NOT NULL REFERENCES orgs(id),
  user_id     BIGINT      NOT NULL REFERENCES users(id),
  resource_id BIGINT      REFERENCES resources(id) ON DELETE SET NULL,
  subject     VARCHAR(200) NOT NULL,
  description TEXT,
  status      ticket_status   NOT NULL DEFAULT 'open',
  priority    ticket_priority NOT NULL DEFAULT 'normal',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_org ON tickets(org_id, status);

CREATE TABLE notifications (
  id         BIGSERIAL PRIMARY KEY,
  org_id     BIGINT      NOT NULL REFERENCES orgs(id),
  user_id    BIGINT      REFERENCES users(id),
  type       VARCHAR(48) NOT NULL,
  level      event_level NOT NULL DEFAULT 'info',
  title      VARCHAR(200) NOT NULL,
  body       TEXT,
  link       VARCHAR(255),
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_org_user ON notifications(org_id, user_id, read_at);
