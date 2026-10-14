// UI 组件：渲染函数集合（USD 计价 + 中英双语）
import { S } from "./store.js";
import { t, L, statusText } from "./i18n.js";

export const $ = (sel) => document.querySelector(sel);

const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "’": "&#39;", "‘": "&#39;" };

// 转义：若传入服务端 { zh, en } 双语对象，先按当前语言解析
export function esc(s) {
  return String(L(s) ?? "").replace(/[&<>"’‘]/g, (c) => ESC_MAP[c]);
}

// 金额统一以美元（USD）计价
export function money(n, digits = 2) {
  const v = Number(n || 0);
  return "$ " + v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// 紧凑金额（用于大数 KPI）
export function moneyShort(n) {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000000) return "$ " + (v / 1000000).toFixed(2) + "M";
  if (Math.abs(v) >= 10000) return "$ " + (v / 1000).toFixed(1) + "K";
  return money(v);
}

export function gpu(id) {
  return (S.GPU || []).find((x) => x.id === id) || (S.GPU || [])[0] || { id: id, name: id, vram: 0, price: 0, network: "—", stock: {} };
}

export function regionById(id) {
  return (S.REGIONS || []).find((x) => x.id === id) || { id: id, name: { zh: id, en: id } };
}

const STATUS_COLOR = {
  running: "green", stopped: "gray", starting: "blue", error: "red",
  healthy: "green", "scaled-zero": "gray", completed: "green",
  queued: "amber", failed: "red", warning: "amber", success: "green", info: "blue",
  pending: "amber", provisioning: "blue", terminating: "gray",
  active: "green", suspended: "gray", invited: "blue", resolved: "green",
  open: "amber", degraded: "amber", maintenance: "blue",
};

export function status(st) {
  const color = STATUS_COLOR[st] || "gray";
  return `<span class="pill ${color}"><i class="dot"></i>${esc(statusText(st))}</span>`;
}

export function toast(text, kind = "ok") {
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = L(text);
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 3300);
}

export function modal(title, body, actions = "") {
  $("#modal-root").innerHTML = `<div class="overlay" data-overlay="1"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>${esc(L(title))}</h2><button class="btn sm" data-act="close-modal"><i class='bi bi-x-lg'></i></button></div><div class="modal-body">${body}</div>${actions ? `<div class="modal-foot">${actions}</div>` : ""}</div></div>`;
}

export function closeModal() {
  $("#modal-root").innerHTML = "";
}

export function copy(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast(t("common.copy") + " ✓")).catch(() => toast({ zh: "请手动复制内容", en: "Please copy manually" }, "err"));
  } else {
    modal({ zh: "复制内容", en: "Copy content" }, `<div class="code">${esc(text)}</div>`, btn(t("common.close"), "close-modal"));
  }
}

export function header(title, sub, buttons = "") {
  return `<div class="pagehead"><div><div class="eyebrow">RUNSUN CLOUD / THE GPU CLOUD</div><h1>${esc(L(title))}</h1><p>${esc(L(sub))}</p></div><div class="head-actions">${buttons}</div></div>`;
}

// 统计卡（素材包 stat-card 模式）
export function metric(label, value, desc, icon = "<i class='bi bi-dot'></i>", trend = "", cls = "") {
  const trendCls = /^↓|^\−/.test(String(trend)) ? "down" : "";
  return `<div class="card metric ${cls}"><div class="metric-top"><span>${esc(L(label))}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-bottom"><span>${esc(L(desc))}</span>${trend ? `<span class="trend ${trendCls}">${trend}</span>` : ""}</div></div>`;
}

export function section(title, right = "") {
  return `<div class="section-title"><h2>${esc(L(title))}</h2>${right}</div>`;
}

export function field(label, control) {
  return `<div class="field"><label>${esc(L(label))}</label>${control}</div>`;
}

export function input(value, path, type = "text", extra = "") {
  return `<input type="${type}" value="${esc(value)}" data-set="${path}" ${extra}>`;
}

