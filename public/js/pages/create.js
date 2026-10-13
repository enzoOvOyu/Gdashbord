// 部署中心：区域 → GPU 规格两级联动（RunPod 风格），USD 计价，中英双语
import { header, section, btn, field, input, select, esc, money, gpu, status, t, L, tabs } from "../ui.js";

const MODES = [
  ["workspace", "cr.mode.workspace", "cr.mode.workspace.desc"],
  ["endpoint", "cr.mode.endpoint", "cr.mode.endpoint.desc"],
  ["job", "cr.mode.job", "cr.mode.job.desc"],
  ["cluster", "cr.mode.cluster", "cr.mode.cluster.desc"],
];

const STEPS = [
  ["1", "cr.step1", "cr.step1.sub"],
  ["2", "cr.step2", "cr.step2.sub"],
  ["3", "cr.step3", "cr.step3.sub"],
  ["4", "cr.step4", "cr.step4.sub"],
];

const COUNT_OPTS = [1, 2, 4, 8];

function regionPicker(c) {
  const regions = window.__REGIONS || [];
  const gpus = window.__GPU || [];
  return [
    `<div class="card card-pad mb16">${section("cr.region.step", `<span class="small muted">${esc(t("cr.region.hint"))}</span>`)}`,
    `<div class="region-grid mt12">`,
    regions.map((r) => {
      const stock = gpus.reduce((a, g) => a + (g.stock[r.id] || 0), 0);
      const minPrice = Math.min(...gpus.filter((g) => (g.stock[r.id] || 0) > 0).map((g) => g.price).concat([Infinity]));
      const sel = c.region === r.id;
      return `<button class="region-card${sel ? " selected" : ""}" data-act="pick-region:${r.id}" aria-pressed="${sel}">
        <div class="rc-top"><span class="rc-flag">${r.country}</span><b>${esc(L(r.name))}</b>${sel ? `<span class="pill green sm"><i class="dot"></i>${esc(t("cr.selected"))}</span>` : ""}</div>
        <div class="rc-meta">
          <span><i class='bi bi-diagram-3'></i> ${esc(r.tier)}</span>
          <span><i class='bi bi-clock-history'></i> ${esc(L(r.latency))}</span>
          <span><i class='bi bi-lightning-charge'></i> ${esc(r.fabric)}</span>
        </div>
        <div class="rc-foot">
          <span class="rc-stock">${stock} <small>${esc(t("mk.card.stock"))}</small></span>
          <span class="rc-price">${Number.isFinite(minPrice) ? money(minPrice) : "—"}<small>${esc(t("common.perGpuHour"))}</small></span>
        </div>
      </button>`;
    }).join(""),
    `</div></div>`,
  ].join("");
}

function gpuPicker(c) {
  const gpus = window.__GPU || [];
  const kind = c.priceKind || "price";
  return [
    `<div class="card card-pad mb16">${section("cr.gpu.step", `<span class="small muted">${esc(t("cr.gpu.hint"))}</span>`)}`,
    `<div class="seg sm mb12">${[["price", "common.onDemand"], ["spot", "common.spot"], ["reserved", "common.reserved"]]
      .map((x) => `<button data-act="pick-price:${x[0]}" class="${kind === x[0] ? "active" : ""}">${esc(t(x[1]))}</button>`).join("")}</div>`,
    `<div class="gpu-pick-list">`,
    gpus.map((g) => {
      const stock = g.stock[c.region] || 0;
      const sel = c.gpu === g.id;
      const out = stock === 0;
      const unit = g[kind] || g.price;
      return `<button class="gpu-pick${sel ? " selected" : ""}${out ? " disabled" : ""}" data-act="${out ? "none" : "pick-gpu:" + g.id}" aria-pressed="${sel}">
        <div class="gp-main">
          <div class="gp-name">${esc(g.name)}<span class="tag">${esc(L(g.badge))}</span></div>
          <div class="gp-desc">${esc(L(g.tag))}</div>
          <div class="gp-specs">
            <span>${esc(t("cr.gpu.meta.vram"))} <b>${g.vram} GB</b></span>
            <span>${esc(t("cr.gpu.meta.arch"))} <b>${esc(g.arch)}</b></span>
            <span>${esc(t("cr.gpu.meta.cpu"))} <b>${g.cpu}</b></span>
            <span>${esc(t("cr.gpu.meta.ram"))} <b>${g.ram} GB</b></span>
            <span>${esc(t("cr.gpu.meta.net"))} <b>${esc(g.network)}</b></span>
            <span>${esc(t("cr.gpu.meta.compute"))} <b>${(g.fp8 / 1000).toFixed(1)} PF</b></span>
          </div>
        </div>
        <div class="gp-side">
          <div class="gp-price">${money(unit)}<small>${esc(t("common.perGpuHour"))}</small></div>
          <div class="gp-stock${out ? " out" : ""}">${out ? esc(t("cr.gpu.soldout")) : stock + " " + esc(t("mk.card.stock"))}</div>
          <div class="progress sm"><span style="width:${Math.min(100, Math.round((stock / 140) * 100))}%"></span></div>
        </div>
      </button>`;
    }).join(""),
    `</div>`,
    `<div class="form-grid mt16">`,
    field("cr.field.count", `<div class="seg">${COUNT_OPTS.map((v) => `<button data-act="pick-count:${v}" class="${Number(c.count) === v ? "active" : ""}">${v} ${esc(t("cr.field.count.unit"))}</button>`).join("")}</div>`),
    field("cr.field.name", input(c.name, "create.name")),
    `</div>`,
    `</div>`,
  ].join("");
}

