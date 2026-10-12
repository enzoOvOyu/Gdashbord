// 对齐原型 securityPage()
import { api } from "../api.js";
import { header, metric, section, btn, esc, status, tabs } from "../ui.js";

export default async function securityPage(S) {
  const res = await api.security();
  const keys = res.keys || [];
  const secrets = res.secrets || [];
  const t = S.securityTab;

  return [
    header("API 密钥与权限", "企业级 GPU Cloud 需要项目隔离、密钥、Secret 注入、配额、审计与团队协作。", btn("＋ 创建 API Key", "new-key", "primary")),
    `<div class="grid cols-4 mb16">`,
    metric("活跃 API Keys", keys.filter((k) => k.active).length, "按项目和用途区分", "⚿", ""),
    metric("Secret 变量", secrets.length, "加密托管 · 仅元数据", "◈", ""),
    metric("团队成员", "8", "Owner / Admin / Developer", "♧", ""),
    metric("GPU 配额", "88 / 128", "可分配 GPU 张数", "▦", ""),
    `</div>`,
    tabs([["keys", "API Keys"], ["secrets", "Secrets"], ["members", "成员与角色"], ["quotas", "项目配额"]], t, "securityTab"),
    t === "keys"
      ? `<div class="card card-pad">${section("API Key 管理", btn("新建密钥", "new-key", "sm primary"))}<div class="callout mb16">API Key 用于 Endpoint 请求鉴权及开发者 API；密钥明文通常只在创建时展示一次。此处仅保存演示前缀。</div><div class="table-wrap"><table><thead><tr><th>密钥名称</th><th>前缀</th><th>创建日期</th><th>最近使用</th><th>状态</th><th>操作</th></tr></thead><tbody>${keys.map((k) => `<tr><td><strong>${esc(k.name)}</strong></td><td>${esc(k.prefix)}</td><td>${esc(k.created)}</td><td>${esc(k.last)}</td><td>${k.active ? status("healthy") : status("stopped")}</td><td>${k.active ? btn("撤销", "revoke-key:" + k.id, "sm danger") : "—"}</td></tr>`).join("")}</tbody></table></div></div>`
      : t === "secrets"
      ? `<div class="card card-pad">${section("运行时 Secrets", btn("＋ 新增 Secret", "new-secret", "sm primary"))}<div class="callout mb16">参考 Modal 的 Secrets：在服务启动时向容器注入密钥，前端不展示和存储真实值。</div><div class="table-wrap"><table><thead><tr><th>变量名</th><th>可用项目</th><th>最近更新</th><th>值</th><th>操作</th></tr></thead><tbody>${secrets.map((x) => `<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.scope)}</td><td>${esc(x.updated)}</td><td>••••••••</td><td>${btn("查看使用说明", "secret:" + x.name, "sm")}</td></tr>`).join("")}</tbody></table></div></div>`
      : t === "members"
      ? `<div class="card card-pad">${section("团队成员与 RBAC")}<div class="table-wrap"><table><thead><tr><th>成员</th><th>角色</th><th>项目范围</th><th>权限摘要</th></tr></thead><tbody>${[["admin@nebula.example", "Owner", "全部项目", "组织设置 / 费用 / 全部资源"], ["ml-engineer@nebula.example", "Developer", "Production / Staging", "部署 / 训练 / 日志"], ["researcher@nebula.example", "Viewer", "Research / Sandbox", "只读资源与监控"]].map((x) => `<tr><td><strong>${x[0]}</strong></td><td><span class="pill blue">${x[1]}</span></td><td>${x[2]}</td><td>${x[3]}</td></tr>`).join("")}</tbody></table></div><div class="callout mt16">用户、项目、环境（dev/staging/prod）是多租户云平台的基础；实际权限必须在服务端执行，前端只做体验呈现。</div></div>`
      : `<div class="grid cols-2"><div class="card card-pad">${section("GPU 配额")}<div class="between"><b>88 / 128 张 GPU</b><span class="pill blue">69%</span></div><div class="progress mt12"><span style="width:69%"></span></div><div class="callout mt16">按项目控制 GPU 数量、训练集群节点、Endpoint 最大副本，避免异常扩容。</div></div><div class="card card-pad">${section("Endpoint 副本配额")}<div class="between"><b>12 / 32 副本</b><span class="pill green">38%</span></div><div class="progress mt12"><span style="width:38%;background:#10b9b0"></span></div><div class="callout mt16">建议结合预算、告警和自动扩缩容上限，形成闭环成本治理。</div></div></div>`,
  ].join("");
}
