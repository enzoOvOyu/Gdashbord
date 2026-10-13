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
    metric(S2("GPU 配额", "GPU quota"), "88 / 128", S2("可分配 GPU 张数", "Allocatable GPUs"), "<i class='bi bi-cpu'></i>", ""),
    `</div>`,
    tabs([["keys", "sec.tab.keys"], ["secrets", "sec.tab.secrets"], ["members", "sec.tab.members"], ["quotas", S2("项目配额", "Project quotas")]], tab, "securityTab"),
    tab === "keys"
      ? `<div class="card card-pad">${section(S2("API Key 管理", "API key management"), btn(S2("新建密钥", "New key"), "new-key", "sm primary"))}<div class="callout mb16">${esc(L(S2("API Key 用于 Endpoint 请求鉴权及开发者 API；密钥明文通常只在创建时展示一次。此处仅保存演示前缀。", "API keys authenticate endpoint and developer API calls; plaintext is shown only once. Only a demo prefix is stored here.")))}</div><div class="table-wrap"><table><thead><tr><th>${esc(L(S2("密钥名称", "Key name")))}</th><th>${esc(L(S2("前缀", "Prefix")))}</th><th>${esc(L(S2("创建日期", "Created")))}</th><th>${esc(L(S2("最近使用", "Last used")))}</th><th>${esc(t("common.status"))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>${keys.map((k) => `<tr><td><strong>${esc(k.name)}</strong></td><td>${esc(k.prefix)}</td><td>${esc(k.created)}</td><td>${esc(L(k.last))}</td><td>${k.active ? status("healthy") : status("stopped")}</td><td>${k.active ? btn(S2("撤销", "Revoke"), "revoke-key:" + k.id, "sm danger") : "—"}</td></tr>`).join("")}</tbody></table></div></div>`
      : tab === "secrets"
      ? `<div class="card card-pad">${section(S2("运行时 Secrets", "Runtime secrets"), btn(S2("＋ 新增 Secret", "＋ New secret"), "new-secret", "sm primary"))}<div class="callout mb16">${esc(L(S2("参考 Modal 的 Secrets：在服务启动时向容器注入密钥，前端不展示和存储真实值。", "Inspired by Modal Secrets: values are injected into containers at start; the frontend never stores real values.")))}</div><div class="table-wrap"><table><thead><tr><th>${esc(L(S2("变量名", "Variable")))}</th><th>${esc(L(S2("可用项目", "Scope")))}</th><th>${esc(L(S2("最近更新", "Updated")))}</th><th>${esc(L(S2("值", "Value")))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>${secrets.map((x) => `<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.scope)}</td><td>${esc(x.updated)}</td><td>••••••••</td><td>${btn(S2("查看使用说明", "Usage"), "secret:" + x.name, "sm")}</td></tr>`).join("")}</tbody></table></div></div>`
      : tab === "members"
      ? `<div class="card card-pad">${section(S2("团队成员与 RBAC", "Members & RBAC"))}<div class="table-wrap"><table><thead><tr><th>${esc(L(S2("成员", "Member")))}</th><th>${esc(L(S2("角色", "Role")))}</th><th>${esc(L(S2("项目范围", "Project scope")))}</th><th>${esc(L(S2("权限摘要", "Permissions")))}</th></tr></thead><tbody>${members.map((x) => `<tr><td><strong>${esc(x[0])}</strong></td><td><span class="pill ${rolePill[x[1]] || "gray"}">${esc(t("ad.role." + x[1]))}</span></td><td>${esc(L(x[2]))}</td><td>${esc(L(x[3]))}</td></tr>`).join("")}</tbody></table></div><div class="callout mt16">${esc(L(S2("用户、项目、环境（dev/staging/prod）是多租户云平台的基础；实际权限必须在服务端执行，前端只做体验呈现。", "Users, projects and environments are the basis of multi-tenancy; enforcement must be server-side.")))}</div></div>`
      : `<div class="grid cols-2"><div class="card card-pad">${section(S2("GPU 配额", "GPU quota"))}<div class="between"><b>88 / 128 ${esc(t("mk.card.stock"))}</b><span class="pill blue">69%</span></div><div class="progress mt12"><span style="width:69%"></span></div><div class="callout mt16">${esc(L(S2("按项目控制 GPU 数量、训练集群节点、Endpoint 最大副本，避免异常扩容。", "Cap GPUs, cluster nodes and endpoint replicas per project to avoid runaway scale-out.")))}</div></div><div class="card card-pad">${section(S2("Endpoint 副本配额", "Endpoint replica quota"))}<div class="between"><b>12 / 32 ${esc(t("cr.replica.unit"))}</b><span class="pill green">38%</span></div><div class="progress mt12"><span style="width:38%;background:var(--chart-2)"></span></div><div class="callout mt16">${esc(L(S2("建议结合预算、告警和自动扩缩容上限，形成闭环成本治理。", "Combine budget, alerts and autoscaling limits for closed-loop cost governance.")))}</div></div></div>`,
  ].join("");
}
