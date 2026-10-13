// 外壳：对齐原型 shell() 与 nav()
import { S } from "./store.js";
import { esc } from "./ui.js";

export function nav(n) {
  const id = n[0], icon = n[1], label = n[2];
  const mini = id === "endpoints" ? `<span class="mini">NEW</span>` : "";
  return `<button class="nav ${S.page === id ? "active" : ""}" data-nav="${id}" title="${esc(label)}" aria-current="${S.page === id ? "page" : "false"}"><span style="font-size:16px;min-width:18px;text-align:center">${icon}</span><span>${label}</span>${mini}</button>`;
}

export function shell() {
  const list = S.NAV || [];
  const p = S.project;
  const collapsed = !!S.sidebarCollapsed;
  return [
    `<div class="app${collapsed ? " collapsed" : ""}">`,
    `<aside class="sidebar">`,
    `<div class="brand"><div class="brandlogo">☁</div><div><b>GPU Cloud 控制台</b><small>为 AI 工作负载而生</small></div></div>`,
    `<div class="nav-section">CLOUD WORKSPACE</div>${list.slice(0, 4).map(nav).join("")}`,
    `<div class="nav-section">AI PLATFORM</div>${list.slice(4, 8).map(nav).join("")}`,
    `<div class="nav-section">OPERATIONS</div>${list.slice(8).map(nav).join("")}`,
    `<div class="side-bottom"><div class="promo"><h3>从 GPU 到 AI 服务</h3><p>开发工作空间 · 训练任务<br>Serverless 推理 · 分布式集群</p><button data-act="go-create">立即部署 ↗</button></div><div style="padding:12px 4px 2px;color:#5b6779;font-size:10px">DEMO PROTOTYPE · V3.0</div></div>`,
    `</aside>`,
    `<div class="main">`,
    `<div class="topbar">`,
    `<button class="side-toggle" data-act="toggle-sidebar" title="${collapsed ? "展开侧边栏" : "折叠侧边栏"}" aria-label="${collapsed ? "展开侧边栏" : "折叠侧边栏"}">☰</button>`,
    `<select class="org" aria-label="组织"><option>AI Platform Team ▾</option></select>`,
    `<select class="project" data-set="project" aria-label="项目"><option ${p === "AI Platform / Production" ? "selected" : ""}>AI Platform / Production</option><option ${p === "AI Platform / Staging" ? "selected" : ""}>AI Platform / Staging</option><option ${p === "Research / Sandbox" ? "selected" : ""}>Research / Sandbox</option></select>`,
    `<div class="search-global">⌕ <input id="global-search" placeholder="搜索实例、模型、任务..." aria-label="全局搜索"/><span class="shortcut">⌘ K</span></div>`,
    `<span class="top-spacer"></span><span class="env">● Demo 环境</span>`,
    `<button class="top-icon" title="通知" aria-label="通知" data-act="notifications">♧</button>`,
    `<button class="top-icon" title="产品说明" aria-label="产品说明" data-act="about">ⓘ</button>`,
    `<span class="avatar">G</span><div class="top-name">平台管理员<small>管理员</small></div>`,
    `</div>`,
    `<main class="content" id="page"></main>`,
    `</div></div>`,
  ].join("");
}
