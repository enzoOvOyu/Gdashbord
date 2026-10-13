// 对齐原型 createPage() + workspaceForm/endpointForm/jobForm/clusterForm
import { header, section, btn, field, input, select, esc, money, gpu, opt, status } from "../ui.js";

const MODES = [
  ["workspace", "开发工作空间", "GPU Pod / Jupyter / SSH"],
  ["endpoint", "推理 API 服务", "Serverless / Autoscaling"],
  ["job", "训练 / 批处理任务", "Job Queue / Checkpoint"],
  ["cluster", "分布式训练集群", "Slurm / Kubernetes"],
];

function workspaceForm(c) {
  return [
    `<div class="card card-pad mb16">${section("开发环境与镜像")}<div class="option-grid">`,
    (window.__IMAGES || []).map((im, i) => {
      const icons = ["🔥", "<i class='bi bi-lightning-charge-fill'></i>", "<i class='bi bi-terminal'></i>", "🎨", "📓", "<i class='bi bi-box-seam'></i>"];
      const desc = ["深度学习训练", "OpenAI 兼容服务", "高性能推理", "AIGC 应用", "交互式分析", "自定义环境"];
      return `<div class="option ${c.image === im ? "selected" : ""}" data-image="${esc(im)}"><span class="sel-dot"></span><b>${icons[i] || "<i class='bi bi-box-seam'></i>"} ${esc(im.split(" · ")[0])}</b><p>${esc(im.split(" · ")[1] || "")}<br>${desc[i] || ""}</p></div>`;
    }).join(""),
    `</div></div>`,
    `<div class="card card-pad mb16">${section("数据与连接")}<div class="form-grid">`,
    field("挂载数据集", select([["nlp-corpus-v3", "nlp-corpus-v3 · 1.8 TB"], ["vision-dataset", "vision-dataset · 640 GB"], ["none", "不挂载数据集"]], c.dataset, "create.dataset")),
    field("持久化工作卷 (GB)", input(c.disk, "create.disk", "number", "min=\"50\" step=\"50\"")),
    field("空闲自动关机", select([["0", "关闭"], ["1", "1 小时"], ["2", "2 小时"], ["6", "6 小时"], ["12", "12 小时"]], c.autoStop, "create.autoStop")),
    field("镜像启动命令", `<input value="/bin/bash" disabled/>`),
    `</div><div class="flex mt16">`,
    `<label class="check-pill"><input type="checkbox" data-check="create.ssh" ${c.ssh ? "checked" : ""}/> 启用 SSH / VS Code</label>`,
    `<label class="check-pill"><input type="checkbox" data-check="create.jupyter" ${c.jupyter ? "checked" : ""}/> 启用 JupyterLab</label>`,
    `</div></div>`,
  ].join("");
}

function endpointForm(c) {
  return [
    `<div class="card card-pad mb16">${section("模型与推理引擎")}<div class="form-grid">`,
    field("选择模型", select((window.__MODELS || []).map((x) => [x, x]), c.model, "create.model")),
    field("Serving Engine", select([["vLLM", "vLLM · LLM"], ["SGLang", "SGLang · LLM"], ["Triton", "Triton Inference Server"], ["ComfyUI", "ComfyUI · Diffusion"]], c.engine, "create.engine")),
    `</div><div class="callout mt16">自动创建兼容 OpenAI API 的模型服务（示意）；支持请求路由、健康检查、服务版本与灰度发布。</div></div>`,
    `<div class="card card-pad mb16">${section("弹性与 API 安全")}<div class="form-grid">`,
    field("最小副本数", select([0, 1, 2, 3, 4].map((x) => [x, x + " 副本"]), c.minReplicas, "create.minReplicas")),
    field("最大副本数", select([1, 2, 4, 8, 16].map((x) => [x, x + " 副本"]), c.maxReplicas, "create.maxReplicas")),
    `</div><div class="flex mt16">`,
    `<label class="check-pill"><input type="checkbox" data-check="create.auth" ${c.auth ? "checked" : ""}/> API Key 鉴权</label>`,
    `<span class="pill green"><i class='bi bi-check2-circle'></i> 支持 Scale-to-Zero</span><span class="pill blue"><i class='bi bi-check2-circle'></i> 按副本扩缩容</span>`,
    `</div></div>`,
  ].join("");
}

