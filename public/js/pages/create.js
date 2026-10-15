// 部署中心：完全按参考素材包 "Deploy a GPU Pod" 结构重构
// 01 Workload configuration（模板/名称/选项）→ 02 Choose GPU compute（筛选/云类型/地域/搜索/GPU 卡网格）
// → 03 Storage & environment（GPU 数量 counter/磁盘滑块/持久卷滑块）+ 右侧吸顶 Deployment summary
// 万卡级扩展：场景模式（工作空间/推理/训练/集群）、区域→可用区联动、实时库存
import { api } from "../api.js";
import { header, section, btn, esc, money, gpu, t, L } from "../ui.js";

const B = (zh, en) => ({ zh, en });

// 场景模式（扩展素材包的 Pod 单一形态）
const MODES = [
  ["workspace", "cr.mode.workspace", "cr.mode.workspace.desc", "terminal"],
  ["endpoint", "cr.mode.endpoint", "cr.mode.endpoint.desc", "lightning-charge-fill"],
  ["job", "cr.mode.job", "cr.mode.job.desc", "cpu"],
  ["cluster", "cr.mode.cluster", "cr.mode.cluster.desc", "hdd-rack"],
];

// 场景 → GPU 分级映射（与 GPU_TIERS 对应）
const TIER_OF = { H100: "general", H200: "longctx", B200: "frontier", B300: "moe", GB300: "rackscale" };
const SCENARIOS = [
  ["all", B("全部型号", "All models")],
  ["general", B("通用", "General")],
  ["longctx", B("长上下文", "Long-context")],
  ["frontier", B("前沿预训练", "Frontier")],
  ["moe", B("超大 MoE", "Large MoE")],
  ["rackscale", B("机架级 NVL72", "Rack-scale NVL72")],
];

function findRegionCap(cap, regionId) {
  return (cap.regions || []).find((r) => r.region === regionId) || null;
}

// ===== 顶部：场景模式选择条（素材包 quick-action 语义） =====
function modeBar(c) {
  return `<div class="grid cols-4 mb16">${MODES.map((x) => `
    <button class="deploy-mode ${c.mode === x[0] ? "selected" : ""}" data-mode-select="${x[0]}">
      <span class="dm-icon"><i class="bi bi-${x[3]}"></i></span>
      <span><strong>${esc(t(x[1]))}</strong><small>${esc(t(x[2]))}</small></span>
      <i class="bi bi-chevron-right dm-arrow"></i>
    </button>`).join("")}</div>`;
}

