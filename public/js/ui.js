// UI 组件：严格对齐原型的渲染函数命名与结构
import { S } from "./store.js";

export const $ = (sel) => document.querySelector(sel);

const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "’": "&#39;", "‘": "&#39;" };

export function esc(s) {
  return String(s ?? "").replace(/[&<>"’‘]/g, (c) => ESC_MAP[c]);
}

export function money(n) {
  return "¥ " + Number(n).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function gpu(id) {
  return (S.GPU || []).find((x) => x.id === id) || (S.GPU || [])[0] || { id: id, name: id, vram: 0, price: 0, network: "—" };
}

const STATUS_MAP = {
  running: ["运行中", "green"], stopped: ["已停止", "gray"], starting: ["启动中", "blue"], error: ["异常", "red"],
  healthy: ["健康", "green"], "scaled-zero": ["已缩至零", "gray"], completed: ["已完成", "green"],
  queued: ["排队中", "amber"], failed: ["失败", "red"], warning: ["告警", "amber"], success: ["成功", "green"], info: ["信息", "blue"],
};

export function status(st) {
  const x = STATUS_MAP[st] || [st, "gray"];
  return `<span class="pill ${x[1]}"><i class="dot"></i>${x[0]}</span>`;
}

export function toast(text, kind = "ok") {
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = text;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 3300);
}

export function modal(title, body, actions = "") {
  $("#modal-root").innerHTML = `<div class="overlay" data-overlay="1"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>${title}</h2><button class="btn sm" data-act="close-modal">✕</button></div><div class="modal-body">${body}</div>${actions ? `<div class="modal-foot">${actions}</div>` : ""}</div></div>`;
}

export function closeModal() {
  $("#modal-root").innerHTML = "";
}

export function copy(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast("已复制到剪贴板")).catch(() => toast("请手动复制内容", "err"));
  } else {
    modal("复制内容", `<div class="code">${esc(text)}</div>`, btn("关闭", "close-modal"));
  }
}

export function header(title, sub, buttons = "") {
  return `<div class="pagehead"><div><div class="eyebrow">NEBULA / AI CLOUD CONSOLE</div><h1>${title}</h1><p>${sub}</p></div><div class="head-actions">${buttons}</div></div>`;
}

export function metric(label, value, desc, icon = "◈", trend = "") {
  return `<div class="card metric"><div class="metric-top"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-bottom"><span>${desc}</span><span class="up">${trend}</span></div></div>`;
}

export function section(title, right = "") {
  return `<div class="section-title"><h2>${title}</h2>${right}</div>`;
}

export function field(label, control) {
  return `<div class="field"><label>${label}</label>${control}</div>`;
}

export function input(value, path, type = "text", extra = "") {
  return `<input type="${type}" value="${esc(value)}" data-set="${path}" ${extra}>`;
}

export function opt(items, val) {
  return items.map((it) => `<option value="${esc(it[0])}" ${String(it[0]) === String(val) ? "selected" : ""}>${esc(it[1])}</option>`).join("");
}

export function select(items, val, path) {
  return `<select data-set="${path}">${opt(items, val)}</select>`;
}

export function btn(label, act, cls = "") {
  return `<button class="btn ${cls}" data-act="${act}">${label}</button>`;
}

export function segmented(items, val, path) {
  return `<div class="seg">${items.map((it) => `<button data-set="${path}" data-value="${esc(it[0])}" class="${String(it[0]) === String(val) ? "active" : ""}">${it[1]}</button>`).join("")}</div>`;
}

export function tabs(items, val, path) {
  return `<div class="tabs">${items.map((it) => `<button class="tab ${String(it[0]) === String(val) ? "active" : ""}" data-set="${path}" data-value="${esc(it[0])}">${it[1]}</button>`).join("")}</div>`;
}

export function chart(data, options = {}) {
  const color = options.color || "#2866f6";
  const color2 = options.color2 || "#10b9b0";
  const second = options.second || null;
  const height = options.height || 190;
  const grid = options.grid || 4;
  const showLabels = options.labels !== false;
  const fill = options.fill !== false;
  const startText = options.startText || "起始";
  const endText = options.endText || "现在";
  const w = 700, h = height, pad = 16, top = 13, bottom = showLabels ? 22 : 10;
  const all = second ? data.concat(second) : data;
  const max = Math.max(1, ...all) * 1.18, min = 0;
  const xx = (i) => pad + (w - 2 * pad) * (i / (data.length - 1 || 1));
  const yy = (v) => top + (h - top - bottom) * (1 - (v - min) / (max - min));
  const line = (arr) => arr.map((v, i) => (i ? "L" : "M") + xx(i).toFixed(1) + "," + yy(v).toFixed(1)).join(" ");
  const area = line(data) + " L " + xx(data.length - 1) + "," + (h - bottom) + " L " + pad + "," + (h - bottom) + " Z";
  const gridLines = Array.from({ length: grid + 1 }, (_, i) => {
    const y = top + (h - top - bottom) * (i / grid);
    return `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="#eaf0f8" stroke-dasharray="4 5"/>`;
  }).join("");
  const gid = "g" + color.replace("#", "");
  const labels = showLabels
    ? `<text x="${pad}" y="${h - 3}" fill="#96a4b7" font-size="11">${startText}</text><text x="${w - pad}" y="${h - 3}" fill="#96a4b7" font-size="11" text-anchor="end">${endText}</text>`
    : "";
  return [
    `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="chart" style="height:${height}px" role="img" aria-label="趋势图">`,
    `<defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop stop-color="${color}" stop-opacity=".21"/><stop offset="1" stop-color="${color}" stop-opacity=".01"/></linearGradient></defs>`,
    gridLines,
    fill ? `<path d="${area}" fill="url(#${gid})"/>` : "",
    `<path d="${line(data)}" fill="none" stroke="${color}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>`,
    second ? `<path d="${line(second)}" fill="none" stroke="${color2}" stroke-width="2.5" stroke-linecap="round"/>` : "",
    labels,
    "</svg>",
  ].join("");
}

export function series(seed = 1, base = 50, amp = 20, n = 35) {
  return Array.from({ length: n }, (_, i) => Math.max(0, base + Math.sin(i * 0.55 + seed) * amp * 0.55 + Math.cos(i * 0.23 + seed) * amp * 0.45 + Math.sin(i * 2.1 + seed) * amp * 0.15));
}