function jobForm(c) {
  return [
    `<div class="card card-pad mb16">${section("训练作业配置")}<div class="form-grid">`,
    field("训练模板", select([["PyTorch DDP", "PyTorch DDP"], ["DeepSpeed ZeRO", "DeepSpeed ZeRO"], ["Ray Train", "Ray Train"], ["Custom Container", "自定义容器"]], c.jobTemplate, "create.jobTemplate")),
    field("训练轮次", input(c.epochs, "create.epochs", "number", "min=\"1\" max=\"100\"")),
    field("数据集", select([["nlp-corpus-v3", "nlp-corpus-v3"], ["vision-dataset", "vision-dataset"], ["pretrain-tokens", "pretrain-tokens"]], c.dataset, "create.dataset")),
    field("Checkpoint 目录", `<input value="/checkpoints/${esc(c.name)}" disabled/>`),
    `</div><div class="flex mt16">`,
    `<label class="check-pill"><input type="checkbox" data-check="create.spot" ${c.spot ? "checked" : ""}/> 使用可中断 GPU（演示）</label>`,
    `<span class="pill blue">自动保存 Checkpoint</span><span class="pill green">失败可重试</span>`,
    `</div></div>`,
  ].join("");
}

function clusterForm(c) {
  return [
    `<div class="card card-pad mb16">${section("多节点与高速互联")}<div class="form-grid">`,
    field("计算节点数", select([2, 4, 8, 16, 32].map((x) => [x, x + " 节点"]), c.nodes, "create.nodes")),
    field("集群调度器", select([["Slurm", "Slurm"], ["Kubernetes", "Kubernetes"]], c.scheduler, "create.scheduler")),
    field("节点间网络", `<input value="${esc(gpu(c.gpu).network)}" disabled/>`),
    field("共享文件系统", `<input value="training-checkpoints · /checkpoints" disabled/>`),
    `</div><div class="callout mt16">多机训练需考虑 GPU 拓扑、RDMA 网络、共享数据、任务调度与故障恢复。平台以集群交付，而非逐台裸金属操作。</div></div>`,
  ].join("");
}

