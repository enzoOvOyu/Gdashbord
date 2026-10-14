// GPU 算力市场 — 按新版素材包设计重构：
// 卡片 = head(类型标签+库存状态) → identity(大型号名) → metrics 2×2(显存/互联/计算特性/区域)
//        → scenarios 场景标签 → bottom(价格 + 详情/选择配置按钮)
import { api } from "../api.js";
import { header, metric, section, btn, esc, money, opt, t, L } from "../ui.js";

const B = (zh, en) => ({ zh, en });

// 型号定位标签（对齐素材包 gpu-tag：类型 + 颜色）
const GPU_TAG = {
  H100: { tag: B("主力通用", "Workhorse"), color: "blue" },
  H200: { tag: B("长上下文", "Long-context"), color: "green" },
  B200: { tag: B("旗舰训练", "Flagship"), color: "purple" },
  B300: { tag: B("Blackwell Ultra", "Blackwell Ultra"), color: "purple" },
  GB300: { tag: B("机架级 NVL72", "Rack-scale NVL72"), color: "gold" },
};
// 计算特性（按架构）
const COMPUTE = {
  H100: B("FP8 1.98 PFLOPS · Transformer Engine", "FP8 1.98 PFLOPS · Transformer Engine"),
  H200: B("FP8 1.98 PFLOPS · 4.9 TB/s HBM3e", "FP8 1.98 PFLOPS · 4.9 TB/s HBM3e"),
  B200: B("FP8 4.5 PFLOPS · FP4 9 PFLOPS", "FP8 4.5 PFLOPS · FP4 9 PFLOPS"),
  B300: B("FP8 7.2 PFLOPS · 288 GB HBM3e", "FP8 7.2 PFLOPS · 288 GB HBM3e"),
  GB300: B("FP8 14.4 PFLOPS · NVL72 整机架", "FP8 14.4 PFLOPS · NVL72 full rack"),
};
// 适配场景（对齐素材包 scenarios）
const SCENARIOS = {
  H100: [B("LLM 微调", "LLM fine-tune"), B("推理服务", "Inference"), B("数据处理", "Data processing")],
  H200: [B("长上下文推理", "Long-context serving"), B("大显存微调", "Large-VRAM tune"), B("RAG", "RAG")],
  B200: [B("万亿参数预训练", "Trillion-param pretrain"), B("分布式训练", "Distributed training")],
  B300: [B("超大 MoE 训练", "Massive MoE"), B("高密度推理", "Dense inference")],
  GB300: [B("NVL72 整机训练", "NVL72 rack training"), B("MoE 工厂", "MoE factory")],
};

