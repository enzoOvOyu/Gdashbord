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

// 右侧详情抽屉（素材包 drawer 模式：tabs + detail-pairs + terminal）
export function drawer(title, subtitle, bodyHTML, tabsHTML, actionsHTML = "") {
  return `<div class="drawer-overlay" data-drawer-overlay="1"><div class="drawer" role="dialog" aria-modal="true">
    <div class="drawer-head"><div><h2>${esc(L(title))}</h2><p class="mono">${esc(L(subtitle))}</p></div><button class="icon-btn" data-act="drawer-close"><i class="bi bi-x-lg"></i></button></div>
    <div class="drawer-body">
      ${actionsHTML ? `<div class="drawer-actions">${actionsHTML}</div>` : ""}
      ${tabsHTML}
      ${bodyHTML}
    </div>
  </div></div>`;
}

// detail-pairs（抽屉内 KV 双列）
export function detailPairs(pairs) {
  return `<div class="detail-pairs">${pairs.map(([k, v]) => `<div><label>${esc(L(k))}</label><strong>${v}</strong></div>`).join("")}</div>`;
}

// ⌘K 命令面板（素材包 keyboard-modal 模式）
export function commandPanel(items, query) {
  const q = (query || "").toLowerCase();
  const filtered = items.filter((x) => String(x.label).toLowerCase().includes(q) || String(x.keywords || "").toLowerCase().includes(q));
  return `<div class="keyboard-modal" data-overlay="1" data-command-overlay="1"><div class="command-panel">
    <div class="command-search"><i class="bi bi-search"></i><input id="command-input" value="${esc(query || "")}" placeholder="${esc(t("shell.search"))}" autofocus/><span class="tiny-text">ESC</span></div>
    <div class="command-items">${filtered.length ? filtered.map((x, i) => `<button class="command-item${i === 0 ? " active" : ""}" data-act="${x.act}" data-cmd-index="${i}" role="option" aria-selected="${i === 0}"><i class="bi bi-${x.icon}"></i> ${esc(L(x.label))} <i class="bi bi-arrow-right"></i></button>`).join("") : `<div class="empty-state" style="padding:24px">${esc(t("common.none"))}</div>`}</div>
    <div class="command-foot">⌘K · ↑↓ ${esc(L({ zh: "选择", en: "navigate" }))} · ↵ ${esc(L({ zh: "打开", en: "open" }))} · ESC ${esc(L({ zh: "关闭", en: "close" }))}</div>
  </div></div>`;
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

// btn 支持: 字符串 | {zh,en} | { html: "<i></i> ", label: {zh,en} }（图标+文案安全拼接，避免对象被 toString）
export function btn(label, act, cls = "", extra = "") {
  let inner;
  if (label && typeof label === "object" && label.html !== undefined) {
    inner = label.html + L(label.label);
  } else {
    inner = L(label);
  }
  return `<button class="btn ${cls}" data-act="${act}"${extra ? " " + extra : ""}>${inner}</button>`;
}

export function segmented(items, val, path) {
  return `<div class="seg">${items.map((it) => `<button data-set="${path}" data-value="${esc(it[0])}" class="${String(it[0]) === String(val) ? "active" : ""}">${esc(L(it[1]))}</button>`).join("")}</div>`;
}

export function tabs(items, val, path) {
  return `<div class="tabs">${items.map((it) => `<button class="tab ${String(it[0]) === String(val) ? "active" : ""}" data-set="${path}" data-value="${esc(it[0])}">${esc(L(it[1]))}</button>`).join("")}</div>`;
}

// 时序 X 轴标签：按 range 从当前时间往前均匀分布 n 个点。
// 原图表只写死"期初 / 期末"两个文字，无法判断时间点，这里补上真实刻度。
export function timeAxis(n, range = "1h") {
  const count = Math.max(2, Number(n) || 2);
  const spanMs = range === "30d" ? 30 * 864e5
    : range === "7d" ? 7 * 864e5
    : range === "24h" ? 864e5
    : 36e5;
  const now = Date.now();
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = new Date(now - spanMs * (1 - i / (count - 1)));
    const hh = String(t.getHours()).padStart(2, "0");
    const mm = String(t.getMinutes()).padStart(2, "0");
    out.push(range === "7d" || range === "30d"
      ? `${t.getMonth() + 1}/${t.getDate()}`
      : `${hh}:${mm}`);
  }
  return out;
}