function workspaceForm(c) {
  const images = window.__IMAGES || [];
  return [
    `<div class="card card-pad mb16">${section("cr.ws.env")}<div class="option-grid">`,
    images.map((im) => `<div class="option ${c.image === im.id ? "selected" : ""}" data-image="${esc(im.id)}"><span class="sel-dot"></span><b><i class='bi bi-box-seam'></i> ${esc(im.name)}</b><p>${esc(L(im.desc))}</p></div>`).join(""),
    `</div></div>`,
    `<div class="card card-pad mb16">${section("cr.ws.data")}<div class="form-grid">`,
    field("cr.field.dataset", select([["nlp-corpus-v3", "nlp-corpus-v3 · 1.8 TB"], ["vision-dataset", "vision-dataset · 640 GB"], ["pretrain-tokens", "pretrain-tokens · 12.4 TB"], ["none", { zh: "不挂载数据集", en: "No dataset" }]], c.dataset, "create.dataset")),
    field("cr.field.disk", input(c.disk, "create.disk", "number", "min=\"50\" step=\"50\"")),
    field("cr.field.autostop", select([["0", "cr.autostop.off"], ["1", "1 " + t("cr.autostop.h")], ["2", "2 " + t("cr.autostop.h")], ["6", "6 " + t("cr.autostop.h")], ["12", "12 " + t("cr.autostop.h")]], c.autoStop, "create.autoStop")),
    field("cr.ws.cmd", `<input value="/bin/bash" disabled/>`),
    `</div><div class="flex mt16">`,
    `<label class="check-pill"><input type="checkbox" data-check="create.ssh" ${c.ssh ? "checked" : ""}/> ${esc(t("cr.ssh"))}</label>`,
    `<label class="check-pill"><input type="checkbox" data-check="create.jupyter" ${c.jupyter ? "checked" : ""}/> ${esc(t("cr.jupyter"))}</label>`,
    `</div></div>`,
  ].join("");
}

function endpointForm(c) {
  const groups = window.__MODEL_GROUPS || [];
  const engines = window.__ENGINES || [];
  const cur = groups.flatMap((g) => g.models).find((m) => m.id === c.modelId);
  return [
    `<div class="card card-pad mb16">${section("cr.ep.model")}<div class="form-grid">`,
    field("cr.field.model", `<select data-act-pick="model" id="model-picker">${groups.map((g) => `<optgroup label="${esc(L(g.name))}">${g.models.map((m) => `<option value="${esc(m.id)}" ${c.modelId === m.id ? "selected" : ""}>${esc(m.name)} · ${esc(m.params)}</option>`).join("")}</optgroup>`).join("")}</select>`),
    field("cr.field.engine", select(engines.map((e) => [e, e]), c.engine, "create.engine")),
    `</div>`,
    cur ? `<div class="callout mt16"><b>${esc(cur.name)}</b> · ${esc(cur.params)} · ${esc(t("ep.model.ctx"))} ${esc(cur.ctx)} · ${esc(t("ep.model.license"))} ${esc(cur.license)} · ${esc(t("ep.model.vram"))} ${cur.vram ? cur.vram + " GB" : "—"}</div>` : "",
    `<div class="callout mt12">${esc(t("cr.ep.tip"))}</div></div>`,
    `<div class="card card-pad mb16">${section("cr.ep.scale")}<div class="form-grid">`,
    field("cr.field.min", select([0, 1, 2, 3, 4].map((x) => [x, x + " " + t("cr.replica.unit")]), c.minReplicas, "create.minReplicas")),
    field("cr.field.max", select([1, 2, 4, 8, 16].map((x) => [x, x + " " + t("cr.replica.unit")]), c.maxReplicas, "create.maxReplicas")),
    `</div><div class="flex mt16">`,
    `<label class="check-pill"><input type="checkbox" data-check="create.auth" ${c.auth ? "checked" : ""}/> ${esc(t("cr.auth"))}</label>`,
    `<span class="pill green"><i class='bi bi-check2-circle'></i> ${esc(t("cr.scalezero"))}</span><span class="pill blue"><i class='bi bi-check2-circle'></i> ${esc(t("cr.autoscale"))}</span>`,
    `</div></div>`,
  ].join("");
}