export function opt(items, val) {
  return items.map((it) => `<option value="${esc(it[0])}" ${String(it[0]) === String(val) ? "selected" : ""}>${esc(L(it[1]))}</option>`).join("");
}

export function select(items, val, path) {
  return `<select data-set="${path}">${opt(items, val)}</select>`;
}

export function btn(label, act, cls = "") {
  return `<button class="btn ${cls}" data-act="${act}">${L(label)}</button>`;
}

export function segmented(items, val, path) {
  return `<div class="seg">${items.map((it) => `<button data-set="${path}" data-value="${esc(it[0])}" class="${String(it[0]) === String(val) ? "active" : ""}">${esc(L(it[1]))}</button>`).join("")}</div>`;
}

export function tabs(items, val, path) {
  return `<div class="tabs">${items.map((it) => `<button class="tab ${String(it[0]) === String(val) ? "active" : ""}" data-set="${path}" data-value="${esc(it[0])}">${esc(L(it[1]))}</button>`).join("")}</div>`;
}

export function chart(data, options = {}) {
  const color = options.color || "#ff6000";
  const color2 = options.color2 || "#34383b";
  const second = options.second || null;
  const height = options.height || 190;
  const grid = options.grid || 4;
  const showLabels = options.labels !== false;
  const fill = options.fill !== false;
  const startText = options.startText || t("ep.chart.start");
  const endText = options.endText || t("ep.chart.end");
  const w = 700, h = height, pad = 16, top = 13, bottom = showLabels ? 22 : 10;
  const all = second ? data.concat(second) : data;
  const max = Math.max(1, ...all) * 1.18, min = 0;
  const xx = (i) => pad + (w - 2 * pad) * (i / (data.length - 1 || 1));
  const yy = (v) => top + (h - top - bottom) * (1 - (v - min) / (max - min));
  const line = (arr) => arr.map((v, i) => (i ? "L" : "M") + xx(i).toFixed(1) + "," + yy(v).toFixed(1)).join(" ");
  const area = line(data) + " L " + xx(data.length - 1) + "," + (h - bottom) + " L " + pad + "," + (h - bottom) + " Z";
  const gridLines = Array.from({ length: grid + 1 }, (_, i) => {
    const y = top + (h - top - bottom) * (i / grid);
    return `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="#eceff1" stroke-dasharray="3 4"/>`;
  }).join("");
  const gid = "g" + color.replace("#", "");
  const labels = showLabels
    ? `<text x="${pad}" y="${h - 3}" fill="#98a0a6" font-size="11">${esc(startText)}</text><text x="${w - pad}" y="${h - 3}" fill="#98a0a6" font-size="11" text-anchor="end">${esc(endText)}</text>`
    : "";
  return [
    `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="chart" style="height:${height}px" role="img" aria-label="trend">`,
    `<defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop stop-color="${color}" stop-opacity=".16"/><stop offset="1" stop-color="${color}" stop-opacity=".01"/></linearGradient></defs>`,
    gridLines,
    fill ? `<path d="${area}" fill="url(#${gid})"/>` : "",
    `<path d="${line(data)}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    second ? `<path d="${line(second)}" fill="none" stroke="${color2}" stroke-width="2" stroke-linecap="round"/>` : "",
    labels,
    "</svg>",
  ].join("");
}

// 统一 Loading 骨架屏
export function skeleton() {
  return [
    '<div class="skel">',
    '<div class="skel-line" style="width:180px"></div>',
    '<div class="skel-line" style="width:320px;height:22px"></div>',
    '<div class="skel-row">',
    '<div class="skel-block"></div><div class="skel-block"></div><div class="skel-block"></div><div class="skel-block"></div>',
    "</div>",
    '<div class="skel-panel"></div>',
    "</div>",
  ].join("");
}

export function series(seed = 1, base = 50, amp = 20, n = 35) {
  return Array.from({ length: n }, (_, i) => Math.max(0, base + Math.sin(i * 0.55 + seed) * amp * 0.55 + Math.cos(i * 0.23 + seed) * amp * 0.45 + Math.sin(i * 2.1 + seed) * amp * 0.15));
}

export { t, L };