// 数值紧凑格式（坐标轴刻度用）：1.2K / 3.4M / 5.6B
function fmtNum(v, digits = 0) {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(Math.max(1, digits)) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(Math.max(1, digits)) + "M";
  if (abs >= 1e4) return (n / 1e3).toFixed(Math.max(0, digits)) + "K";
  return n.toFixed(digits);
}

// 折线 / 面积图：带 Y 轴刻度、X 轴标签与 hover 数值提示
// 说明：SVG 用 preserveAspectRatio="none" 横向自适应，因此所有文字改由 HTML 层渲染，
//       避免横向拉伸变形；线宽用 vector-effect="non-scaling-stroke" 保持恒定。
// options: { color, color2, second, height, grid, labels, startText, endText, xLabels, unit, digits, fill, ariaLabel }
export function chart(data, options = {}) {
  const color = options.color || "#ff6000";
  const color2 = options.color2 || "#34383b";
  const second = options.second || null;
  const height = options.height || 190;
  const grid = options.grid || 4;
  const unit = options.unit || "";
  const digits = options.digits != null ? options.digits : 0;
  const showLabels = options.labels !== false;
  const fill = options.fill !== false;
  const xLabels = options.xLabels || null;
  const startText = options.startText || (xLabels && xLabels[0]) || t("ep.chart.start");
  const endText = options.endText || (xLabels && xLabels[xLabels.length - 1]) || t("ep.chart.end");
  const xAxisH = showLabels ? 20 : 0;
  const w = 700, h = Math.max(60, height - xAxisH), pad = 16, top = 13, bottom = 10;
  const all = second ? data.concat(second) : data;
  const max = Math.max(1, ...all) * 1.18, min = 0;
  const n = Math.max(1, (data.length || 1) - 1);
  const xx = (i) => pad + (w - 2 * pad) * (i / n);
  const yy = (v) => top + (h - top - bottom) * (1 - (v - min) / (max - min));
  const line = (arr) => arr.map((v, i) => (i ? "L" : "M") + xx(i).toFixed(1) + "," + yy(v).toFixed(1)).join(" ");
  const area = line(data) + " L " + xx(n).toFixed(1) + "," + (h - bottom) + " L " + pad + "," + (h - bottom) + " Z";
  const gid = "g" + color.replace("#", "");
  const gridLines = Array.from({ length: grid + 1 }, (_, i) => {
    const y = top + (h - top - bottom) * (i / grid);
    return `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="#eceff1" stroke-dasharray="3 4"/>`;
  }).join("");
  // Y 轴刻度：自上而下（含 0 基线）；垂直方向 viewBox 与像素 1:1，故可直接用 px 定位
  const yTicks = Array.from({ length: grid + 1 }, (_, i) => {
    const v = max * (1 - i / grid);
    const y = top + (h - top - bottom) * (i / grid);
    return `<i style="top:${y.toFixed(1)}px">${esc(fmtNum(v, digits))}${esc(unit)}</i>`;
  }).join("");
  const midText = xLabels && xLabels.length > 2 ? xLabels[Math.floor((xLabels.length - 1) / 2)] : null;
  const xAxis = showLabels
    ? `<div class="chart-xaxis"><span>${esc(L(startText))}</span>${midText ? `<span>${esc(L(midText))}</span>` : ""}<span>${esc(L(endText))}</span></div>`
    : "";
  const meta = JSON.stringify({
    v: data.map((x) => Number(x) || 0),
    s: second ? second.map((x) => Number(x) || 0) : null,
    x: xLabels || [],
    u: unit,
    d: digits,
  });
  return [
    `<div class="chart-wrap" style="height:${height}px" data-chart='${meta}' role="img" aria-label="${esc(options.ariaLabel || "trend")}">`,
    `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="chart" style="height:${h}px" aria-hidden="true">`,
    `<defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop stop-color="${color}" stop-opacity=".16"/><stop offset="1" stop-color="${color}" stop-opacity=".01"/></linearGradient></defs>`,
    gridLines,
    fill ? `<path d="${area}" fill="url(#${gid})"/>` : "",
    `<path d="${line(data)}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`,
    second ? `<path d="${line(second)}" fill="none" stroke="${color2}" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` : "",
    "</svg>",
    `<div class="chart-yaxis">${yTicks}</div>`,
    xAxis,
    `<div class="chart-cursor"><div class="chart-tip"></div><i></i></div>`,
    "</div>",
  ].join("");
}

// 图表 hover / 触摸游标：事件委托，避免每次重渲重新绑定
const CHART_VB_W = 700;
const CHART_PAD = 16;
const chartCache = new WeakMap();