function jobForm(c) {
  return [
    `<div class="card card-pad mb16">${section("cr.job.cfg")}<div class="form-grid">`,
    field("cr.field.template", select([["PyTorch DDP", "PyTorch DDP"], ["DeepSpeed ZeRO", "DeepSpeed ZeRO"], ["Ray Train", "Ray Train"], ["Custom Container", { zh: "自定义容器", en: "Custom container" }]], c.jobTemplate, "create.jobTemplate")),
    field("cr.field.epochs", input(c.epochs, "create.epochs", "number", "min=\"1\" max=\"100\"")),
    field("cr.field.dataset", select([["nlp-corpus-v3", "nlp-corpus-v3"], ["vision-dataset", "vision-dataset"], ["pretrain-tokens", "pretrain-tokens"]], c.dataset, "create.dataset")),
    field("cr.field.checkpoint", `<input value="/checkpoints/${esc(c.name)}" disabled/>`),
    `</div><div class="flex mt16">`,
    `<label class="check-pill"><input type="checkbox" data-check="create.spot" ${c.spot ? "checked" : ""}/> ${esc(t("cr.spot"))}</label>`,
    `<span class="pill blue">${esc(t("cr.ckpt.auto"))}</span><span class="pill green">${esc(t("cr.retry"))}</span>`,
    `</div></div>`,
  ].join("");
}

function clusterForm(c) {
  const g = gpu(c.gpu);
  return [
    `<div class="card card-pad mb16">${section("cr.cluster.cfg")}<div class="form-grid">`,
    field("cr.field.nodes", select([1, 2, 4, 8, 16, 32].map((x) => [x, x + " " + t("cr.node.unit")]), c.nodes, "create.nodes")),
    field("cr.field.scheduler", select([["Slurm", "Slurm"], ["Kubernetes", "Kubernetes"]], c.scheduler, "create.scheduler")),
    field("cr.cluster.net", `<input value="${esc(g.network)}" disabled/>`),
    field("cr.cluster.fs", `<input value="training-checkpoints · /checkpoints" disabled/>`),
    `</div><div class="callout mt16">${esc(t("cr.cluster.tip"))}</div></div>`,
  ].join("");
}

