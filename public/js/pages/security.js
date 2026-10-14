// API 密钥与权限（RBAC）
import { api } from "../api.js";
import { header, metric, section, btn, esc, status, tabs, t, L } from "../ui.js";

const S2 = (zh, en) => ({ zh, en });

export default async function securityPage(S) {
  const res = await api.security();
  const keys = res.keys || [];
  const secrets = res.secrets || [];
  const tab = S.securityTab;
  const members = [
    ["admin@runsuncloud.com", "owner", S2("全部项目", "All projects"), S2("组织设置 / 费用 / 全部资源", "Org settings / billing / all resources")],
    ["ml-engineer@runsuncloud.com", "developer", "Production / Staging", S2("部署 / 训练 / 日志", "Deploy / train / logs")],
    ["researcher@runsuncloud.com", "viewer", "Research / Sandbox", S2("只读资源与监控", "Read-only resources & metrics")],
  ];
  const rolePill = { owner: "purple", developer: "blue", viewer: "gray" };

  return [
    header("sec.title", S2("企业级 GPU Cloud 需要项目隔离、密钥、Secret 注入、配额、审计与团队协作。", "Enterprise GPU clouds need project isolation, keys, secret injection, quotas, audit and team collaboration."), btn(S2("＋ 创建 API Key", "＋ New API key"), "new-key", "primary")),
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric(S2("活跃 API Keys", "Active API keys"), keys.filter((k) => k.active).length, S2("按项目和用途区分", "Scoped by project and purpose"), "<i class='bi bi-key'></i>", "", "hero"),
    metric(S2("Secret 变量", "Secrets"), secrets.length, S2("加密托管 · 仅元数据", "Encrypted · metadata only"), "<i class='bi bi-box-seam'></i>", ""),
    metric(S2("团队成员", "Members"), members.length, "Owner / Developer / Viewer", "<i class='bi bi-people'></i>", ""),
    metric(S2("GPU 配额", "GPU quota"), "2,048 / 8,192", S2("项目可分配 GPU · 全平台 10,016", "Project allocatable GPUs · 10,016 platform-wide"), "<i class='bi bi-cpu'></i>", ""),
    `</div>`,
    tabs([["keys", "sec.tab.keys"], ["secrets", "sec.tab.secrets"], ["members", "sec.tab.members"], ["quotas", S2("项目配额", "Project quotas")]], tab, "securityTab"),
    tab === "keys"
      ? `<div class="card"><div class="section-head" style="padding:20px 20px 0"><div><div class="card-title">${esc(L(S2("API Key 管理", "API key management")))}</div><div class="card-sub">${esc(L(S2("Endpoint 请求与开发者 API 鉴权", "Authenticates endpoint and developer API calls")))}</div></div>${btn(S2("＋ 新建密钥", "＋ New key"), "new-key", "sm primary")}</div><div class="callout mb16" style="margin:0 20px 16px">${esc(L(S2("密钥明文只在创建时展示一次，请妥善保存。", "Plaintext is shown only once at creation — store it safely.")))}</div><div class="table-wrap"><table><thead><tr><th>KEY</th><th>${esc(L(S2("前缀", "Prefix")))}</th><th>${esc(L(S2("创建日期", "Created")))}</th><th>${esc(L(S2("最近使用", "Last used")))}</th><th>${esc(t("common.status"))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>${keys.map((k) => `<tr><td><div class="endpoint-name"><div class="endpoint-icon"><i class="bi bi-key"></i></div><div><strong>${esc(k.name)}</strong><small class="mono">${esc(k.prefix)}</small></div></div></td><td class="mono">${esc(k.prefix)}</td><td>${esc(k.created)}</td><td>${esc(L(k.last))}</td><td>${k.active ? status("healthy") : status("stopped")}</td><td>${k.active ? btn(S2("撤销", "Revoke"), "revoke-key:" + k.id, "sm danger") : "—"}</td></tr>`).join("")}</tbody></table><div class="table-footer"><span>${keys.length} keys</span><span>${esc(L(S2("密钥由服务端安全生成", "Keys are generated securely server-side")))}</span></div></div></div>`
      : tab === "secrets"
      ? `<div class="card card-pad">${section(S2("运行时 Secrets", "Runtime secrets"), btn(S2("＋ 新增 Secret", "＋ New secret"), "new-secret", "sm primary"))}<div class="callout mb16">${esc(L(S2("Secret 在服务启动时注入容器，前端不展示和存储明文值。", "Secrets are injected into containers at start; the frontend never displays or stores plaintext values.")))}</div><div class="table-wrap"><table><thead><tr><th>${esc(L(S2("变量名", "Variable")))}</th><th>${esc(L(S2("可用项目", "Scope")))}</th><th>${esc(L(S2("最近更新", "Updated")))}</th><th>${esc(L(S2("值", "Value")))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>${secrets.map((x) => `<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.scope)}</td><td>${esc(x.updated)}</td><td>••••••••</td><td>${btn(S2("查看使用说明", "Usage"), "secret:" + x.name, "sm")}</td></tr>`).join("")}</tbody></table></div></div>`
      : tab === "members"
      ? `<div class="card card-pad">${section(S2("团队成员与 RBAC", "Members & RBAC"))}<div class="table-wrap"><table><thead><tr><th>${esc(L(S2("成员", "Member")))}</th><th>${esc(L(S2("角色", "Role")))}</th><th>${esc(L(S2("项目范围", "Project scope")))}</th><th>${esc(L(S2("权限摘要", "Permissions")))}</th></tr></thead><tbody>${members.map((x) => `<tr><td><strong>${esc(x[0])}</strong></td><td><span class="pill ${rolePill[x[1]] || "gray"}">${esc(t("ad.role." + x[1]))}</span></td><td>${esc(L(x[2]))}</td><td>${esc(L(x[3]))}</td></tr>`).join("")}</tbody></table></div><div class="callout mt16">${esc(L(S2("用户、项目、环境（dev/staging/prod）是多租户平台的基础；权限在服务端强制执行。", "Users, projects and environments are the basis of multi-tenancy; permissions are enforced server-side.")))}</div></div>`
      : `<div class="grid cols-2"><div class="card card-pad">${section(S2("GPU 配额", "GPU quota"))}<div class="between"><b>2,048 / 8,192 ${esc(t("mk.card.stock"))}</b><span class="pill blue">25%</span></div><div class="progress mt12"><span style="width:25%"></span></div><div class="callout mt16">${esc(L(S2("按项目控制 GPU 数量、训练集群节点、Endpoint 最大副本，避免异常扩容。", "Cap GPUs, cluster nodes and endpoint replicas per project to avoid runaway scale-out.")))}</div></div><div class="card card-pad">${section(S2("Endpoint 副本配额", "Endpoint replica quota"))}<div class="between"><b>156 / 512 ${esc(t("cr.replica.unit"))}</b><span class="pill green">30%</span></div><div class="progress mt12"><span style="width:30%;background:var(--chart-2)"></span></div><div class="callout mt16">${esc(L(S2("建议结合预算、告警和自动扩缩容上限，形成闭环成本治理。", "Combine budget, alerts and autoscaling limits for closed-loop cost governance.")))}</div></div></div>`,
  ].join("");
}
