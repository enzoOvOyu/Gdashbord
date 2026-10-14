// GPU 算力市场：区域限定 JP/TH/US，USD 计价
import { api } from "../api.js";
import { header, metric, section, btn, esc, money, opt, t, L, gpu } from "../ui.js";

export default async function market(S) {
  const m = S.market;
  const res = await api.market({ query: m.query, gpu: m.gpu, region: m.region, sort: m.sort });
  const gpus = res.gpus || [];
  const regions = res.regions || [];
  const minPrice = Math.min(...gpus.map((g) => g.price).concat([0]));

  return [
    header("mk.title", "mk.sub", btn("mk.cta", "go-create", "primary")),
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric("mk.kpi.pool", gpus.reduce((a, g) => a + (g.available || 0), 0).toLocaleString(), "mk.kpi.pool.desc", "<i class='bi bi-cpu'></i>", esc(t("common.demo")), "hero",
      { data: [55, 60, 58, 65, 70, 68, 75, 80, 78, 85, 90, 95], color: "#ff6000" }),
    metric("mk.kpi.start", money(minPrice || 0) + " /h", "mk.kpi.start.desc", "<i class='bi bi-box-seam'></i>", "USD", "",
      { data: [100, 96, 92, 88, 90, 85, 82, 80, 78, 75, 73, 70], color: "#17a76f" }),
    metric("mk.kpi.net", "400–800G", "mk.kpi.net.desc", "<i class='bi bi-diagram-3'></i>", "RDMA / NVLink", "",
      { data: [70, 72, 75, 78, 80, 82, 84, 86, 88, 90, 92, 95], color: "#f9a825" }),
    metric("mk.kpi.delivery", "4", "mk.kpi.delivery.desc", "<i class='bi bi-lightning-charge-fill'></i>", "", "",
      { data: [25, 35, 30, 45, 40, 55, 50, 65, 60, 75, 70, 85], color: "#ff6000" }),
    `</div>`,
    `<div class="card filterbar mb16">`,
    `<input placeholder="${esc(t("mk.filter.query"))}" value="${esc(m.query)}" data-set="market.query"/>`,
    `<select data-set="market.gpu">${opt([["all", "mk.filter.gpu"], ...(S.GPU || []).map((g) => [g.id, g.id])], m.gpu)}</select>`,
    `<select data-set="market.region">${opt([["all", "mk.filter.region"], ...regions.map((r) => [r.id, r.name])], m.region)}</select>`,
    `<select data-set="market.mode">${opt([["all", "mk.filter.mode"], ["workspace", "cr.mode.workspace"], ["endpoint", "cr.mode.endpoint"], ["job", "cr.mode.job"], ["cluster", "cr.mode.cluster"]], m.mode)}</select>`,
    `<select data-set="market.sort">${opt([["recommended", "mk.filter.sort"], ["price", "mk.sort.price"], ["vram", "mk.sort.vram"]], m.sort)}</select>`,
    btn("common.reset", "reset-market", "sm"),
    `</div>`,
    `<div class="layout-main-side">`,
    `<div>${section(t("mk.list") + " · " + gpus.length + " " + t("mk.list.unit"), `<span class="small muted">${esc(t("mk.list.note"))}</span>`)}`,
    gpus.length
      ? gpus.map((g) => `<div class="card gpu-card"><div class="gpu-art"><i class='bi bi-gpu-card'></i></div><div><div class="gpu-name">${esc(g.name)}</div><div class="gpu-desc">${esc(L(g.tag))}${g.region ? " · " + esc(g.region) : ""}</div><div class="chiprow"><span class="tag">${esc(L(g.badge))}</span><span class="tag">${g.available} ${esc(t("mk.card.stock"))}</span><span class="tag">${esc(g.arch)}</span></div><div class="gpu-foot">${esc(t("mk.card.score"))} ${g.score}/100 · ${esc(t("mk.card.mode"))} Pod / Job / API</div></div><div><div class="spec-grid"><div>${esc(t("mk.card.vram"))}<b>${g.vram} GB / ${esc(t("mk.card.perGpu"))}</b></div><div>${esc(t("mk.card.cpu"))}<b>${g.cpu} ${esc(t("mk.card.cores"))} / ${g.ram} GB</b></div><div>${esc(t("mk.card.storage"))}<b>${esc(g.storage)}</b></div><div>${esc(t("mk.card.net"))}<b>${esc(g.network)}</b></div><div>${esc(t("cr.gpu.meta.compute"))}<b>${(g.fp8 / 1000).toFixed(1)} PFLOPS</b></div><div>${esc(t("mk.card.sched"))}<b style="color:#16aa79">● ${g.available > 0 ? esc(t("mk.card.sched")) : esc(t("cr.gpu.soldout"))}</b></div></div></div><div class="gpu-right"><div class="price">${money(g.price)}<small> / ${esc(t("common.perGpuHour"))}</small></div><div class="small muted">${esc(t("common.spot"))} ${money(g.spot)} · ${esc(t("common.reserved"))} ${money(g.reserved)}</div><div>${btn("common.detail", "gpu:" + g.id, "sm")}${btn("mk.card.deploy", "choose-gpu:" + g.id, "sm primary")}</div></div></div>`).join("")
      : `<div class="card empty">${esc(t("mk.empty"))}</div>`,
    `</div>`,
    `<div><div class="card card-pad sticky">${section("mk.side.title")}`,
    `<div class="callout">${esc(t("mk.side.tip"))}</div>`,
    [["mk.side.dev", "mk.side.dev.desc", "workspace", "<i class='bi bi-terminal'></i>"], ["mk.side.infer", "mk.side.infer.desc", "endpoint", "<i class='bi bi-lightning-charge-fill'></i>"], ["mk.side.train", "mk.side.train.desc", "job", "<i class='bi bi-cpu'></i>"], ["mk.side.cluster", "mk.side.cluster.desc", "cluster", "<i class='bi bi-hdd-rack'></i>"]]
      .map((x) => `<div class="quick-card" style="padding:13px 0;border-bottom:1px solid #edf1f7" data-nav="create" data-mode="${x[2]}"><div class="quick-icon" style="width:34px;height:34px;font-size:16px">${x[3]}</div><div><h3>${esc(t(x[0]))} →</h3><p>${esc(t(x[1]))}</p></div></div>`).join(""),
    `<div class="mt16">${btn("mk.side.cta", "go-create", "primary block")}</div></div></div>`,
    `</div>`,
  ].join("");
}
