// 对齐原型 market()
import { api } from "../api.js";
import { header, metric, section, btn, esc, money, opt } from "../ui.js";

export default async function market(S) {
  const m = S.market;
  const res = await api.market({ query: m.query, gpu: m.gpu, region: m.region, sort: m.sort });
  const gpus = res.gpus || [];

  return [
    header("GPU 算力市场", "从资源质量、显存、网络互联、价格与适用场景出发，选择合适的云端 GPU。", btn("查看部署方式", "go-create", "primary")),
    `<div class="grid cols-4 mb16">`,
    metric("可调度 GPU", "1,042", "6 个区域 · 多种部署模式", "<i class='bi bi-cpu'></i>", "演示库存"),
    metric("按需起步价", money(2.8) + " /h", "RTX 4090 · 单卡", "<i class='bi bi-box-seam'></i>", "示例价格"),
    metric("GPU 高速互联", "400–800G", "支持训练集群网络", "<i class='bi bi-terminal'></i>", "RDMA / NVLink"),
    metric("交付方式", "4 种", "Workspace / Endpoint / Job / Cluster", "<i class='bi bi-lightning-charge-fill'></i>", "统一调度"),
    `</div>`,
    `<div class="card filterbar mb16">`,
    `<input placeholder="搜索 GPU、型号或使用场景" value="${esc(m.query)}" data-set="market.query"/>`,
    `<select data-set="market.gpu">${opt([["all", "全部 GPU"], ...(S.GPU || []).map((g) => [g.id, g.id])], m.gpu)}</select>`,
    `<select data-set="market.region">${opt([["all", "全部地域"], ...[...new Set((S.GPU || []).map((g) => g.region))].map((r) => [r, r])], m.region)}</select>`,
    `<select data-set="market.mode">${opt([["all", "全部交付模式"], ["workspace", "开发工作空间"], ["endpoint", "模型推理服务"], ["job", "训练任务"], ["cluster", "训练集群"]], m.mode)}</select>`,
    `<select data-set="market.sort">${opt([["recommended", "综合推荐"], ["price", "价格从低到高"], ["vram", "显存从高到低"]], m.sort)}</select>`,
    btn("重置", "reset-market", "sm"),
    `</div>`,
    `<div class="layout-main-side">`,
    `<div>${section("可选算力 · " + gpus.length + " 种规格", `<span class="small muted">价格、库存为交互演示数据，非实时市场报价</span>`)}`,
    gpus.length
      ? gpus.map((g) => `<div class="card gpu-card"><div class="gpu-art"><i class='bi bi-gpu-card'></i></div><div><div class="gpu-name">${esc(g.name)}</div><div class="gpu-desc">${esc(g.tag)} · ${esc(g.region)}</div><div class="chiprow"><span class="tag">${esc(g.badge)}</span><span class="tag">${g.available} 卡可用</span></div><div class="gpu-foot">资源质量 ${g.score}/100 · 支持镜像与数据卷</div></div><div><div class="spec-grid"><div>显存<b>${g.vram} GB / 卡</b></div><div>vCPU / 内存<b>${g.cpu} 核 / ${g.ram} GB</b></div><div>本地存储<b>${esc(g.storage)}</b></div><div>互联网络<b>${esc(g.network)}</b></div><div>交付模式<b>Pod / Job / API</b></div><div>可用性<b style="color:#16aa79">● 可调度</b></div></div></div><div class="gpu-right"><div class="price">${money(g.price)}<small> / 卡·小时</small></div><div class="small muted">按需 · 示例单价</div><div>${btn("详情", "gpu:" + g.id, "sm")}${btn("选择部署", "choose-gpu:" + g.id, "sm primary")}</div></div></div>`).join("")
      : `<div class="card empty">没有符合筛选条件的 GPU，请调整条件。</div>`,
    `</div>`,
    `<div><div class="card card-pad sticky">${section("根据工作负载选 GPU")}`,
    `<div class="callout">与传统裸金属市场不同：先确定训练、推理或开发任务，再选择算力和交付形态。</div>`,
    [["开发与实验", "PyTorch / Jupyter / VS Code", "workspace", "<i class='bi bi-terminal'></i>"], ["在线推理 API", "自动扩缩容 · API Endpoint", "endpoint", "<i class='bi bi-lightning-charge-fill'></i>"], ["训练与批处理", "队列调度 · Checkpoint", "job", "<i class='bi bi-cpu'></i>"], ["分布式训练", "多节点 · 高速互联", "cluster", "<i class='bi bi-box-seam'></i>"]]
      .map((x) => `<div class="quick-card" style="padding:13px 0;border-bottom:1px solid #edf1f7" data-nav="create" data-mode="${x[2]}"><div class="quick-icon" style="width:34px;height:34px;font-size:16px">${x[3]}</div><div><h3>${x[0]} →</h3><p>${x[1]}</p></div></div>`).join(""),
    `<div class="mt16">${btn("开始配置工作负载", "go-create", "primary block")}</div></div></div>`,
    `</div>`,
  ].join("");
}
