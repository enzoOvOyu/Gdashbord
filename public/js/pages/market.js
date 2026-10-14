// GPU 算力市场 — 素材包 Explore Templates / GPU Cloud 融合设计：
// KPI → toolbar(筛选 tabs + select + 搜索) → gpu-grid2 精选卡片网格（规格徽标 + 语义库存色 + 快捷部署）
import { api } from "../api.js";
import { header, metric, section, btn, esc, money, opt, t, L } from "../ui.js";

const B = (zh, en) => ({ zh, en });

export default async function market(S) {
  const m = S.market;
  const res = await api.market({ query: m.query, gpu: m.gpu, region: m.region, sort: m.sort });
  const gpus = res.gpus || [];
  const regions = res.regions || [];
  const minPrice = Math.min(...gpus.map((g) => g.price).concat([0]));
  const totalAvail = gpus.reduce((a, g) => a + (g.available || 0), 0);

  // 库存语义（素材包 availability：High/Medium/Low/Unavailable）
  const availOf = (g) => {
    const n = g.available || 0;
    return n === 0 ? { cls: "none", label: B("无库存", "Unavailable") }
      : n < 50 ? { cls: "low", label: B("紧张", "Low") }
      : n < 300 ? { cls: "", label: B("中等", "Medium") }
      : { cls: "", label: B("充足", "High") };
  };

  const cards = gpus.map((g) => {
    const av = availOf(g);
    return `<button class="gpu-card2 ${g.available > 0 ? "" : "unavailable"}" data-act="${g.available > 0 ? "choose-gpu:" + g.id : "gpu:" + g.id}" aria-label="${esc(g.name)}">
      <div class="g2-top">
        <span class="gpu-badge">${esc(g.id)}</span>
        <span class="pill sm ${g.id === "GB300" || g.id === "B300" ? "purple" : g.id === "B200" ? "blue" : "orange"}">${esc(L(g.badge))}</span>
      </div>
      <div class="g2-vram">${g.vram} GB VRAM · ${g.ram} GB RAM · ${g.cpu} vCPU</div>
      <div class="g2-vram" style="margin-top:4px">${(g.fp8 / 1000).toFixed(1)} PFLOPS · ${esc(g.arch)} · ${esc(g.network)}</div>
      <div class="g2-bottom">
        <div class="g2-price">${money(g.price)}<small>/hr</small></div>
        <span class="availability ${av.cls}">● ${esc(av.label)} · ${g.available.toLocaleString()}</span>
      </div>
    </button>`;
  }).join("");

  return [
    header("mk.title", "mk.sub", btn("mk.cta", "go-create", "primary")),

    `<div class="grid cols-4 mb16 kpi-row">`,
    metric(B("可分配 GPU", "Available GPUs"), totalAvail.toLocaleString(), B("4 区域实时库存", "Live inventory across 4 regions"), "<i class='bi bi-cpu'></i>", "", "hero"),
    metric("mk.kpi.start", money(minPrice || 0) + " /h", "mk.kpi.start.desc", "<i class='bi bi-box-seam'></i>", "USD", ""),
    metric("mk.kpi.net", "400–800G", "mk.kpi.net.desc", "<i class='bi bi-diagram-3'></i>", "RDMA / NVLink", ""),
    metric("mk.kpi.delivery", "4", "mk.kpi.delivery.desc", "<i class='bi bi-lightning-charge-fill'></i>", "", ""),
    `</div>`,

    // 工具条：筛选 + 区域下拉 + 排序 + 搜索（素材包 toolbar 布局）
    `<div class="toolbar">`,
    `<div class="tabs">
      ${[["recommended", B("推荐", "Recommended")], ["price", B("低价优先", "Price")], ["vram", B("大显存", "VRAM")]].map((x) => `
      <button class="tab ${m.sort === x[0] ? "active" : ""}" data-set="market.sort" data-value="${x[0]}">${esc(L(x[1]))}</button>`).join("")}
    </div>`,
    `<select class="field select" data-set="market.region">${opt([["all", "mk.filter.region"], ...regions.map((r) => [r.id, r.name])], m.region)}</select>`,
    `<select class="field select" data-set="market.gpu">${opt([["all", "mk.filter.gpu"], ...(S.GPU || []).map((g) => [g.id, g.id])], m.gpu)}</select>`,
    `<label class="search-field"><i class="bi bi-search"></i><input value="${esc(m.query)}" data-set="market.query" placeholder="${esc(t("mk.filter.query"))}"/></label>`,
    `</div>`,

    // GPU 网格 + 计数
    `<div class="row between mb12"><span class="tiny-text">${gpus.length} ${esc(B("GPU 型号", "GPU types"))} · ${totalAvail.toLocaleString()} ${esc(t("mk.card.stock"))}</span><span class="tiny-text">${esc(t("mk.list.note"))}</span></div>`,
    gpus.length
      ? `<div class="gpu-grid2">${cards}</div>`
      : `<div class="empty-state"><div class="empty-icon"><i class="bi bi-search"></i></div><h3>${esc(t("mk.empty"))}</h3><p>${esc(L(B("调整筛选条件后重试。", "Adjust filters and retry.")))}</p></div>`,

    // 模式快捷入口（素材包 quick-action）
    `<div class="section-head" style="margin-top:24px"><div><div class="card-title">${esc(L(B("快速开始", "Quick actions")))}</div><div class="card-sub">${esc(L(B("选择部署场景直达", "Jump into your next workflow")))}</div></div></div>`,
    `<div class="grid cols-4">`,
    [["workspace", "mk.side.dev", "mk.side.dev.desc", "terminal"],
     ["endpoint", "mk.side.infer", "mk.side.infer.desc", "lightning-charge-fill"],
     ["job", "mk.side.train", "mk.side.train.desc", "cpu"],
     ["cluster", "mk.side.cluster", "mk.side.cluster.desc", "hdd-rack"]]
      .map((x) => `<div class="quick-action" data-nav="create" data-mode="${x[0]}"><span class="quick-icon"><i class="bi bi-${x[3]}"></i></span><span><strong>${esc(t(x[1]))}</strong><small>${esc(t(x[2]))}</small></span><i class="bi bi-chevron-right"></i></div>`).join(""),
    `</div>`,

    `<div class="notice mt16"><i class="bi bi-info-circle"></i> ${esc(L(B(
      "按需 / 抢占 / 预留三种计价在部署中心可选；库存来自机队调度器实时视图。",
      "On-demand / spot / reserved pricing available in the deploy center; inventory from the live fleet scheduler view."
    )))}</div>`,
  ].join("");
}