function chartMeta(el) {
  if (!chartCache.has(el)) {
    try { chartCache.set(el, JSON.parse(el.dataset.chart || "{}")); } catch (e) { chartCache.set(el, { v: [] }); }
  }
  return chartCache.get(el);
}

let chartActive = null;

function hideChartCursor() {
  if (chartActive) { chartActive.classList.remove("on"); chartActive = null; }
}

function paintChartCursor(wrap, clientX) {
  const m = chartMeta(wrap);
  const vals = m.v || [];
  if (!vals.length) return;
  const svg = wrap.querySelector("svg");
  const rect = (svg || wrap).getBoundingClientRect();
  const sx = rect.width / CHART_VB_W;
  const pad = CHART_PAD * sx;
  const plotW = Math.max(1, rect.width - pad * 2);
  const n = Math.max(1, vals.length - 1);
  const i = Math.max(0, Math.min(n, Math.round(((clientX - rect.left - pad) / plotW) * n)));
  const cursor = wrap.querySelector(".chart-cursor");
  if (!cursor) return;
  const vbH = svg ? Number(String(svg.getAttribute("viewBox")).split(" ")[3]) || 0 : 0;
  const top = 13, bottom = 10, plotH = Math.max(1, vbH - top - bottom);
  const maxV = Math.max(1, ...(m.s ? vals.concat(m.s) : vals)) * 1.18;
  const y = top + plotH * (1 - (vals[i] || 0) / maxV);
  cursor.style.left = (pad + plotW * (i / n)).toFixed(1) + "px";
  cursor.classList.add("on");
  const dot = cursor.querySelector("i");
  if (dot) dot.style.top = y.toFixed(1) + "px";
  const tip = cursor.querySelector(".chart-tip");
  if (tip) {
    const label = m.x && m.x[i] ? L(m.x[i]) : "";
    const v = Number(vals[i] || 0).toLocaleString("en-US", { minimumFractionDigits: m.d || 0, maximumFractionDigits: m.d || 0 });
    tip.textContent = (label ? label + " · " : "") + v + (m.u || "");
    tip.classList.toggle("below", y < 48);
  }
  if (chartActive && chartActive !== cursor) chartActive.classList.remove("on");
  chartActive = cursor;
}

export function initChartCursor() {
  let raf = 0, pending = null;
  const apply = () => { raf = 0; if (pending) paintChartCursor(pending.wrap, pending.x); };
  document.addEventListener("mousemove", (e) => {
    const wrap = e.target.closest && e.target.closest(".chart-wrap");
    if (!wrap) { pending = null; hideChartCursor(); return; }
    pending = { wrap, x: e.clientX };
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
  document.addEventListener("mouseleave", hideChartCursor);
  document.addEventListener("touchmove", (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    const wrap = e.target.closest && e.target.closest(".chart-wrap");
    if (wrap) paintChartCursor(wrap, t.clientX);
  }, { passive: true });
}

// 高危操作二次确认（统一入口，避免删库级操作无提示）
export function confirmAction(title, bodyHTML, confirmAct, confirmLabel, danger = true) {
  modal(title, bodyHTML, btn(t("common.cancel"), "close-modal") + btn(confirmLabel, confirmAct, danger ? "danger" : "primary"));
}

// 分页控件：大数据量列表统一分页，避免一次性渲染上千节点
export function pager(page, totalPages, path, total, pageSize) {
  if (totalPages <= 1) return "";
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const prev = page > 1 ? btn(`<i class='bi bi-chevron-left'></i> ${esc(L({ zh: "上一页", en: "Prev" }))}`, `${path}:${page - 1}`, "sm ghost")
    : `<button class="btn sm ghost" disabled><i class='bi bi-chevron-left'></i> ${esc(L({ zh: "上一页", en: "Prev" }))}</button>`;
  const next = page < totalPages ? btn(`${esc(L({ zh: "下一页", en: "Next" }))} <i class='bi bi-chevron-right'></i>`, `${path}:${page + 1}`, "sm ghost")
    : `<button class="btn sm ghost" disabled>${esc(L({ zh: "下一页", en: "Next" }))} <i class='bi bi-chevron-right'></i></button>`;
  return `<div class="pager"><span class="small muted">${from}–${to} / ${total} · ${esc(L({ zh: "第", en: "Page" }))} ${page}/${totalPages}</span><div class="row gap8">${prev}${next}</div></div>`;
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
