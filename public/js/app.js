// 入口：对齐原型 bootstrap / render() / runAction() / 事件委托
import { S, loadUI, save, set, refreshDomain, refreshCatalog } from "./store.js";
import { api } from "./api.js";
import { $, esc, toast, modal, closeModal, copy, btn, status, money, gpu, skeleton } from "./ui.js";
import { shell } from "./shell.js";
import overview from "./pages/overview.js";
import market from "./pages/market.js";
import createPage from "./pages/create.js";
import instances from "./pages/instances.js";
import endpoints from "./pages/endpoints.js";
import jobs from "./pages/jobs.js";
import assets from "./pages/assets.js";
import security from "./pages/security.js";
import monitor from "./pages/monitor.js";
import billing from "./pages/billing.js";
import kubernetes, { nodeDetail, podDetail, quotaModal } from "./pages/kubernetes.js";

const pages = { overview, market, create: createPage, instances, endpoints, jobs, assets, security, kubernetes, monitor, billing };

const FOOTER = `<div class="footer-note">RunSun Cloud 控制台 · 高保真交互原型 V3.0 · 服务端提供 REST API 与状态持久化；所有资源、价格、域名、监控指标和操作均为模拟数据。</div>`;

function navigate(page) {
  S.page = page;
  save();
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}

let lastRendered = null;

async function render() {
  const app = document.getElementById("app");
  const bar = document.getElementById("progress-top");
  if (!app.innerHTML) app.innerHTML = shell();
  const main = document.getElementById("page");
  if (lastRendered !== S.page) {
    main.innerHTML = skeleton();
    if (bar) bar.classList.add("on");
  }
  try {
    const html = await pages[S.page](S);
    app.innerHTML = shell();
    document.getElementById("page").innerHTML = html + FOOTER;
    lastRendered = S.page;
  } catch (e) {
    document.getElementById("page").innerHTML = `<div class="empty">页面加载失败：${esc(e.message)}</div>` + FOOTER;
    lastRendered = null;
  } finally {
    if (bar) bar.classList.remove("on");
  }
}

// 对齐原型 deploy()
async function deploy() {
  const c = S.create;
  try {
    const r = await api.deploy(c);
    toast(r.kind === "workspace" ? "工作空间已创建" : r.kind === "endpoint" ? "Endpoint 已部署" : r.kind === "job" ? "训练任务已提交" : "集群已创建");
    if (r.kind === "cluster") S.jobTab = "clusters";
    await refreshDomain();
    navigate(r.page);
  } catch (e) {
    toast(e.message, "err");
  }
}

async function instanceAction(action, id) {
  try {
    if (action === "delete-instance") {
      const x = (S.instances || []).find((i) => i.id === id);
      modal("确认删除工作空间", `<p>删除 <b>${esc(x ? x.name : id)}</b> 将移除工作空间。此演示不会实际删除云资源。</p><div class="callout warn">生产系统需要明确区分实例删除与持久卷删除。</div>`,
        btn("取消", "close-modal") + btn("确认删除", "confirm-delete:" + id, "danger"));
      return;
    }
    const r = await api.instanceAction(id, action);
    if (action === "connect") {
      modal("SSH / VS Code 远程连接", `<div class="callout mb16">以下为模拟连接信息，不存在真实服务器或服务地址。</div><div class="code">${esc(r.connect)}</div><div class="small muted mt16">GPU 云的开发体验应提供 SSH、Web Terminal、Jupyter 和 VS Code Remote 多种入口。</div>`,
        btn("关闭", "close-modal") + btn("复制示例", "copy-connect:" + id));
      return;
    }
    if (action === "jupyter") {
      modal("JupyterLab 访问", `<div class="callout mb16">以下为模拟地址。</div><div class="code">${esc(r.url)}</div>`, btn("关闭", "close-modal"));
      return;
    }
    if (action === "logs") {
      modal("工作空间运行日志", `<div class="code">${esc(r.logs)}</div>`, btn("关闭", "close-modal"));
      return;
    }
    toast(action === "toggle-instance" ? "实例状态已更新" : "重启指令已提交");
    await refreshDomain();
    render();
  } catch (e) {
    toast(e.message, "err");
  }
}