export default async function market(S) {
  const m = S.market;
  const res = await api.market({ query: m.query, gpu: m.gpu, region: m.region, sort: m.sort });
  const gpus = res.gpus || [];
  const regions = res.regions || [];
  const totalAvail = gpus.reduce((a, g) => a + (g.available || 0), 0);

  const cards = gpus.map((g) => {
    const tag = GPU_TAG[g.id] || { tag: B("通用", "General"), color: "blue" };
    const availCls = (g.available || 0) < 50 ? "low" : "";
    const availText = g.available > 0
      ? B(`可部署 · ${g.available.toLocaleString()} 卡`, `Deployable · ${g.available.toLocaleString()} GPUs`)
      : B("暂不可用", "Out of stock");
    const cmp = COMPUTE[g.id] || { zh: "—", en: "—" };
    const scen = SCENARIOS[g.id] || [];
    return `
    <article class="gpu-card2 mk-card">
      <div class="mk-card-head">
        <span class="mk-tag ${tag.color}">${esc(L(tag.tag))}</span>
        <span class="mk-avail ${availCls}">${esc(L(availText))}</span>
      </div>
      <div class="mk-identity">
        <div class="mk-mark"><i class="bi bi-gpu-card"></i></div>
        <div class="mk-name">${esc(g.id)}<small>${esc(g.arch)} · ${esc(g.network)}</small></div>
      </div>
      <div class="mk-metrics">
        <div class="mk-metric"><i class="bi bi-memory"></i><div><label>${esc(B("GPU 显存", "GPU memory"))}</label><b>${g.vram} GB HBM</b></div></div>
        <div class="mk-metric"><i class="bi bi-diagram-3"></i><div><label>${esc(B("高速互联", "Interconnect"))}</label><b>${esc(g.network)}</b></div></div>
        <div class="mk-metric"><i class="bi bi-cpu"></i><div><label>${esc(B("计算特性", "Compute"))}</label><b>${esc(L(cmp))}</b></div></div>
        <div class="mk-metric"><i class="bi bi-globe"></i><div><label>${esc(B("可选区域", "Regions"))}</label><b>${regions.length} ${esc(B("个部署区域", "regions"))}</b></div></div>
      </div>
      <div class="mk-scenarios">${scen.map((s) => `<span class="mk-scenario">${esc(L(s))}</span>`).join("")}</div>
      <div class="mk-bottom">
        <div>
          <div class="mk-price-label">${esc(B("按量价格", "On-demand"))}</div>
          <div class="mk-price">$${g.price.toFixed(2)}<small>/ GPU·h</small></div>
        </div>
        <div class="mk-buttons">
          ${btn(B("详情", "Details"), "gpu:" + g.id, "sm")}
          ${g.available > 0 ? btn(B("选择配置 →", "Configure →"), "choose-gpu:" + g.id, "sm primary") : `<span class="pill gray">${esc(B("暂不可用", "Out of stock"))}</span>`}
        </div>
      </div>
    </article>`;
  }).join("");

  return [
    header("mk.title", "mk.sub", btn("mk.cta", "go-create", "primary")),

    // KPI：机队视角
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric(B("可分配 GPU", "Available GPUs"), totalAvail.toLocaleString(), B("机队调度器实时库存", "Live inventory from the fleet scheduler"), "<i class='bi bi-cpu'></i>", "", "hero"),
    metric(B("GPU 型号", "GPU types"), gpus.length, B("H100 – GB300 全系覆盖", "H100 through GB300"), "<i class='bi bi-collection'></i>", "", ""),
    metric(B("价格区间", "Price range"), gpus.length ? "$" + Math.min(...gpus.map(g => g.price)).toFixed(2) + " – $" + Math.max(...gpus.map(g => g.price)).toFixed(2) : "—", B("按需时价 / 卡·小时", "On-demand per GPU·h"), "<i class='bi bi-cash-stack'></i>", "", ""),
    metric(B("部署区域", "Regions"), regions.length, B("日本 · 泰国 · 美国", "Japan · Thailand · USA"), "<i class='bi bi-globe'></i>", "", ""),
    `</div>`,

    // 排序 tabs（素材包 market-tabs 下划线式）
    `<div class="market-tabs">`,
    [[B("推荐排序", "Recommended"), "recommended"], [B("低价优先", "Price ↑"), "price"], [B("大显存", "VRAM ↑"), "vram"]].map((x) =>
      `<button class="market-tab ${m.sort === x[1] ? "active" : ""}" data-set="market.sort" data-value="${x[1]}">${esc(L(x[0]))}</button>`).join(""),
    `</div>`,

    // 筛选工具条
    `<div class="mk-toolbar">`,
    `<div class="search-field"><i class="bi bi-search"></i><input value="${esc(m.query)}" data-set="market.query" placeholder="${esc(B("搜索 GPU 型号…", "Search GPU models…"))}"/></div>`,
    `<select class="field select" data-set="market.region">${opt([["all", B("全部区域", "All regions")], ...regions.map((r) => [r.id, r.name])], m.region)}</select>`,
    `<select class="field select" data-set="market.gpu">${opt([["all", B("全部型号", "All GPUs")], ...(S.GPU || []).map((g) => [g.id, g.id])], m.gpu)}</select>`,
    `<span class="results-label">${gpus.length} ${esc(B("个型号", "types"))} · ${totalAvail.toLocaleString()} ${esc(B("卡可分配", "GPUs available"))}</span>`,
    `</div>`,

    // 卡片网格（双列，素材包布局）
    gpus.length
      ? `<div class="mk-grid">${cards}</div>`
      : `<div class="empty-state"><div class="empty-icon"><i class="bi bi-search"></i></div><h3>${esc(B("没有符合条件的 GPU", "No GPUs match"))}</h3><p>${esc(B("调整显存、价格或区域筛选条件。", "Adjust VRAM, price or region filters."))}</p></div>`,
  ].join("");
}