// ===== 01 Workload configuration =====
function workloadCard(c) {
  const images = window.__IMAGES || [];
  const groups = window.__MODEL_GROUPS || [];
  const engines = window.__ENGINES || [];
  const im = images.find((x) => x.id === c.image) || images[0] || { name: "—", desc: B("—", "—") };
  const isEndpoint = c.mode === "endpoint";
  const cur = groups.flatMap((g) => g.models).find((m) => m.id === c.modelId);
  return `
  <div class="card form-card">
    <div class="form-head"><span class="step-num">01</span><div><div class="form-title">${esc(B("Workload configuration", "Workload configuration"))}</div><div class="form-desc">${esc(B("选择模板并命名你的工作负载", "Select your template and name your workload"))}</div></div></div>

    ${isEndpoint ? `
    <div class="form-group">
      <label class="form-label">${esc(B("推理模型", "Inference model"))}</label>
      <select class="field select w100" data-act-pick="model" id="model-picker">${groups.map((g) => `<optgroup label="${esc(L(g.name))}">${g.models.map((m) => `<option value="${esc(m.id)}" ${c.modelId === m.id ? "selected" : ""}>${esc(m.name)} · ${esc(m.params)}</option>`).join("")}</optgroup>`).join("")}</select>
      ${cur ? `<div class="notice mt12">${esc(cur.name)} · ${esc(cur.params)} · ctx ${esc(cur.ctx)} · ${cur.vram ? cur.vram + " GB VRAM" : "API Proxy"}</div>` : ""}
    </div>
    <div class="form-group">
      <label class="form-label">${esc(B("推理引擎", "Inference engine"))}</label>
      <select class="field select w100" data-set="create.engine">${engines.map((e) => `<option ${c.engine === e ? "selected" : ""}>${esc(e)}</option>`).join("")}</select>
    </div>
    ` : `
    <div class="form-group">
      <label class="form-label">${esc(B("Pod template", "Pod template"))}</label>
      <div class="template-chooser">
        <div class="row gap12"><div class="template-mark"><i class="bi bi-box-seam"></i></div><div><strong>${esc(im.name)}</strong><small>${esc(L(im.desc))}</small></div></div>
        <button class="btn sm" data-act="pick-scenario:all" style="visibility:hidden"></button>
        <div class="template-picker"><select class="field select" data-set="create.image">${images.map((x) => `<option value="${esc(x.id)}" ${c.image === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
      </div>
    </div>
    `}

    <div class="form-group">
      <label class="form-label" for="podname">${esc(B("Pod name", "Pod name"))}</label>
      <input class="field w100" id="podname" value="${esc(c.name)}" data-set="create.name" placeholder="my-gpu-workspace" maxlength="48"/>
    </div>

    ${c.mode === "job" ? `
    <div class="form-row">
      <div class="form-group"><label class="form-label">${esc(B("训练框架", "Training framework"))}</label>
        <select class="field select w100" data-set="create.jobTemplate">${["PyTorch DDP", "DeepSpeed ZeRO", "Ray Train", "Custom Container"].map((x) => `<option ${c.jobTemplate === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
      <div class="form-group"><label class="form-label">${esc(B("数据集", "Dataset"))}</label>
        <select class="field select w100" data-set="create.dataset">${["nlp-corpus-v3", "vision-dataset", "pretrain-tokens"].map((x) => `<option ${c.dataset === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
    </div>
    ` : ""}

    <div class="option-row">
      <label class="check-line"><input type="checkbox" data-check="create.jupyter" ${c.jupyter ? "checked" : ""}/> ${esc(B("启动 Jupyter Notebook", "Start Jupyter Notebook"))}</label>
      <label class="check-line"><input type="checkbox" data-check="create.ssh" ${c.ssh ? "checked" : ""}/> ${esc(B("SSH 终端访问", "SSH terminal access"))}</label>
      ${c.mode === "job" ? `<label class="check-line"><input type="checkbox" data-check="create.spot" ${c.spot ? "checked" : ""}/> ${esc(B("使用抢占式实例", "Use spot instances"))}</label>` : ""}
    </div>
  </div>`;
}

// ===== 02 Choose GPU compute =====
function computeCard(c, cap) {
  const gpus = window.__GPU || [];
  const regions = window.__REGIONS || [];
  const rc = findRegionCap(cap, c.region);
  const scenario = c.scenario || "all";
  const kind = c.priceKind || "price";

  // 库存：可用区或区域级
  const freeOf = (g) => {
    if (c.zone && rc) {
      const z = rc.zones.find((x) => x.zone === c.zone);
      const m = z && z.models.find((mm) => mm.id === g.id);
      return m ? m.free : 0;
    }
    if (rc) return rc.zones.reduce((a, z) => { const m = z.models.find((mm) => mm.id === g.id); return a + (m ? m.free : 0); }, 0);
    return g.stock[c.region] || 0;
  };

  const filtered = scenario === "all" ? gpus : gpus.filter((g) => TIER_OF[g.id] === scenario);

  const gpuCards = filtered.map((g) => {
    const free = freeOf(g);
    const out = free === 0;
    const unit = g[kind] || g.price;
    const avail = out ? B("无库存", "Unavailable") : free < 40 ? B("库存紧张", "Low") : B("充足", "Available");
    return `<button class="gpu-card2 ${c.gpu === g.id ? "selected" : ""} ${out ? "unavailable" : ""}" data-act="${out ? "none" : "pick-gpu:" + g.id}" aria-pressed="${c.gpu === g.id}">
      <div class="g2-title">${esc(g.name)}</div>
      <div class="g2-vram">${g.vram} GB VRAM · ${g.ram} GB RAM</div>
      <div class="g2-vram" style="margin-top:4px">${g.cpu} vCPU · ${esc(g.arch)}</div>
      <div class="g2-bottom">
        <div class="g2-price">${money(unit)}<small>/hr</small></div>
        <span class="availability ${out ? "none" : free < 40 ? "low" : ""}">● ${esc(avail)}</span>
      </div>
    </button>`;
  }).join("");

  return `
  <div class="card form-card">
    <div class="form-head"><span class="step-num">02</span><div><div class="form-title">${esc(B("Choose GPU compute", "Choose GPU compute"))}</div><div class="form-desc">${esc(B("按显存、库存与成本选择 GPU", "Select a GPU based on VRAM, availability and cost"))}</div></div></div>

    <div class="gpu-filter-row">
      <div class="tabs">${SCENARIOS.map((x) => `<button class="tab ${scenario === x[0] ? "active" : ""}" data-act="pick-scenario:${x[0]}">${esc(L(x[1]))}</button>`).join("")}</div>
      <select class="field select" data-act-pick="pricetype" id="price-kind" aria-label="${esc(B("计价方式", "Pricing"))}">
        ${[["price", B("按需 On-Demand", "On-Demand")], ["spot", B("抢占式 Spot", "Spot")], ["reserved", B("预留 Reserved", "Reserved")]].map((x) => `<option value="${x[0]}" ${kind === x[0] ? "selected" : ""}>${esc(L(x[1]))}</option>`).join("")}
      </select>
      <select class="field select" data-act-pick="region" id="region-picker" aria-label="${esc(t("common.region"))}">
        ${regions.map((r) => `<option value="${esc(r.id)}" ${c.region === r.id ? "selected" : ""}>${esc(L(r.name))}</option>`).join("")}
      </select>
      <select class="field select" data-act-pick="zone" id="zone-picker" aria-label="${esc(B("可用区", "Availability zone"))}">
        <option value="">${esc(B("全部可用区", "All zones"))}</option>
        ${(rc ? rc.zones : []).map((z) => `<option value="${esc(z.zone)}" ${c.zone === z.zone ? "selected" : ""}>${esc(z.zone)} · ${esc(L(z.power))}</option>`).join("")}
      </select>
    </div>

    <div class="row between mb16">
      <span class="tiny-text">${filtered.length} ${esc(B("GPU 型号", "GPU types"))} · ${esc(B("区域实时库存来自调度器", "live inventory from scheduler"))}</span>
      <span class="tiny-text">${rc ? `${(rc.zones.reduce((a, z) => a + z.free, 0)).toLocaleString()} ${esc(B("卡可分配", "free"))}` : ""}</span>
    </div>

    <div class="gpu-grid2">${gpuCards || `<div class="empty-state" style="grid-column:1/-1;padding:28px">${esc(B("没有符合条件的 GPU", "No GPUs match your filters."))}</div>`}</div>
  </div>`;
}

// ===== 03 Storage & environment =====
function storageCard(c) {
  const isCluster = c.mode === "cluster";
  return `
  <div class="card form-card">
    <div class="form-head"><span class="step-num">03</span><div><div class="form-title">${esc(B("Storage & environment", "Storage & environment"))}</div><div class="form-desc">${esc(B("配置磁盘、持久数据与 GPU 数量", "Configure disk, persistent data and GPU quantity"))}</div></div></div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">${esc(B("GPU 数量", "GPU count"))}</label>
        <div class="counter"><button data-act="gpu-count:-1" aria-label="${esc(B("减少", "Decrease"))}">−</button><span>${c.count}</span><button data-act="gpu-count:1" aria-label="${esc(B("增加", "Increase"))}">+</button></div>
      </div>
      ${isCluster ? `
      <div class="form-group">
        <label class="form-label">${esc(B("节点数", "Nodes"))}</label>
        <select class="field select w100" data-set="create.nodes">${[1, 2, 4, 8, 16, 32].map((x) => `<option ${Number(c.nodes) === x ? "selected" : ""}>${x}</option>`).join("")}</select>
      </div>
      <div class="form-group">
        <label class="form-label">${esc(B("调度器", "Scheduler"))}</label>
        <select class="field select w100" data-set="create.scheduler">${["Slurm", "Kubernetes"].map((x) => `<option ${c.scheduler === x ? "selected" : ""}>${x}</option>`).join("")}</select>
      </div>` : c.mode === "endpoint" ? `
      <div class="form-group">
        <label class="form-label">${esc(B("最小副本", "Min replicas"))}</label>
        <select class="field select w100" data-set="create.minReplicas">${[0, 1, 2, 3, 4].map((x) => `<option ${Number(c.minReplicas) === x ? "selected" : ""}>${x}</option>`).join("")}</select>
      </div>
      <div class="form-group">
        <label class="form-label">${esc(B("最大副本", "Max replicas"))}</label>
        <select class="field select w100" data-set="create.maxReplicas">${[1, 2, 4, 8, 16].map((x) => `<option ${Number(c.maxReplicas) === x ? "selected" : ""}>${x}</option>`).join("")}</select>
      </div>` : `
      <div class="form-group">
        <label class="form-label">${esc(B("空闲自动关机", "Idle auto-shutdown"))}</label>
        <select class="field select w100" data-set="create.autoStop">${[["0", B("关闭", "Off")], ["1", "1h"], ["2", "2h"], ["6", "6h"], ["12", "12h"]].map((x) => `<option value="${x[0]}" ${String(c.autoStop) === x[0] ? "selected" : ""}>${typeof x[1] === "string" ? esc(x[1]) : esc(L(x[1]))}</option>`).join("")}</select>
      </div>`}
    </div>

    <div class="form-group">
      <div class="range-line"><label for="disk">${esc(B("容器磁盘", "Container disk"))}</label><strong>${c.disk} GB</strong></div>
      <input class="range" type="range" id="disk" min="20" max="250" step="10" value="${Number(c.disk) || 200}" data-set="create.disk" data-type="number"/>
    </div>

    <div class="notice">${esc(B("持久化数据应优先使用 Network Volume；容器盘与存储卷的计费和保留规则可能不同。", "Persistent data should live on a Network Volume; disk and volume billing/retention rules differ."))}</div>
  </div>`;
}

// ===== 右侧吸顶 Deployment summary =====
function priceSummary(c, cap) {
  const g = gpu(c.gpu);
  const kind = c.priceKind || "price";
  const unit = g[kind] || g.price;
  const mult = c.mode === "cluster" ? Number(c.nodes) : 1;
  const gpuCount = c.mode === "endpoint" ? Number(c.count) * Number(c.minReplicas) : Number(c.count) * mult;
  const gpuCost = unit * gpuCount;
  const diskCost = (Number(c.disk) || 0) * 0.00013;
  const total = gpuCost + diskCost;
  const rc = findRegionCap(cap, c.region);
  const reg = (window.__REGIONS || []).find((r) => r.id === c.region) || {};
  const freeOfGpu = (() => {
    if (!rc) return 0;
    if (c.zone) { const z = rc.zones.find((x) => x.zone === c.zone); const m = z && z.models.find((mm) => mm.id === g.id); return m ? m.free : 0; }
    return rc.zones.reduce((a, z) => { const m = z.models.find((mm) => mm.id === g.id); return a + (m ? m.free : 0); }, 0);
  })();

  const modeLabel = t(MODES.find((x) => x[0] === c.mode)[1]);

  return `
  <aside class="card price-summary">
    <div class="row gap12 mb20"><div class="summary-card-icon"><i class="bi bi-wallet2"></i></div><div><div class="card-title">${esc(B("Deployment summary", "Deployment summary"))}</div><div class="card-sub">${esc(B("确认配置后部署", "Review your configuration"))}</div></div></div>
    <div class="summary-line"><span>${esc(B("负载类型", "Workload type"))}</span><b>${esc(modeLabel)}</b></div>
    <div class="summary-line"><span>${esc(B("区域", "Region"))}</span><b>${esc(L(reg.name) || c.region)}${c.zone ? " · " + esc(c.zone) : ""}</b></div>
    <div class="summary-line"><span>${esc(B("GPU 型号", "GPU model"))}</span><b>${esc(g.name)}</b></div>
    <div class="summary-line"><span>${esc(B("GPU 数量", "GPU quantity"))}</span><b>${gpuCount} GPU${gpuCount > 1 ? "s" : ""}</b></div>
    <div class="summary-line"><span>${esc(B("计价方式", "Pricing"))}</span><b>${kind === "spot" ? t("common.spot") : kind === "reserved" ? t("common.reserved") : t("common.onDemand")}</b></div>
    <div class="summary-line"><span>${esc(B("容器磁盘", "Container disk"))}</span><b>${c.disk} GB</b></div>
    <div class="summary-line"><span>${esc(B("可分配库存", "Free stock"))}</span><b>${freeOfGpu.toLocaleString()}</b></div>
    <div class="separator"></div>
    <div class="summary-line"><span>${esc(B("GPU 计算", "GPU compute"))}</span><b>${money(gpuCost)}/hr</b></div>
    <div class="summary-line"><span>${esc(B("容器磁盘", "Container disk"))}</span><b>${money(diskCost)}/hr</b></div>
    <div class="summary-line total"><span>${esc(B("预估合计", "Estimated total"))}</span><b>${money(total)}<small>/hr</small></b></div>
    <div class="summary-note">${esc(B("价格为实时估算，部署后开始计费；预留/抢占价按所选计价方式生效。", "Prices are live estimates; billing starts after deployment. Spot/reserved pricing applies per selection."))}</div>
    <div class="price-summary-btns">
      ${btn({ html: "<i class='bi bi-rocket-takeoff'></i> ", label: freeOfGpu > 0 ? B("立即部署", "Deploy Pod") : B("到货后部署", "Deploy when available") }, "deploy", "primary w100")}
      ${btn({ html: "<i class='bi bi-book'></i> ", label: B("查看文档", "View documentation") }, "about", "ghost w100")}
    </div>
    <div class="caption mt20">${esc(B("部署后按秒计费，费用明细见费用中心。", "Billed per second after deployment; see Billing for the breakdown."))}</div>
  </aside>`;
}

export default async function createPage(S) {
  const c = S.create;
  const cap = await api.fleetCapacity();
  return [
    header("cr.title", "cr.sub", btn("cr.back", "go-market")),
    modeBar(c),
    `<div class="deploy-layout">
      <div class="deploy-left">
        ${workloadCard(c)}
        ${computeCard(c, cap)}
        ${storageCard(c)}
      </div>
      ${priceSummary(c, cap)}
    </div>`,
  ].join("");
}