async function runAction(a) {
  if (a === "close-modal") return closeModal();
  if (a === "none") return;
  if (a === "toggle-sidebar") {
    S.sidebarCollapsed = !S.sidebarCollapsed;
    save();
    const el = document.querySelector(".app");
    if (el) el.classList.toggle("collapsed", !!S.sidebarCollapsed);
    const t = document.querySelector('[data-act="toggle-sidebar"]');
    if (t) t.title = S.sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏";
    return;
  }
  if (a === "go-create") return navigate("create");
  if (a === "go-market") return navigate("market");
  if (a === "go-endpoint") { S.create.mode = "endpoint"; S.create.step = 2; S.create.name = "my-llm-endpoint"; save(); return navigate("create"); }
  if (a === "create-workspace") { S.create.mode = "workspace"; S.create.step = 2; S.create.name = "my-gpu-workspace"; save(); return navigate("create"); }
  if (a === "create-job") { S.create.mode = "job"; S.create.step = 2; S.create.name = "my-training-job"; save(); return navigate("create"); }
  if (a === "create-cluster") { S.create.mode = "cluster"; S.create.step = 2; S.create.name = "my-gpu-cluster"; save(); return navigate("create"); }
  if (a === "reset-market") { S.market = { query: "", gpu: "all", region: "all", sort: "recommended", mode: "all" }; save(); return render(); }
  if (a === "reset-create") { S.create = { ...S.create, step: 1 }; save(); return render(); }
  if (a === "next-step") { S.create.step = Math.min(4, Number(S.create.step) + 1); save(); render(); return window.scrollTo({ top: 0, behavior: "instant" }); }
  if (a === "prev-step") { S.create.step = Math.max(1, Number(S.create.step) - 1); save(); render(); return window.scrollTo({ top: 0, behavior: "instant" }); }
  if (a === "deploy") return deploy();
  if (a === "refresh") { await refreshDomain(); render(); return toast("资源列表已刷新"); }
  // ===== Kubernetes GPU 集群（CKS / SUNK / Mission Control）=====
  if (a === "k8s-dispatch") {
    try {
      const r = await api.k8sDispatch();
      await refreshDomain();
      await render();
      if (r.placed.length) toast("已放置 " + r.placed.length + " 个任务" + (r.blocked.length ? "；" + r.blocked.length + " 个仍阻塞" : ""));
      else toast("无可调度任务：可调度 GPU 不足", "err");
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a === "pools-scale") return toast("节点池扩容将在连接真实 CKS API 后开放");
  if (a.startsWith("node-cordon:") || a.startsWith("node-uncordon:") || a.startsWith("node-drain:") || a.startsWith("node-restore:") || a.startsWith("node-clear:")) {
    const parts = a.split(":");
    const act = parts[0].replace("node-", "");
    const id = parts[1];
    try {
      await api.k8sNodeAction(id, act === "clear" ? "clear-straggler" : act);
      await refreshDomain();
      await render();
      toast(act === "cordon" ? "节点已封锁" : act === "uncordon" ? "节点已恢复调度" : act === "drain" ? "节点开始排空" : act === "restore" ? "节点修复完成" : "straggler 标记已清除");
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("node:")) {
    try { const r = await api.k8sNode(a.split(":")[1]); nodeDetail(r.node, r.pods); } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("quota-save:")) {
    const ns = a.split(":")[1];
    const el = document.getElementById("q-gpu");
    try {
      await api.k8sQuotaSet(ns, "gpuLimit", Number(el ? el.value : 0));
      closeModal();
      await refreshDomain();
      render();
      toast("配额已更新");
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("quota:")) {
    const ns = a.split(":")[1];
    const q = (S.k8s || {}).quotas ? S.k8s.quotas.find((x) => x.ns === ns) : null;
    if (q) quotaModal(q); else toast("配额信息未加载", "err");
    return;
  }
  if (a.startsWith("pod-restart:") || a.startsWith("pod-delete:") || a.startsWith("pod-preempt:")) {
    const parts = a.split(":");
    const act = parts[0].replace("pod-", "");
    const id = parts[1];
    try {
      await api.k8sPodAction(id, act);
      closeModal();
      await refreshDomain();
      await render();
      toast(act === "restart" ? "工作负载已重启" : act === "preempt" ? "已抢占该任务" : "工作负载已删除");
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("pod:")) {
    try {
      const r = await api.k8sWorkloads("all", "all");
      const pod = r.pods.find((x) => x.id === a.split(":")[1]);
      if (pod) podDetail(pod); else toast("工作负载不存在", "err");
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  // K8S_GUARD


  if (a === "notifications") {
    const ev = S.events || [];
    modal("通知中心", ev.map((e) => `<div style="padding:12px 0;border-bottom:1px solid #edf1f7">${status(e.level)} <b style="margin-left:9px">${esc(e.text)}</b><div class="small muted mt12">${esc(e.time)}</div></div>`).join(""), btn("关闭", "close-modal"));
    return;
  }
  if (a === "about") {
    modal("关于这套 RunSun Cloud 原型", `<p style="line-height:1.8">本原型参考 RunPod、Vast.ai、Modal、Lambda Cloud、CoreWeave、AutoDL、优云智算等公开产品能力，重新组织为“开发 / 训练 / 推理 / 数据 / 运营”一体化 GPU Cloud 控制台。</p><div class="callout mb16">前端为无构建 ES Module 架构，后端提供 REST API 与状态持久化，前后端真实联调。</div><div class="small muted">参考：docs.runpod.io · docs.vast.ai · modal.com/docs · docs.lambda.ai · autodl.com/docs</div>`, btn("关闭", "close-modal"));
    return;
  }
  if (a === "batch-help") return toast("批量操作将在连接真实权限系统后开放");

  if (a.startsWith("gpu:")) {
    const g = gpu(a.split(":")[1]);
    modal(g.name + " · 资源详情", `<div class="grid cols-2"><div class="summary-line">显存 <b>${g.vram}GB</b></div><div class="summary-line">GPU 互联 <b>${esc(g.network)}</b></div><div class="summary-line">vCPU <b>${g.cpu} 核</b></div><div class="summary-line">内存 <b>${g.ram}GB</b></div><div class="summary-line">区域 <b>${esc(g.region)}</b></div><div class="summary-line">可用卡数 <b>${g.available}</b></div></div><div class="callout mt16">示例价格 ${money(g.price)}/卡·小时。支持 GPU 工作空间、训练任务与推理服务的不同交付方式。</div>`,
      btn("取消", "close-modal") + btn("选择部署", "choose-gpu:" + g.id, "primary"));
    return;
  }
  if (a.startsWith("choose-gpu:")) {
    S.create.gpu = a.split(":")[1];
    S.create.step = 2;
    S.create.mode = S.market.mode === "all" ? "workspace" : S.market.mode;
    S.create.name = "my-" + S.create.gpu.toLowerCase() + "-workload";
    save();
    closeModal();
    return navigate("create");
  }
  if (a.startsWith("instance:")) { S.selectedInstance = a.split(":")[1]; save(); return navigate("instances"); }
  if (a.startsWith("toggle-instance:") || a.startsWith("connect:") || a.startsWith("jupyter:") || a.startsWith("logs:") || a.startsWith("restart:") || a.startsWith("monitor:") || a.startsWith("delete-instance:")) {
    const parts = a.split(":");
    const act = parts[0], id = parts[1];
    if (act === "monitor") { S.monitorTarget = id; S.monitorTab = "gpu"; save(); return navigate("monitor"); }
    return instanceAction(act, id);
  }
  if (a.startsWith("confirm-delete:")) {
    const id = a.split(":")[1];
    try {
      await api.instanceAction(id, "delete-instance");
      S.selectedInstance = (S.instances || [])[0] ? S.instances[0].id : "";
      closeModal();
      await refreshDomain();
      render();
      toast("工作空间已从演示数据中删除");
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("copy-connect:")) return copy("ssh -i ~/.ssh/demo_key ubuntu@203.0.113.24");

  if (a.startsWith("endpoint:")) { S.endpointSelected = a.split(":")[1]; S.endpointTab = "overview"; save(); return navigate("endpoints"); }
  if (a === "copy-curl") {
    try {
      const id = S.endpointSelected;
      const r = await api.endpointAction(id, { action: "curl" });
      closeModal();
      return copy(r.curl);
    } catch (e) { return toast(e.message, "err"); }
  }
  if (a === "run-playground") {
    try {
      const txt = ($("#playground-input") || {}).value || "你好";
      S.endpointPlayground = txt;
      save();
      const r = await api.endpointAction(S.endpointSelected, { action: "playground", prompt: txt });
      const el = document.getElementById("playground-response");
      if (el) el.textContent = JSON.stringify(r.response, null, 2);
      toast("模拟推理请求成功");
      await refreshDomain();
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("scale:")) {
    const id = a.split(":")[1];
    const x = (S.endpoints || []).find((e) => e.id === id);
    modal("调整 Endpoint 弹性副本", `<p>服务：<b>${esc(x ? x.name : id)}</b></p><div class="form-grid"><div class="field"><label>最小副本数</label><input id="scale-min" type="number" min="0" max="16" value="${x ? x.min : 0}"></div><div class="field"><label>最大副本数</label><input id="scale-max" type="number" min="1" max="32" value="${x ? x.max : 1}"></div></div><div class="callout mt16">最小副本数为 0 时，空闲可缩至零；新请求可能出现冷启动延迟。</div>`,
      btn("取消", "close-modal") + btn("保存策略", "confirm-scale:" + id, "primary"));
    return;
  }
  if (a.startsWith("confirm-scale:")) {
    const id = a.split(":")[1];
    const min = Number(($("#scale-min") || {}).value), max = Number(($("#scale-max") || {}).value);
    if (min < 0 || max < 1 || min > max) return toast("副本配置无效", "err");
    try {
      await api.endpointAction(id, { action: "scale", min, max });
      closeModal();
      await refreshDomain();
      render();
      toast("扩缩容策略已更新");
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("monitor-endpoint:")) { S.monitorTarget = a.split(":")[1]; S.monitorTab = "inference"; save(); return navigate("monitor"); }
  if (a.startsWith("endpoint-logs:")) {
    try {
      const r = await api.endpointAction(a.split(":")[1], { action: "logs" });
      modal("Endpoint 请求日志", `<div class="code">${esc(r.logs)}</div>`, btn("关闭", "close-modal"));
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a === "rollback") return toast("已模拟回滚至上一版本");

  if (a.startsWith("job:")) {
    const j = (S.jobs || []).find((x) => x.id === a.split(":")[1]);
    if (!j) return;
    modal("训练任务 · " + esc(j.name), `<div class="grid cols-2">${[["状态", status(j.status)], ["GPU", j.gpu + " × " + j.count], ["数据集", j.dataset], ["运行时长", j.duration], ["训练进度", j.progress + "%"], ["费用估算", money(j.cost)]].map((x) => `<div class="summary-line"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("")}</div><div class="subhead mt16">Checkpoint 进度</div><div class="progress"><span style="width:${j.progress}%"></span></div><div class="code mt16">[INFO] epoch=2 step=1680 loss=0.00012</div>`,
      btn("关闭", "close-modal") + btn("查看日志", "job-logs:" + j.id));
    return;
  }
  if (a.startsWith("job-logs:")) {
    try {
      const r = await api.jobLogs(a.split(":")[1]);
      modal("训练日志", `<div class="code">${esc(r.logs)}</div>`, btn("关闭", "close-modal"));
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("retry-job:")) {
    try {
      const r = await api.jobRetry(a.split(":")[1]);
      toast("已创建重试任务 " + r.job.name);
      S.jobTab = "jobs";
      save();
      await refreshDomain();
      navigate("jobs");
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("cluster:")) {
    const c = (S.clusters || []).find((x) => x.id === a.split(":")[1]);
    if (!c) return;
    modal("集群拓扑 · " + esc(c.name), `<div class="callout mb16">调度器：${esc(c.scheduler)} · 网络：${esc(c.network)} · ${c.nodes} 个节点 / ${c.count} 张 GPU</div><div class="grid cols-2">${Array.from({ length: c.nodes }, (_, i) => `<div class="option selected"><b><i class='bi bi-graph-up'></i> GPU Node ${i + 1}</b><p>${esc(c.gpu)} × ${Math.round(c.count / c.nodes)}<br>状态：Ready · 共享存储已挂载</p></div>`).join("")}</div><div class="code mt16">squeue   // Slurm 任务队列示意</div>`, btn("关闭", "close-modal"));
    return;
  }

  if (a.startsWith("asset:")) {
    const parts = a.split(":");
    const tab = parts[1], i = Number(parts[2]);
    const item = (S.assets[tab] || [])[i];
    if (!item) return;
    modal("资产详情 · " + esc(item.name), `<div class="grid cols-2">${[["名称", item.name], ["类别", item.type], ["容量", item.size], ["版本", item.version], ["来源", item.source], ["更新时间", item.date]].map((x) => `<div class="summary-line"><span>${x[0]}</span><b>${esc(x[1])}</b></div>`).join("")}</div><div class="subhead mt16">访问 / 挂载示例</div><div class="code">${tab === "volumes" ? "mount -t nfs storage.example.invalid:/volumes/" + item.name + " /mnt/data" : tab === "models" ? "model = " + item.name : tab === "datasets" ? "s3://datasets/" + item.name : "docker pull registry.example.invalid/" + item.name + ":latest"}</div>`, btn("关闭", "close-modal"));
    return;
  }
  if (a === "new-asset") {
    modal("登记资产", `<div class="field"><label>资产名称</label><input id="asset-name" placeholder="例如 my-model-v1"/></div><div class="mt16"><div class="field"><label>资产类型</label><select id="asset-type"><option value="models">模型</option><option value="datasets">数据集</option><option value="images">镜像</option><option value="volumes">存储卷</option></select></div></div>`,
      btn("取消", "close-modal") + btn("登记资产", "confirm-asset", "primary"));
    return;
  }
  if (a === "confirm-asset") {
    const name = (($("#asset-name") || {}).value || "").trim();
    const tab = ($("#asset-type") || {}).value || "models";
    if (!name) return toast("请输入资产名称", "err");
    try {
      await api.createAsset(name, tab);
      S.assetTab = tab;
      save();
      closeModal();
      await refreshDomain();
      render();
      toast("资产已登记");
    } catch (e) { toast(e.message, "err"); }
    return;
  }

  if (a === "new-key") {
    modal("创建演示 API Key", `<div class="field"><label>密钥名称</label><input id="key-name" placeholder="例如 staging-inference"/></div><div class="callout mt16">实际密钥只应在服务端安全生成、一次性展示。原型不会生成可用凭证。</div>`,
      btn("取消", "close-modal") + btn("创建", "confirm-key", "primary"));
    return;
  }
  if (a === "confirm-key") {
    const name = (($("#key-name") || {}).value || "").trim();
    if (!name) return toast("请输入密钥名称", "err");
    try { await api.createKey(name); closeModal(); await refreshDomain(); render(); toast("演示 API Key 已创建"); } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("revoke-key:")) {
    try { await api.revokeKey(a.split(":")[1]); await refreshDomain(); render(); toast("演示密钥已撤销"); } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a === "new-secret") {
    modal("新增 Secret 元数据", `<div class="field"><label>环境变量名</label><input id="secret-name" placeholder="例如 HF_TOKEN"/></div><div class="callout mt16">本演示不接受 Secret 明文，也不在浏览器存储任何真实凭证。</div>`,
      btn("取消", "close-modal") + btn("登记", "confirm-secret", "primary"));
    return;
  }
  if (a === "confirm-secret") {
    const name = (($("#secret-name") || {}).value || "").trim();
    if (!name) return toast("请输入变量名", "err");
    try { await api.createSecret(name); closeModal(); await refreshDomain(); render(); toast("Secret 元数据已登记"); } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("secret:")) {
    const name = a.split(":")[1];
    modal("Secret 使用说明", `<div class="code">环境注入：${esc(name)}=********</div><div class="callout mt16">真实密钥值必须由服务端加密存储，并通过权限控制注入运行容器。</div>`, btn("关闭", "close-modal"));
    return;
  }

  if (a === "new-alert") {
    modal("创建告警规则", `<div class="field"><label>规则名称</label><input id="alert-name" placeholder="例如 GPU 显存使用率过高"/></div><div class="form-grid mt16"><div class="field"><label>监控指标</label><select id="alert-metric"><option>GPU 利用率</option><option>GPU 显存占用</option><option>Endpoint p95 延迟</option><option>推理错误率</option></select></div><div class="field"><label>告警阈值</label><input id="alert-value" type="number" value="90" min="1"/></div></div>`,
      btn("取消", "close-modal") + btn("保存规则", "confirm-alert", "primary"));
    return;
  }
  if (a === "confirm-alert") {
    const name = (($("#alert-name") || {}).value || "").trim();
    if (!name) return toast("请输入规则名称", "err");
    try {
      await api.createAlert(name, ($("#alert-metric") || {}).value, ($("#alert-value") || {}).value);
      closeModal();
      await refreshDomain();
      render();
      toast("告警规则已保存");
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("event:")) {
    const e = (S.events || [])[Number(a.split(":")[1])];
    if (!e) return;
    modal("告警事件详情", `<div class="between">${status(e.level)}<span class="small muted">${esc(e.time)}</span></div><p style="line-height:1.7">${esc(e.text)}</p><div class="callout">建议检查相关 GPU 指标、服务日志和弹性策略。</div>`, btn("关闭", "close-modal"));
    return;
  }

  if (a === "recharge") {
    modal("模拟账户充值", `<div class="callout mb16">充值将调用服务端 /api/billing/recharge，仅修改演示余额。</div><div class="field"><label>模拟充值金额（元）</label><input id="recharge-amount" type="number" min="1" value="1000"/></div>`,
      btn("取消", "close-modal") + btn("确认模拟充值", "confirm-recharge", "primary"));
    return;
  }
  if (a === "confirm-recharge") {
    const amount = Number(($("#recharge-amount") || {}).value);
    if (!Number.isFinite(amount) || amount <= 0) return toast("金额必须大于 0", "err");
    try { const r = await api.recharge(amount); closeModal(); await refreshDomain(); render(); toast("演示余额已更新：" + money(r.balance)); } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a === "save-budget") {
    const value = Number(($("#budget-input") || {}).value);
    if (!Number.isFinite(value) || value < 100) return toast("预算必须大于 100", "err");
    try { await api.setBudget(value); await refreshDomain(); render(); toast("预算设置已保存"); } catch (e) { toast(e.message, "err"); }
    return;
  }

  toast("这是原型中的演示入口");
}

// 事件委托：对齐原型 document 监听
document.addEventListener("click", (e) => {
  const over = e.target.closest("[data-overlay]");
  if (over && e.target === over) return closeModal();
  const act = e.target.closest("[data-act]");
  if (act) { e.preventDefault(); runAction(act.dataset.act); return; }
  const n = e.target.closest("[data-nav]");
  if (n) {
    e.preventDefault();
    if (n.dataset.mode) { S.create.step = 2; S.create.mode = n.dataset.mode; S.create.name = "my-" + n.dataset.mode + "-workload"; save(); }
    return navigate(n.dataset.nav);
  }
  const step = e.target.closest("[data-step]");
  if (step) { S.create.step = Number(step.dataset.step); save(); render(); return; }
  const mode = e.target.closest("[data-mode-select]");
  if (mode) { S.create.step = 2; S.create.mode = mode.dataset.modeSelect; S.create.name = "my-" + mode.dataset.modeSelect + "-workload"; save(); render(); return; }
  const im = e.target.closest("[data-image]");
  if (im) { S.create.image = im.dataset.image; save(); render(); return; }
  const t = e.target.closest("button[data-set][data-value],a[data-set][data-value]");
  if (t) { e.preventDefault(); set(t.dataset.set, t.dataset.value); render(); }
});

document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.check) {
    const p = el.dataset.check.split(".");
    S[p[0]][p[1]] = el.checked;
    save();
    render();
    return;
  }
  if (el.dataset.set) {
    set(el.dataset.set, el.value);
    render();
  }
});

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ($("#global-search") || {}).focus && $("#global-search").focus(); }
  if (e.key === "Escape") closeModal();
  if (e.key === "Enter" && e.target.id === "global-search") {
    const q = e.target.value.trim();
    if (!q) return;
    const i = (S.instances || []).find((x) => x.name.toLowerCase().includes(q.toLowerCase()));
    const p = (S.endpoints || []).find((x) => x.name.toLowerCase().includes(q.toLowerCase()));
    const j = (S.jobs || []).find((x) => x.name.toLowerCase().includes(q.toLowerCase()));
    if (i) { S.selectedInstance = i.id; save(); navigate("instances"); }
    else if (p) { S.endpointSelected = p.id; save(); navigate("endpoints"); }
    else if (j) { S.jobTab = "jobs"; save(); navigate("jobs"); }
    else { S.market.query = q; save(); navigate("market"); }
  }
});

// 启动：加载 UI 态 → 目录 → 领域态 → 渲染
async function boot() {
  loadUI();
  await refreshCatalog();
  window.__GPU = S.GPU;
  window.__IMAGES = S.IMAGES;
  window.__MODELS = S.MODELS;
  window.__REGIONS = S.REGIONS;
  await refreshDomain();
  await render();
}

boot();