export default async function createPage(S) {
  const c = S.create;
  const g = gpu(c.gpu);
  const est = c.mode === "endpoint"
    ? g.price * Number(c.minReplicas)
    : c.mode === "cluster"
    ? g.price * Number(c.count) * Number(c.nodes)
    : g.price * Number(c.count);

  return [
    header("部署中心", "按 AI 任务选择交付方式，平台负责 GPU 调度、镜像启动、网络、数据和生命周期管理。", btn("返回 GPU 市场", "go-market")),
    `<div class="grid cols-4 mb16">${MODES.map((x) => `<div class="option ${c.mode === x[0] ? "selected" : ""}" data-mode-select="${x[0]}"><span class="sel-dot"></span><b>${x[1]}</b><p>${x[2]}</p></div>`).join("")}</div>`,
    `<div class="steps">${[["1", "选择工作负载"], ["2", "配置计算与镜像"], ["3", "数据、网络与伸缩"], ["4", "确认并部署"]].map((x, i) => `<div data-step="${i + 1}" style="cursor:pointer" class="step ${c.step === i + 1 ? "active" : c.step > i + 1 ? "done" : ""}"><span class="step-num">${c.step > i + 1 ? "<i class='bi bi-check2-circle'></i>" : x[0]}</span><div><b>${x[1]}</b><small>${["工作负载类型", "GPU 与运行环境", "服务策略", "检查费用"][i]}</small></div></div>`).join("")}</div>`,
    `<div class="layout-wide-side"><div>`,
    c.step === 1
      ? `<div class="card card-pad mb16">${section("选择 AI 工作负载")}<div class="callout mb16">GPU 云优先让用户选择“要完成什么任务”，再由平台编排 GPU、镜像、数据、网络和弹性策略。请在上方选择工作负载类型，或点击“下一步”。</div><div class="grid cols-2">${[["开发环境", "适合 Notebook、实验与调试，支持持久化工作卷"], ["在线推理", "适合生产 API，提供自动扩缩容与请求分析"], ["训练作业", "适合批处理、训练队列、Checkpoint 与重试"], ["分布式集群", "适合多机并行训练与高速网络互联"]].map((x) => `<div class="option"><b>${x[0]}</b><p>${x[1]}</p></div>`).join("")}</div></div>`
      : "",
    c.step === 2
      ? `<div class="card card-pad mb16">${section(c.mode === "workspace" ? "开发工作空间配置" : c.mode === "endpoint" ? "模型推理 Endpoint 配置" : c.mode === "job" ? "训练任务配置" : "分布式集群配置", `<span class="pill blue">${c.mode.toUpperCase()}</span>`)}<div class="form-grid">${field("名称", input(c.name, "create.name"))}${field("运行地域", select((window.__REGIONS || ["北京三区"]).map((r) => [r, r]), c.region, "create.region"))}${field("GPU 型号", select((window.__GPU || []).map((gg) => [gg.id, gg.name + " · " + gg.vram + "GB"]), c.gpu, "create.gpu"))}${field("每个工作单元 GPU 数量", select([1, 2, 4, 8, 16].map((v) => [v, v + " 张 GPU"]), c.count, "create.count"))}</div><div class="callout mt16">资源分配基于 GPU 调度单元；示例：${esc(g.name)} · ${g.vram}GB 显存 · ${esc(g.network)}。</div></div>`
      : "",
    c.step === 3 ? (c.mode === "workspace" ? workspaceForm(c) : c.mode === "endpoint" ? endpointForm(c) : c.mode === "job" ? jobForm(c) : clusterForm(c)) : "",
    c.step === 4
      ? `<div class="card card-pad">${section("部署前检查")}<div class="grid cols-3"><div class="check-pill"><i class='bi bi-check2-circle'></i> 镜像兼容性检查</div><div class="check-pill"><i class='bi bi-check2-circle'></i> 区域资源预检查</div><div class="check-pill"><i class='bi bi-check2-circle'></i> 预算与配额预检查</div></div><div class="callout warn mt16">部署将由服务端 /api/workloads/deploy 处理，写入服务端状态并产生事件；不会调用真实云平台 API。</div></div>`
      : "",
    `</div>`,
    `<div class="card card-pad sticky">${section("部署配置清单", `<a href="javascript:void(0)" data-act="reset-create">重置</a>`)}`,
    [["交付模式", (MODES.find((x) => x[0] === c.mode) || MODES[0])[1]], ["资源区域", c.region], ["GPU 型号", g.name],
     ["GPU 数量", c.count + " 张" + (c.mode === "cluster" ? " / 节点" : "")],
     ["显存合计", g.vram * Number(c.count) * (c.mode === "cluster" ? Number(c.nodes) : 1) + " GB"],
     ["镜像 / 推理引擎", c.mode === "endpoint" ? c.engine : c.image],
     ["持久化数据", c.mode === "workspace" ? c.dataset : c.mode === "job" ? "Checkpoint + Dataset" : c.mode === "cluster" ? "共享存储" : "模型缓存卷"]]
      .map((x) => `<div class="summary-line"><span>${x[0]}</span><b>${esc(x[1])}</b></div>`).join(""),
    `<div style="margin-top:19px"><div class="between"><span class="muted small">预估运行单价</span><span class="price">${money(est)}<small> / 小时</small></span></div>`,
    `<div class="small muted mt12">${c.mode === "endpoint" ? "按最小保留副本估算空闲计算成本；真实请求触发扩容后会产生额外计算费用。" : "实际计费可能包括存储、流量、预留容量等项目。"}</div></div>`,
    `<div class="divider"></div>`,
    c.step === 4
      ? btn(c.mode === "workspace" ? "创建 GPU 工作空间" : c.mode === "endpoint" ? "部署推理 Endpoint" : c.mode === "job" ? "提交训练任务" : "创建训练集群", "deploy", "primary block")
      : btn("下一步 →", "next-step", "primary block"),
    c.step > 1 ? `<div class="mt12">${btn("← 上一步", "prev-step", "block")}</div>` : "",
    `<div class="small muted" style="text-align:center;margin-top:11px">预计部署耗时 1–5 分钟 · 演示模拟</div></div></div>`,
  ].join("");
}
