// 平台管理后台数据种子（演示用，全部与目录数据保持一致）
import { GPU, REGIONS } from "./catalog.js";
import { fleetFromState } from "./fleet.js";

// 机队总览：由真实集群状态（state.clusters）实算，保证与算力市场 / 总览口径一致
export function fleet(s) {
  const clusters = (s && s.clusters) || [];
  return REGIONS.map((r) => {
    const models = GPU.map((g) => {
      const cs = clusters.filter((c) => c.region === r.id && c.gpu === g.id);
      const total = cs.reduce((a, c) => a + c.count, 0);
      const allocated = cs.reduce((a, c) => a + (c.status === "running" ? Math.round(c.count * (c.util / 100)) : c.status === "degraded" ? Math.round(c.count * (c.util / 100) * 0.6) : 0), 0);
      return { id: g.id, name: g.name, total, free: total - allocated, allocated };
    });
    const total = models.reduce((a, m) => a + m.total, 0);
    const free = models.reduce((a, m) => a + m.free, 0);
    const allocated = models.reduce((a, m) => a + m.allocated, 0);
    return {
      region: r.id,
      regionName: r.name,
      country: r.country,
      total,
      free,
      allocated,
      models,
    };
  });
}

export function adminSeed(fl = {}) {
  const usage = fl.usage || [];
  const tenantDefs = fl.tenants || [];
  let _s = 771;
  const rng = () => { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296; };
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const dateAgo = (months) => {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const tenants = tenantDefs.map((t, i) => {
    const u = usage.find((x) => x.id === t.id) || { capacity: 0, used: 0 };
    const plan = u.capacity > 900 ? "Enterprise" : u.capacity > 400 ? "Scale" : u.capacity > 120 ? "Growth" : "Starter";
    const gpuQuota = Math.max(8, Math.round((u.capacity * 1.12) / 8) * 8);
    const gpuUsed = u.used;
    const spend = Math.round(u.used * 1825 * (0.8 + rng() * 0.5) * 100) / 100;
    const status = i === 4 ? "suspended" : i === 5 ? "invited" : "active";
    return {
      id: t.id, name: t.name, plan, region: t.region,
      gpuQuota, gpuUsed, members: 4 + Math.floor(rng() * 40),
      spend, status, created: dateAgo(3 + Math.floor(rng() * 20)),
      contact: "ops@" + slug(t.name) + ".com",
    };
  });

  // 用户：跨租户生成（演示用确定性名单 + 随机扩展）
  const firstNames = ["Mei", "John", "Somchai", "Emily", "Kenji", "Araya", "Liam", "Yuki", "Tom", "Ploy", "Sara", "Wei", "Noah", "Anya", "Hiro", "Mia", "Kai", "Lin", "Omar", "Eve"];
  const roles = ["owner", "admin", "developer", "developer", "viewer", "billing"];
  const users = [];
  tenants.forEach((t, ti) => {
    const n = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const fn = firstNames[(ti * 3 + i) % firstNames.length];
      users.push({
        id: "u-" + String(users.length + 1).padStart(3, "0"),
        name: fn + " " + ["Tanaka", "Carter", "R.", "Zhang", "Watanabe", "P.", "Smith", "Sato", "Lee", "Chai", "Lopez", "Wang"][(ti + i) % 12],
        email: fn.toLowerCase() + "@" + slug(t.name) + ".com",
        tenant: t.name,
        role: i === 0 ? "owner" : roles[(ti + i) % roles.length],
        mfa: rng() > 0.35,
        last: ["2 分钟前", "18 分钟前", "1 小时前", "昨天", "3 天前", "12 天前"][Math.floor(rng() * 6)],
        status: t.status === "active" ? "active" : rng() > 0.5 ? "active" : "suspended",
      });
    }
  });

  const roleDefs = [
    { id: "owner", name: "Owner", desc: { zh: "租户所有者，拥有全部权限与账单责任", en: "Tenant owner: full access and billing responsibility" } },
    { id: "admin", name: "Admin", desc: { zh: "管理资源与成员，不可变更账单", en: "Manage resources and members, no billing changes" } },
    { id: "developer", name: "Developer", desc: { zh: "创建与管理工作负载", en: "Create and manage workloads" } },
    { id: "viewer", name: "Viewer", desc: { zh: "只读查看资源与监控", en: "Read-only resources and metrics" } },
    { id: "billing", name: "Billing", desc: { zh: "查看与结算费用，无资源写权限", en: "View and settle invoices, no resource writes" } },
  ];
  const matrix = [
    { perm: { zh: "创建 / 删除 GPU 工作负载", en: "Create / delete GPU workloads" }, owner: 1, admin: 1, developer: 1, viewer: 0, billing: 0 },
    { perm: { zh: "部署与扩缩容 Endpoint", en: "Deploy and scale endpoints" }, owner: 1, admin: 1, developer: 1, viewer: 0, billing: 0 },
    { perm: { zh: "提交训练任务与集群", en: "Submit training jobs & clusters" }, owner: 1, admin: 1, developer: 1, viewer: 0, billing: 0 },
    { perm: { zh: "管理数据集与模型资产", en: "Manage datasets and model assets" }, owner: 1, admin: 1, developer: 1, viewer: 0, billing: 0 },
    { perm: { zh: "邀请成员与分配角色", en: "Invite members and assign roles" }, owner: 1, admin: 1, developer: 0, viewer: 0, billing: 0 },
    { perm: { zh: "管理 API Key 与 Secret", en: "Manage API keys and secrets" }, owner: 1, admin: 1, developer: 1, viewer: 0, billing: 0 },
    { perm: { zh: "查看账单与设置预算", en: "View invoices and set budget" }, owner: 1, admin: 0, developer: 0, viewer: 0, billing: 1 },
    { perm: { zh: "查看审计日志", en: "View audit log" }, owner: 1, admin: 1, developer: 0, viewer: 0, billing: 0 },
  ];
  const plans = [
    { id: "Starter", gpuLimit: 8, maxNodes: 2, storage: "2 TB", fee: 0 },
    { id: "Growth", gpuLimit: 128, maxNodes: 16, storage: "40 TB", fee: 499 },
    { id: "Scale", gpuLimit: 512, maxNodes: 64, storage: "200 TB", fee: 1499 },
    { id: "Enterprise", gpuLimit: 2048, maxNodes: 256, storage: "2 PB", fee: 4999 },
  ];
  const invoices = tenants.map((t, i) => ({
    id: "INV-2026-09" + String(i + 1).padStart(2, "0"),
    tenant: t.name,
    amount: t.spend,
    period: "2026-09",
    status: i === 3 ? "unpaid" : i === 4 ? "overdue" : i === 5 ? "unpaid" : "paid",
    issued: "2026-10-01",
  }));
  const services = [
    { name: { zh: "控制平面 API", en: "Control plane API" }, status: "healthy", p95: "86 ms", uptime: "99.99%" },
    { name: { zh: "GPU 调度器", en: "GPU scheduler" }, status: "healthy", p95: "142 ms", uptime: "99.97%" },
    { name: { zh: "推理网关", en: "Inference gateway" }, status: "healthy", p95: "54 ms", uptime: "99.98%" },
    { name: { zh: "对象存储", en: "Object storage" }, status: "degraded", p95: "318 ms", uptime: "99.62%" },
    { name: { zh: "共享文件系统", en: "Shared filesystem" }, status: "healthy", p95: "27 ms", uptime: "99.95%" },
    { name: { zh: "计费与计量", en: "Metering & billing" }, status: "maintenance", p95: "210 ms", uptime: "99.90%" },
    { name: { zh: "推理网关 WAF", en: "Inference WAF" }, status: "healthy", p95: "12 ms", uptime: "99.99%" },
    { name: { zh: "GPU 遥测 Pipeline", en: "GPU telemetry pipeline" }, status: "healthy", p95: "40 ms", uptime: "99.96%" },
  ];
  const tickets = [
    { id: "TK-5081", title: { zh: "美东 IAD-1 区域 B300 扩容审批", en: "US-IAD-1 B300 capacity approval" }, tenant: "Nexa AI Labs", priority: "high", assignee: "Capacity Ops", age: "3h", status: "open" },
    { id: "TK-5082", title: { zh: "推理网关 5xx 抖动排查", en: "Inference gateway 5xx jitter" }, tenant: "Pacific Vision", priority: "high", assignee: "SRE", age: "5h", status: "open" },
    { id: "TK-5083", title: { zh: "GB300 机架 NCCL 带宽周期性抖动", en: "GB300 rack NCCL bandwidth jitter" }, tenant: "Helios Bio", priority: "high", assignee: "GPU Fabric", age: "8h", status: "open" },
    { id: "TK-5084", title: { zh: "账单导出字段缺失", en: "Invoice export missing fields" }, tenant: "Aster Data", priority: "medium", assignee: "Billing", age: "1d", status: "open" },
    { id: "TK-5079", title: { zh: "对象存储限速告警", en: "Object storage throttling alert" }, tenant: "Sakura Robotics", priority: "medium", assignee: "Storage", age: "2d", status: "resolved" },
    { id: "TK-5077", title: { zh: "新增子账号与配额调整", en: "Add sub-account and raise quota" }, tenant: "Orion Research", priority: "low", assignee: "Support", age: "3d", status: "resolved" },
    { id: "TK-5075", title: { zh: "曼谷区域网络维护窗口确认", en: "Bangkok maintenance window" }, tenant: "Nova Studios", priority: "low", assignee: "Network", age: "4d", status: "open" },
  ];
  const announcements = [
    { date: "2026-10-13", title: { zh: "GB300 NVL72 机架在美东 IAD-1 扩容至 14 台", en: "GB300 NVL72 racks expanded to 14 in US-IAD-1" }, level: "info" },
    { date: "2026-10-12", title: { zh: "万卡级机队容量规划面板已上线", en: "Fleet capacity planning panel is live" }, level: "info" },
    { date: "2026-10-08", title: { zh: "曼谷区域将于 10-20 进行网络维护", en: "Bangkok network maintenance on Oct 20" }, level: "warning" },
    { date: "2026-09-30", title: { zh: "抢占式实例价格下调 12%", en: "Spot prices reduced by 12%" }, level: "success" },
    { date: "2026-09-22", title: { zh: "B200 集群在洛杉矶 LAX-2 全面可用", en: "B200 clusters generally available in US-LAX-2" }, level: "success" },
  ];
  const audit = [
    { time: "13:42", actor: "John Carter", action: { zh: "扩容 Endpoint", en: "Scale endpoint" }, target: "qwen-chat-prod", ip: "203.0.113.24", result: "success" },
    { time: "13:31", actor: "Mei Tanaka", action: { zh: "更新租户配额", en: "Update tenant quota" }, target: "Sakura Robotics", ip: "198.51.100.7", result: "success" },
    { time: "12:58", actor: "Emily Zhang", action: { zh: "下载账单", en: "Download invoice" }, target: "INV-2026-0904", ip: "192.0.2.18", result: "success" },
    { time: "12:40", actor: "Somchai R.", action: { zh: "提交训练任务", en: "Submit training job" }, target: "pretrain-stage-2", ip: "203.0.113.91", result: "warning" },
    { time: "11:26", actor: "System", action: { zh: "自动修复 GPU 节点", en: "Auto-remediate GPU node" }, target: "cl-0012", ip: "—", result: "success" },
    { time: "10:12", actor: "Araya P.", action: { zh: "删除持久卷（已拦截）", en: "Delete volume (blocked)" }, target: "team-datasets", ip: "198.51.100.44", result: "error" },
    { time: "09:47", actor: "Kenji Watanabe", action: { zh: "导出模型权重", en: "Export model weights" }, target: "qwen3-32b", ip: "192.0.2.77", result: "success" },
    { time: "09:05", actor: "Support", action: { zh: "处理工单", en: "Resolve ticket" }, target: "TK-5079", ip: "—", result: "success" },
    { time: "08:33", actor: "System", action: { zh: "抢占式回收空闲 GPU", en: "Reclaimed idle spot GPUs" }, target: "US-LAX-2", ip: "—", result: "success" },
    { time: "07:51", actor: "Liam Smith", action: { zh: "创建 K8s 命名空间配额", en: "Create K8s namespace quota" }, target: "nexa-prod", ip: "203.0.113.150", result: "success" },
  ];

  return {
    platform: {
      name: "RunSun Cloud Platform",
      version: "v4.1.0",
      controlPlane: { zh: "健康", en: "Healthy" },
      regionsOnline: REGIONS.length,
      supportSla: { zh: "7×24 · 15 分钟响应", en: "24/7 · 15-min response" },
      fleetTarget: 10000,
    },
    tenants,
    users,
    roles: roleDefs,
    matrix,
    plans,
    invoices,
    services,
    tickets,
    announcements,
    audit,
  };
}
