// 外壳：侧边栏（含管理端分区）+ 顶栏（含中英切换）
import { S } from "./store.js";
import { esc, t, L } from "./ui.js";
import { getLang } from "./i18n.js";

export function nav(n) {
  const id = n[0], icon = n[1], key = n[2];
  const label = t("nav." + id);
  const mini = id === "admin" ? `<span class="mini">ADMIN</span>` : "";
  return `<button class="nav ${S.page === id ? "active" : ""}" data-nav="${id}" title="${esc(label)}" aria-current="${S.page === id ? "page" : "false"}"><span class="nav-icon"><i class="bi bi-${icon}"></i></span><span>${esc(label)}</span>${mini}</button>`;
}

export function shell() {
  const list = S.NAV || [];
  const p = S.project;
  const collapsed = !!S.sidebarCollapsed;
  const lang = getLang();
  return [
    `<div class="app${collapsed ? " collapsed" : ""}">`,
    `<aside class="sidebar">`,
    `<div class="brand"><div class="brandlogo"><i class='bi bi-gpu-card'></i></div><div><b>${esc(t("shell.brand"))}</b><small>${esc(t("shell.slogan"))}</small></div></div>`,
    `<div class="nav-section">${esc(t("nav.section.workspace"))}</div>${list.slice(0, 4).map(nav).join("")}`,
    `<div class="nav-section">${esc(t("nav.section.platform"))}</div>${list.slice(4, 8).map(nav).join("")}`,
    `<div class="nav-section">${esc(t("nav.section.operations"))}</div>${list.slice(8, 11).map(nav).join("")}`,
    `<div class="nav-section">${esc(t("nav.section.admin"))}</div>${list.slice(11).map(nav).join("")}`,
    `<div class="side-bottom"><div class="promo"><h3>${esc(t("shell.promo.title"))}</h3><p>${t("shell.promo.body")}</p><button data-act="go-create">${esc(t("shell.promo.cta"))}</button></div><div style="padding:12px 4px 2px;color:#5b6779;font-size:10px">DEMO PROTOTYPE · V3.2</div></div>`,
    `</aside>`,
    `<div class="main">`,
    `<div class="topbar">`,
    `<button class="side-toggle" data-act="toggle-sidebar" title="${esc(collapsed ? t("shell.expand") : t("shell.collapse"))}" aria-label="${esc(collapsed ? t("shell.expand") : t("shell.collapse"))}"><i class='bi bi-list'></i></button>`,
    `<select class="org" aria-label="organization"><option>${esc(t("shell.org"))}</option></select>`,
    `<select class="project" data-set="project" aria-label="project"><option ${p === "AI Platform / Production" ? "selected" : ""}>AI Platform / Production</option><option ${p === "AI Platform / Staging" ? "selected" : ""}>AI Platform / Staging</option><option ${p === "Research / Sandbox" ? "selected" : ""}>Research / Sandbox</option></select>`,
    `<div class="search-global"><i class='bi bi-search'></i><input id="global-search" placeholder="${esc(t("shell.search"))}" aria-label="search"/><span class="shortcut">⌘ K</span></div>`,
    `<span class="top-spacer"></span><span class="env">${esc(t("shell.env"))}</span>`,
    `<button class="lang-toggle" data-act="toggle-lang" title="Language" aria-label="Language"><i class='bi bi-translate'></i><span>${esc(lang === "zh" ? "EN" : "中")}</span></button>`,
    `<button class="top-icon" title="${esc(t("shell.notify"))}" aria-label="${esc(t("shell.notify"))}" data-act="notifications"><i class='bi bi-bell'></i></button>`,
    `<button class="top-icon" title="${esc(t("shell.about"))}" aria-label="${esc(t("shell.about"))}" data-act="about"><i class='bi bi-info-circle'></i></button>`,
    `<span class="avatar">R</span><div class="top-name">${esc(t("shell.admin"))}<small>${esc(t("shell.role"))}</small></div>`,
    `</div>`,
    `<main class="content" id="page"></main>`,
    `</div></div>`,
  ].join("");
}