export default async function createPage(S) {
  const c = S.create;
  const g = gpu(c.gpu);
  const kind = c.priceKind || "price";
  const unit = g[kind] || g.price;
  const mult = c.mode === "cluster" ? Number(c.nodes) : 1;
  const est = c.mode === "endpoint" ? unit * Number(c.minReplicas) * Number(c.count) : unit * Number(c.count) * mult;
  const totalGpus = c.mode === "endpoint" ? Number(c.count) * Number(c.minReplicas) : Number(c.count) * mult;
  const reg = (window.__REGIONS || []).find((r) => r.id === c.region) || {};

  return [
    header("cr.title", "cr.sub", btn("cr.back", "go-market")),
    `<div class="grid cols-4 mb16">${MODES.map((x) => `<div class="option ${c.mode === x[0] ? "selected" : ""}" data-mode-select="${x[0]}"><span class="sel-dot"></span><b>${esc(t(x[1]))}</b><p>${esc(t(x[2]))}</p></div>`).join("")}</div>`,
    `<div class="steps">${STEPS.map((x, i) => `<div data-step="${i + 1}" style="cursor:pointer" class="step ${c.step === i + 1 ? "active" : c.step > i + 1 ? "done" : ""}"><span class="step-num">${c.step > i + 1 ? "<i class='bi bi-check2-circle'></i>" : x[0]}</span><div><b>${esc(t(x[1]))}</b><small>${esc(t(x[2]))}</small></div></div>`).join("")}</div>`,
    `<div class="layout-wide-side"><div>`,
    c.step === 1
      ? `<div class="card card-pad mb16">${section("cr.intro.title")}<div class="callout mb16">${esc(t("cr.intro"))}</div><div class="grid cols-2">${[["cr.intro.dev", "cr.intro.dev.desc"], ["cr.intro.infer", "cr.intro.infer.desc"], ["cr.intro.train", "cr.intro.train.desc"], ["cr.intro.cluster", "cr.intro.cluster.desc"]].map((x) => `<div class="option"><b>${esc(t(x[0]))}</b><p>${esc(t(x[1]))}</p></div>`).join("")}</div></div>`
      : "",
    c.step === 2
      ? [regionPicker(c), gpuPicker(c)].join("")
      : "",
    c.step === 3 ? (c.mode === "workspace" ? workspaceForm(c) : c.mode === "endpoint" ? endpointForm(c) : c.mode === "job" ? jobForm(c) : clusterForm(c)) : "",
    c.step === 4
      ? `<div class="card card-pad">${section("cr.check.title")}<div class="grid cols-3"><div class="check-pill"><i class='bi bi-check2-circle'></i> ${esc(t("cr.check.image"))}</div><div class="check-pill"><i class='bi bi-check2-circle'></i> ${esc(t("cr.check.region"))}</div><div class="check-pill"><i class='bi bi-check2-circle'></i> ${esc(t("cr.check.budget"))}</div></div><div class="callout warn mt16">${esc(t("cr.check.warn"))}</div></div>`
      : "",
    `</div>`,
    `<div class="card card-pad sticky">${section("cr.summary.title", `<a href="javascript:void(0)" data-act="reset-create">${esc(t("cr.summary.reset"))}</a>`)}`,
    [["cr.summary.mode", t(MODES.find((x) => x[0] === c.mode) ? MODES.find((x) => x[0] === c.mode)[1] : "cr.mode.workspace")],
     ["cr.summary.region", L(reg.name) || c.region],
     ["cr.summary.gpu", g.name],
     ["cr.summary.count", totalGpus + " × " + (c.mode === "cluster" ? Number(c.nodes) + " " + t("cr.node.unit") : "")],
     ["cr.summary.vram", g.vram * totalGpus + " GB"],
     ["common.price", money(unit) + " " + t("common.perGpuHour")],
     ["cr.summary.image", c.mode === "endpoint" ? c.engine : c.image],
     ["cr.summary.data", c.mode === "workspace" ? c.dataset : c.mode === "job" ? "Checkpoint + Dataset" : c.mode === "cluster" ? { zh: "共享存储", en: "Shared storage" } : { zh: "模型缓存卷", en: "Model cache volume" }]]
      .map((x) => `<div class="summary-line"><span>${esc(t(x[0]))}</span><b>${esc(L(x[1]))}</b></div>`).join(""),
    `<div style="margin-top:19px"><div class="between"><span class="muted small">${esc(t("cr.summary.price"))}</span><span class="price">${money(est)}<small> / ${esc(t("common.perHour"))}</small></span></div>`,
    `<div class="between mt12"><span class="muted small">${esc(t("ov.cost.month"))} · 730h</span><b>${money(est * 730)}</b></div>`,
    `<div class="small muted mt12">${esc(t(c.mode === "endpoint" ? "cr.summary.note.ep" : "cr.summary.note"))}</div></div>`,
    `<div class="divider"></div>`,
    c.step === 4
      ? btn(["cr.deploy.ws", "cr.deploy.ep", "cr.deploy.job", "cr.deploy.cluster"][["workspace", "endpoint", "job", "cluster"].indexOf(c.mode)], "deploy", "primary block")
      : btn("common.next", "next-step", "primary block"),
    c.step > 1 ? `<div class="mt12">${btn("common.prev", "prev-step", "block")}</div>` : "",
    `<div class="small muted" style="text-align:center;margin-top:11px">${esc(t("cr.deploy.time"))}</div></div></div>`,
  ].join("");
}
