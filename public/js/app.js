// 入口：render() / runAction() / 事件委托（中英双语 + 管理端动作）
import { S, loadUI, save, set, refreshDomain, refreshCatalog } from "./store.js";
import { api } from "./api.js";
import { $, esc, toast, modal, closeModal, copy, btn, status, money, gpu, skeleton, drawer, detailPairs, commandPanel, t, L } from "./ui.js";
import { getLang, setLang, toggleLang } from "./i18n.js";
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
import admin from "./pages/admin.js";

const pages = { overview, market, create: createPage, instances, endpoints, jobs, assets, security, kubernetes, monitor, billing, admin };

const B = (zh, en) => ({ zh, en });
const FOOTER = () => `<div class="footer-note">RunSun Cloud · ${t("shell.slogan")} · ${t("common.live")} · USD</div>`;

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
    document.getElementById("page").innerHTML = html + FOOTER();
    lastRendered = S.page;
  } catch (e) {
    document.getElementById("page").innerHTML = `<div class="empty">${esc(e.message)}</div>` + FOOTER();
    lastRendered = null;
  } finally {
    if (bar) bar.classList.remove("on");
  }
}

async function deploy() {
  const c = S.create;
  try {
    const r = await api.deploy(c);
    toast(r.kind === "workspace" ? B("工作空间已创建", "Workspace created")
      : r.kind === "endpoint" ? B("Endpoint 已部署", "Endpoint deployed")
      : r.kind === "job" ? B("训练任务已提交", "Training job submitted")
      : B("集群已创建", "Cluster created"));
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
      modal(B("确认删除工作空间", "Delete workspace"), `<p>${esc(L(B("删除", "Delete")))} <b>${esc(x ? x.name : id)}</b> ${esc(L(B("将移除该工作空间。", "will remove the workspace.")))}</p><div class="callout warn">${esc(L(B("容器盘数据将随实例删除；持久卷独立保留。", "Container disk data is deleted with the instance; persistent volumes are retained.")))}</div>`,
        btn(t("common.cancel"), "close-modal") + btn(B("确认删除", "Confirm delete"), "confirm-delete:" + id, "danger"));
      return;
    }
    const r = await api.instanceAction(id, action);
    if (action === "connect") {
      modal(B("SSH / VS Code 远程连接", "SSH / VS Code remote"), `<div class="callout mb16">${esc(L(B("以下为模拟连接信息，不存在真实服务器或服务地址。", "Simulated connection info; no real server or address exists.")))}</div><div class="code">${esc(r.connect)}</div>`,
        btn(t("common.close"), "close-modal") + btn(B("复制示例", "Copy sample"), "copy-connect:" + id));
      return;
    }
    if (action === "jupyter") {
      modal("JupyterLab", `<div class="callout mb16">${esc(L(B("以下为模拟地址。", "Simulated URL.")))}</div><div class="code">${esc(r.url)}</div>`, btn(t("common.close"), "close-modal"));
      return;
    }
    if (action === "logs") {
      modal(B("工作空间运行日志", "Workspace logs"), `<div class="code">${esc(r.logs)}</div>`, btn(t("common.close"), "close-modal"));
      return;
    }
    toast(B("实例状态已更新", "Instance state updated"));
    await refreshDomain();
    render();
  } catch (e) {
    toast(e.message, "err");
  }
}

function bindCommandInput(items) {
  const inp = document.getElementById("command-input");
  if (!inp || inp.dataset.bound) return;
  inp.dataset.bound = "1";
  inp.addEventListener("input", () => {
    $("#modal-root").innerHTML = commandPanel(items, inp.value);
    const inp2 = document.getElementById("command-input");
    if (inp2) { inp2.focus(); inp2.setSelectionRange(inp2.value.length, inp2.value.length); bindCommandInput(items); }
  });
}

// Pod 详情抽屉（素材包 drawer 模式）：Overview / Metrics / Logs / Connect 四 tab
function openPodDrawer(id) {
  const x = (S.instances || []).find((i) => i.id === id);
  if (!x) return;
  S.drawerPod = id;
  S.drawerTab = S.drawerTab || "overview";
  save();
  renderPodDrawer(x);
}

function renderPodDrawer(x) {
  const g = gpu(x.gpu);
  const running = x.status === "running";
  const seed = (x.id || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const tab = S.drawerTab || "overview";
  const tabsHTML = `<div class="tabs mb20">${[["overview", B("概览", "Overview")], ["metrics", B("指标", "Metrics")], ["logs", B("日志", "Logs")], ["connect", B("连接", "Connect")]]
    .map(([v, l]) => `<button class="tab ${tab === v ? "active" : ""}" data-act="drawer-tab:${v}">${esc(L(l))}</button>`).join("")}</div>`;
  const actionsHTML = btn(`<i class="bi bi-terminal"></i> ${esc(L(B("连接", "Connect")))}`, "connect:" + x.id, "sm", running ? "" : "disabled")
    + btn(`<i class="bi bi-activity"></i> ${esc(t("job.btn.logs"))}`, "logs:" + x.id, "sm")
    + btn(`<i class="bi bi-${running ? "pause" : "play"}"></i> ${running ? esc(L(B("停止", "Stop"))) : esc(L(B("启动", "Start")))}`, "toggle-instance:" + x.id, "sm");

  let body = "";
  if (tab === "overview") {
    body = `<div class="drawer-section"><h3>${esc(L(B("Pod 配置", "Pod configuration")))}</h3>
      ${detailPairs([
        [B("状态", "Status"), status(x.status)],
        [B("GPU", "GPU"), `${x.count} × ${esc(x.gpu)}`],
        [B("显存", "VRAM"), (g.vram * x.count) + " GB"],
        [t("common.region"), esc(x.region)],
        [B("模板", "Template"), esc(x.image)],
        [B("类型", "Kind"), esc(L(x.kind))],
        [B("容器磁盘", "Container disk"), (x.disk || 0) + " GB"],
        [B("时价", "Hourly price"), money(g.price * x.count) + "/hr"],
      ])}</div>
      <div class="row gap8 mt20 mb16">${btn(`<i class="bi bi-trash"></i> ${esc(L(B("终止 Pod", "Terminate Pod")))}`, "delete-instance:" + x.id, "danger sm")}</div>
      <div class="notice"><i class="bi bi-info-circle"></i> ${esc(L(B("终止将永久删除容器盘数据；持久卷独立保留。", "Terminating permanently deletes container disk data; persistent volumes are retained.")))}</div>`;
  } else if (tab === "metrics") {
    const vals = [["GPU", 40 + seed % 55], ["CPU", 25 + (seed + 7) % 60], [B("内存", "Memory"), 30 + (seed + 13) % 55], [B("磁盘", "Disk"), 20 + (seed + 3) % 65]];
    body = `<div class="drawer-section"><h3>${esc(L(B("资源利用率", "Resource utilization")))}</h3>
      ${vals.map(([k, v]) => `<div style="margin:0 0 18px"><div class="metric-name"><span>${esc(L(k))}</span><b>${running ? v : 0}%</b></div><div class="progress"><span style="width:${running ? v : 0}%"></span></div></div>`).join("")}
      <div class="notice"><i class="bi bi-graph-up-arrow"></i> ${esc(L(B("指标每 5 秒采集（DCGM），历史保留 30 天。", "Metrics sampled every 5s (DCGM), 30-day retention.")))}</div></div>`;
  } else if (tab === "logs") {
    body = `<div class="drawer-section"><h3>${esc(L(B("容器日志", "Container logs")))}</h3>
      <div class="terminal">[INFO] region=${esc(x.region)} image=${esc(x.image)}
<span class="ok">[INFO] GPU ${esc(x.gpu)} × ${x.count} allocated</span>
[INFO] volume /workspace mounted (${x.disk} GB)
[INFO] JupyterLab started on :8888
<span class="warn">[WARN] NCCL_SOCKET_IFNAME=ens1 recommended for multi-node</span>
<span class="ok">[INFO] workspace ${esc(x.name)} is ready</span></div></div>`;
  } else {
    body = `<div class="drawer-section"><h3>${esc(L(B("连接方式", "Connection options")))}</h3>
      ${detailPairs([
        [B("SSH 命令", "SSH command"), `<span class="mono">ssh -i ~/.ssh/demo_key ubuntu@${esc(x.ip || "—")}</span>`],
        [B("JupyterLab", "JupyterLab"), x.jupyter ? `<span class="mono">https://${esc(x.id)}-8888.proxy.runsuncloud.net</span>` : "—"],
        [B("Web 终端", "Web terminal"), `<span class="mono">https://${esc(x.id)}-7681.proxy.runsuncloud.net</span>`],
        [B("HTTP 服务", "HTTP services"), `<span class="mono">:8888 JupyterLab · :22 SSH</span>`],
      ])}
      <div class="mt16">${btn(`<i class="bi bi-clipboard"></i> ${esc(t("common.copy"))} SSH`, "copy-connect:" + x.id, "sm")}</div>
      <div class="notice mt16"><i class="bi bi-shield-lock"></i> ${esc(L(B("SSH 需在账户中登记公钥；端口代理经控制台鉴权。", "SSH requires a registered public key; port proxies authenticate via console.")))}</div></div>`;
  }
  $("#drawer-root").innerHTML = drawer(x.name, `${x.id} · ${x.gpu} × ${x.count}`, body, tabsHTML, actionsHTML);
}

async function runAction(a) {
  if (a === "close-modal") return closeModal();
  if (a === "drawer-close") { S.drawerPod = ""; S.drawerTab = "overview"; save(); const d = $("#drawer-root"); if (d) d.innerHTML = ""; return; }
  if (a.startsWith("drawer-tab:")) {
    S.drawerTab = a.split(":")[1];
    save();
    const x = (S.instances || []).find((i) => i.id === S.drawerPod);
    if (x) renderPodDrawer(x);
    return;
  }
  if (a === "none") return;

  // ===== ⌘K 命令面板 =====
  if (a === "open-command") {
    const items = (S.NAV || []).map((n) => ({ label: t("nav." + n[0]), icon: n[1], act: "cmd-nav:" + n[0], keywords: n[0] }))
      .concat([
        { label: B("部署 GPU Pod", "Deploy GPU Pod"), icon: "rocket-takeoff", act: "create-workspace", keywords: "pod deploy" },
        { label: B("部署推理 Endpoint", "Deploy Endpoint"), icon: "lightning-charge-fill", act: "go-endpoint", keywords: "serverless inference" },
        { label: B("提交训练任务", "Submit training job"), icon: "cpu", act: "create-job", keywords: "train job" },
        { label: B("创建集群", "Create cluster"), icon: "hdd-rack", act: "create-cluster", keywords: "cluster slurm" },
        { label: B("账户充值", "Add credits"), icon: "wallet2", act: "recharge", keywords: "billing balance" },
        { label: B("切换语言", "Toggle language"), icon: "translate", act: "toggle-lang", keywords: "language i18n" },
      ]);
    $("#modal-root").innerHTML = commandPanel(items, "");
    const inp = document.getElementById("command-input");
    if (inp) {
      inp.focus();
      inp.addEventListener("input", () => {
        $("#modal-root").innerHTML = commandPanel(items, inp.value);
        const inp2 = document.getElementById("command-input");
        if (inp2) { inp2.focus(); inp2.setSelectionRange(inp2.value.length, inp2.value.length); bindCommandInput(items); }
      });
    }
    return;
  }
  if (a.startsWith("cmd-nav:")) { closeModal(); return navigate(a.split(":")[1]); }

  if (a === "toggle-lang") {
    toggleLang();
    S.lang = getLang();
    save();
    await render();
    return toast(getLang() === "zh" ? "已切换到中文" : "Switched to English");
  }

  if (a === "toggle-sidebar") {
    S.sidebarCollapsed = !S.sidebarCollapsed;
    save();
    const el = document.querySelector(".app");
    if (el) el.classList.toggle("collapsed", !!S.sidebarCollapsed);
    const tg = document.querySelector('[data-act="toggle-sidebar"]');
    if (tg) tg.title = S.sidebarCollapsed ? t("shell.expand") : t("shell.collapse");
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
  if (a === "refresh") { await refreshDomain(); render(); return toast(B("资源列表已刷新", "Resource list refreshed")); }

  // ===== 部署中心：区域 / 规格两级联动 =====
  if (a.startsWith("pick-region:")) {
    const region = a.split(":")[1];
    S.create.region = region;
    S.create.zone = ""; // 切换区域时清空可用区选择
    // 若当前 GPU 在该区域无库存，自动切换到该区域有库存的最优型号
    const gpus = window.__GPU || [];
    const cur = gpus.find((g) => g.id === S.create.gpu);
    if (!cur || !(cur.stock[region] > 0)) {
      const alt = gpus.filter((g) => (g.stock[region] || 0) > 0).sort((x, y) => y.score - x.score)[0];
      if (alt) S.create.gpu = alt.id;
    }
    save();
    return render();
  }
  if (a.startsWith("pick-gpu:")) { S.create.gpu = a.split(":")[1]; save(); return render(); }
  if (a.startsWith("pick-count:")) { S.create.count = Number(a.split(":")[1]); save(); return render(); }
  if (a.startsWith("pick-price:")) { S.create.priceKind = a.split(":")[1]; save(); return render(); }
  // ===== 部署中心（万卡级）：可用区 / 场景筛选 / GPU 数量 counter =====
  if (a.startsWith("pick-zone:")) { S.create.zone = a.split(":")[1]; save(); return render(); }
  if (a.startsWith("pick-scenario:")) { S.create.scenario = a.split(":")[1]; save(); return render(); }
  if (a.startsWith("gpu-count:")) {
    const step = Number(a.split(":")[1]);
    S.create.count = Math.max(1, Math.min(72, Number(S.create.count || 1) + step));
    save();
    return render();
  }
  // ===== Instant Clusters：展开/收起集群 Pod 列表 =====
  if (a.startsWith("cluster-open:")) { S.clusterOpen = a.split(":")[1]; save(); return render(); }
  if (a === "cluster-close") { S.clusterOpen = ""; save(); return render(); }

  // ===== 模型目录 → 部署 =====
  if (a.startsWith("deploy-model:")) {
    const id = a.split(":")[1];
    const groups = window.__MODEL_GROUPS || [];
    const m = groups.flatMap((g) => g.models).find((x) => x.id === id);
    if (!m) return;
    S.create.mode = "endpoint";
    S.create.step = 2;
    S.create.modelId = m.id;
    S.create.model = m.name;
    S.create.engine = m.engines[0] === "Proxy" ? "vLLM" : m.engines[0];
    S.create.name = m.id + "-endpoint";
    save();
    return navigate("create");
  }
  // 集群规格 → 创建集群
  if (a.startsWith("create-sku:")) {
    const id = a.split(":")[1];
    const sku = (window.__CLUSTER_SKUS || []).find((x) => x.id === id);
    if (!sku) return;
    S.create.mode = "cluster";
    S.create.step = 3;
    S.create.gpu = sku.gpu;
    S.create.nodes = sku.nodes;
    S.create.count = sku.gpusPerNode;
    S.create.name = sku.id + "-cluster";
    save();
    return navigate("create");
  }
  // 资产页 → 部署模型
  if (a.startsWith("deploy-asset-model:")) {
    const item = (S.assets.models || [])[Number(a.split(":")[1])];
    if (!item) return;
    S.create.mode = "endpoint";
    S.create.step = 2;
    S.create.model = item.name;
    S.create.name = item.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 24) + "-ep";
    save();
    return navigate("create");
  }
  if (a.startsWith("revoke-acl:")) return toast(B("权限已回收", "Permissions revoked"));

  // ===== 管理端动作 =====
  if (a.startsWith("admin-quota:")) {
    const id = a.split(":")[1];
    const x = (S.admin?.tenants || []).find((y) => y.id === id);
    modal(B("调整租户 GPU 配额", "Edit tenant GPU quota"), `<p><b>${esc(x ? x.name : id)}</b></p><div class="field"><label>GPU ${esc(t("ad.tenant.quota"))}</label><input id="admin-quota-input" type="number" min="0" value="${x ? x.gpuQuota : 0}"/></div>`,
      btn(t("common.cancel"), "close-modal") + btn(t("common.save"), "confirm-admin-quota:" + id, "primary"));
    return;
  }
  if (a.startsWith("confirm-admin-quota:")) {
    const id = a.split(":")[1];
    const v = Number(($("#admin-quota-input") || {}).value);
    if (!Number.isFinite(v) || v < 0) return toast(B("配额无效", "Invalid quota"), "err");
    try { await api.adminTenantQuota(id, v); closeModal(); await refreshDomain(); render(); return toast(B("配额已更新", "Quota updated")); } catch (e) { return toast(e.message, "err"); }
  }
  if (a.startsWith("admin-tenant-status:")) {
    const [, id, st] = a.split(":");
    try { await api.adminTenantStatus(id, st); await refreshDomain(); render(); return toast(B("租户状态已更新", "Tenant status updated")); } catch (e) { return toast(e.message, "err"); }
  }
  if (a.startsWith("admin-user-status:")) {
    const [, id, st] = a.split(":");
    try { await api.adminUserStatus(id, st); await refreshDomain(); render(); return toast(B("成员状态已更新", "Member status updated")); } catch (e) { return toast(e.message, "err"); }
  }
  if (a === "admin-invite") {
    modal(B("邀请成员", "Invite member"),
      `<div class="field"><label>${esc(t("common.name"))}</label><input id="invite-name" placeholder="Jane Doe"/></div>
       <div class="field mt16"><label>Email</label><input id="invite-email" placeholder="jane@acme.com"/></div>
       <div class="field mt16"><label>${esc(t("ad.user.role"))}</label><select id="invite-role"><option value="developer">${esc(t("ad.role.developer"))}</option><option value="admin">${esc(t("ad.role.admin"))}</option><option value="viewer">${esc(t("ad.role.viewer"))}</option><option value="billing">${esc(t("ad.role.billing"))}</option></select></div>`,
      btn(t("common.cancel"), "close-modal") + btn(B("发送邀请", "Send invite"), "confirm-admin-invite", "primary"));
    return;
  }
  if (a === "confirm-admin-invite") {
    const name = (($("#invite-name") || {}).value || "").trim();
    const email = (($("#invite-email") || {}).value || "").trim();
    const role = ($("#invite-role") || {}).value || "developer";
    if (!name || !email) return toast(B("请填写姓名与邮箱", "Name and email required"), "err");
    try { await api.adminInvite({ name, email, role, tenant: S.adminTenant !== "all" ? S.adminTenant : undefined }); closeModal(); await refreshDomain(); render(); return toast(B("邀请已发送", "Invitation sent")); } catch (e) { return toast(e.message, "err"); }
  }
  if (a === "admin-new-tenant") return toast(B("新建租户将在连接真实计费系统后开放", "Tenant creation opens once billing is wired"));
  if (a.startsWith("admin-price:")) {
    const id = a.split(":")[1];
    const field = (document.querySelector(`[data-price="${id}:price"]`) || {}).value;
    if (field == null) return toast(B("价目输入未找到", "Price input not found"), "err");
    try { await api.adminPrice(id, "price", Number(field)); await refreshDomain(); render(); return toast(B("价目已更新", "Price updated")); } catch (e) { return toast(e.message, "err"); }
  }
  if (a.startsWith("admin-resolve:")) {
    try { await api.adminResolveTicket(a.split(":")[1]); await refreshDomain(); render(); return toast(B("工单已标记处理", "Ticket resolved")); } catch (e) { return toast(e.message, "err"); }
  }
  if (a === "admin-announce") {
    modal(B("发布公告", "Publish announcement"), `<div class="field"><label>${esc(t("ad.ticket.title"))}</label><input id="announce-text" placeholder="${esc(getLang() === "zh" ? "例如：美东区域将于本周六进行网络维护" : "e.g. US-East network maintenance this Saturday")}"/></div>`,
      btn(t("common.cancel"), "close-modal") + btn(B("发布", "Publish"), "confirm-admin-announce", "primary"));
    return;
  }
  if (a === "confirm-admin-announce") {
    const title = (($("#announce-text") || {}).value || "").trim();
    if (!title) return toast(B("请填写公告内容", "Announcement text required"), "err");
    try { await api.adminAnnounce({ title, level: "info" }); closeModal(); await refreshDomain(); render(); return toast(B("公告已发布", "Announcement published")); } catch (e) { return toast(e.message, "err"); }
  }

  // ===== Kubernetes =====
  if (a === "k8s-dispatch") {
    try {
      const r = await api.k8sDispatch();
      await refreshDomain();
      await render();
      if (r.placed.length) toast(B("已放置 " + r.placed.length + " 个任务", "Placed " + r.placed.length + " jobs") + (r.blocked.length ? B("；", "; ") + r.blocked.length + B(" 个仍阻塞", " still blocked") : ""));
      else toast(B("无可调度任务：可调度 GPU 不足", "Nothing to schedule: not enough free GPUs"), "err");
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a === "pools-scale") return toast(B("节点池扩容将在连接真实 CKS API 后开放", "Pool scaling opens with a real CKS API"));
  if (a.startsWith("node-cordon:") || a.startsWith("node-uncordon:") || a.startsWith("node-drain:") || a.startsWith("node-restore:") || a.startsWith("node-clear:")) {
    const parts = a.split(":");
    const act = parts[0].replace("node-", "");
    const id = parts[1];
    try {
      await api.k8sNodeAction(id, act === "clear" ? "clear-straggler" : act);
      await refreshDomain();
      await render();
      toast(act === "cordon" ? B("节点已封锁", "Node cordoned") : act === "uncordon" ? B("节点已恢复调度", "Node uncordoned") : act === "drain" ? B("节点开始排空", "Node draining") : act === "restore" ? B("节点修复完成", "Node repaired") : B("straggler 标记已清除", "Straggler flag cleared"));
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
      toast(B("配额已更新", "Quota updated"));
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("quota:")) {
    const ns = a.split(":")[1];
    const q = (S.k8s || {}).quotas ? S.k8s.quotas.find((x) => x.ns === ns) : null;
    if (q) quotaModal(q); else toast(B("配额信息未加载", "Quota not loaded"), "err");
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
      toast(act === "restart" ? B("工作负载已重启", "Workload restarted") : act === "preempt" ? B("已抢占该任务", "Job preempted") : B("工作负载已删除", "Workload deleted"));
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("pod:")) {
    try {
      const r = await api.k8sWorkloads("all", "all");
      const pod = r.pods.find((x) => x.id === a.split(":")[1]);
      if (pod) podDetail(pod); else toast(B("工作负载不存在", "Workload not found"), "err");
    } catch (e) { toast(e.message, "err"); }
    return;
  }

  if (a === "notifications") {
    const ev = S.events || [];
    modal(B("通知中心", "Notifications"), ev.map((e) => `<div style="padding:12px 0;border-bottom:1px solid #edf1f7">${status(e.level)} <b style="margin-left:9px">${esc(L(e.text))}</b><div class="small muted mt12">${esc(e.time)}</div></div>`).join(""), btn(t("common.close"), "close-modal"));
    return;
  }
  if (a === "about") {
    modal(B("关于这套 RunSun Cloud 原型", "About this RunSun Cloud prototype"), `<p style="line-height:1.8">${esc(L(B("本原型参考 RunPod、Vast.ai、Modal、Lambda Cloud、CoreWeave、AutoDL、优云智算等公开产品能力，重新组织为“开发 / 训练 / 推理 / 数据 / 运营”一体化 GPU Cloud 控制台。", "This prototype references RunPod, Vast.ai, Modal, Lambda Cloud, CoreWeave, AutoDL and UCloud capabilities, reorganised into one GPU cloud console for dev / training / inference / data / ops.")))}</p><div class="callout mb16">${esc(L(B("前端为无构建 ES Module 架构，后端提供 REST API 与状态持久化，前后端真实联调。区域覆盖日本 / 泰国 / 美国，GPU 型号 H100 / H200 / B200 / B300 / GB300，金额以 USD 计价。", "No-build ES module frontend, REST API backend with persisted state. Regions: Japan / Thailand / USA. GPUs: H100 / H200 / B200 / B300 / GB300. All amounts in USD.")))}</div>`, btn(t("common.close"), "close-modal"));
    return;
  }
  if (a === "batch-help") return toast(B("批量操作将在连接真实权限系统后开放", "Bulk actions open once RBAC is wired"));

  if (a.startsWith("gpu:")) {
    const g = gpu(a.split(":")[1]);
    modal(g.name + " · " + t("common.detail"), `<div class="grid cols-2"><div class="summary-line">VRAM <b>${g.vram}GB</b></div><div class="summary-line">${esc(t("mk.card.net"))} <b>${esc(g.network)}</b></div><div class="summary-line">vCPU <b>${g.cpu}</b></div><div class="summary-line">${esc(t("mk.card.cpu"))} <b>${g.ram} GB</b></div><div class="summary-line">${esc(t("cr.gpu.meta.compute"))} <b>${(g.fp8 / 1000).toFixed(1)} PF</b></div><div class="summary-line">${esc(t("mk.card.stock"))} <b>${Object.values(g.stock || {}).reduce((x, y) => x + y, 0)}</b></div></div><div class="callout mt16">${esc(t("common.onDemand"))} ${money(g.price)} ${esc(t("common.perGpuHour"))} · ${esc(t("common.spot"))} ${money(g.spot)} · ${esc(t("common.reserved"))} ${money(g.reserved)}</div>`,
      btn(t("common.cancel"), "close-modal") + btn(t("mk.card.deploy"), "choose-gpu:" + g.id, "primary"));
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
  if (a.startsWith("instance:")) { openPodDrawer(a.split(":")[1]); return; }
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
      toast(B("工作空间已删除", "Workspace deleted"));
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
      const txt = ($("#playground-input") || {}).value || "Hello";
      S.endpointPlayground = txt;
      save();
      const r = await api.endpointAction(S.endpointSelected, { action: "playground", prompt: txt });
      const el = document.getElementById("playground-response");
      if (el) el.textContent = JSON.stringify(r.response, null, 2);
      toast(B("模拟推理请求成功", "Simulated inference request succeeded"));
      await refreshDomain();
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("scale:")) {
    const id = a.split(":")[1];
    const x = (S.endpoints || []).find((e) => e.id === id);
    modal(B("调整 Endpoint 弹性副本", "Edit endpoint scaling"), `<p>${esc(L(B("服务", "Service")))}：<b>${esc(x ? x.name : id)}</b></p><div class="form-grid"><div class="field"><label>${esc(t("cr.field.min"))}</label><input id="scale-min" type="number" min="0" max="16" value="${x ? x.min : 0}"></div><div class="field"><label>${esc(t("cr.field.max"))}</label><input id="scale-max" type="number" min="1" max="32" value="${x ? x.max : 1}"></div></div><div class="callout mt16">${esc(L(B("最小副本数为 0 时，空闲可缩至零；新请求可能出现冷启动延迟。", "With min replicas at 0 the service scales to zero when idle; cold starts may add latency.")))}</div>`,
      btn(t("common.cancel"), "close-modal") + btn(B("保存策略", "Save policy"), "confirm-scale:" + id, "primary"));
    return;
  }
  if (a.startsWith("confirm-scale:")) {
    const id = a.split(":")[1];
    const min = Number(($("#scale-min") || {}).value), max = Number(($("#scale-max") || {}).value);
    if (min < 0 || max < 1 || min > max) return toast(B("副本配置无效", "Invalid replica config"), "err");
    try {
      await api.endpointAction(id, { action: "scale", min, max });
      closeModal();
      await refreshDomain();
      render();
      toast(B("扩缩容策略已更新", "Scaling policy updated"));
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("monitor-endpoint:")) { S.monitorTarget = a.split(":")[1]; S.monitorTab = "inference"; save(); return navigate("monitor"); }
  if (a.startsWith("endpoint-logs:")) {
    try {
      const r = await api.endpointAction(a.split(":")[1], { action: "logs" });
      modal(B("Endpoint 请求日志", "Endpoint request log"), `<div class="code">${esc(r.logs)}</div>`, btn(t("common.close"), "close-modal"));
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a === "rollback") return toast(B("已模拟回滚至上一版本", "Simulated rollback to previous version"));

  if (a.startsWith("job:")) {
    const j = (S.jobs || []).find((x) => x.id === a.split(":")[1]);
    if (!j) return;
    modal(t("job.detail.title") + " · " + esc(j.name), `<div class="grid cols-2">${[[t("common.status"), status(j.status)], [t("common.gpu"), j.gpu + " × " + j.count + "（" + (j.nodes || 1) + " " + esc(L(B("节点", "nodes"))) + "）"], [t("job.th.dataset"), j.dataset], [t("job.th.region"), j.region], [t("job.detail.runtime"), L(j.duration)], [t("job.detail.progress"), j.progress + "%"], [t("job.th.goodput"), (j.goodput || "—") + "%"], [t("job.detail.cost"), money(j.cost || 0)]].map((x) => `<div class="summary-line"><span>${esc(L(x[0]))}</span><b>${x[1]}</b></div>`).join("")}</div><div class="subhead mt16">${esc(t("job.detail.ckpt"))} · ${esc(L(j.checkpoint || B("—", "—")))}</div><div class="progress"><span style="width:${j.progress}%"></span></div><div class="code mt16">[INFO] epoch=2 step=1680 loss=0.00012\ntorchrun --nproc_per_node=$NUM_TRAINERS --nnodes=$NUM_NODES --node_rank=$NODE_RANK</div>`,
      btn(t("common.close"), "close-modal") + btn(t("job.btn.logs"), "job-logs:" + j.id));
    return;
  }
  if (a.startsWith("job-logs:")) {
    try {
      const r = await api.jobLogs(a.split(":")[1]);
      modal(t("job.btn.logs"), `<div class="code">${esc(r.logs)}</div>`, btn(t("common.close"), "close-modal"));
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("retry-job:")) {
    try {
      const r = await api.jobRetry(a.split(":")[1]);
      toast(B("已创建重试任务 ", "Retry job created ") + r.job.name);
      S.jobTab = "jobs";
      save();
      await refreshDomain();
      navigate("jobs");
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("cluster-detail:") || a.startsWith("cluster:")) {
    const c = (S.clusters || []).find((x) => x.id === a.split(":")[1]);
    if (!c) return;
    const nodeCount = Math.min(Number(c.nodes) || 1, 12);
    const nodeHealth = c.nodeHealth || {};
    const healthPill = c.status === "running"
      ? `<span class="pill green"><i class="dot"></i>${esc(B("节点健康 ", "Nodes healthy "))}${nodeHealth.healthy ?? c.nodes}/${c.nodes}</span>`
      : status(c.status);
    modal(t("job.cluster.topology") + " · " + esc(c.name), `<div class="callout mb16">${esc(c.scheduler)} · ${esc(c.network)} · ${esc(c.topo || "")} · ${c.nodes} ${esc(t("job.cl.nodes"))} / ${c.count} GPU · ${esc(c.region)}${c.zone ? " · " + esc(c.zone) : ""} · ${healthPill}</div><div class="grid cols-2">${Array.from({ length: nodeCount }, (_, i) => `<div class="option selected"><b><i class='bi bi-hdd-rack'></i> GPU Node ${i + 1}</b><p>${esc(c.gpu)} × ${Math.round(c.count / c.nodes)}<br>${esc(c.cpuPerNode || "—")} vCPU · ${esc(c.ramPerNode || "—")} GB RAM</p></div>`).join("")}${nodeCount < Number(c.nodes) ? `<div class="option"><b>… ${c.nodes - nodeCount} ${esc(B("更多节点", "more nodes"))}</b><p>${esc(B("拓扑视图抽样展示，全量见 K8s 节点列表", "Sampled topology; full list in K8s nodes"))}</p></div>` : ""}</div><div class="grid cols-2 mt16">${[[B("每节点存储", "Storage / node"), c.storagePerNode || "—"], [B("互联带宽", "Bandwidth"), c.bandwidth || "—"], [B("功耗", "Power"), (c.powerKw || 0) + " kW"], [B("碳排", "Carbon"), (c.carbon || 0) + " kg CO₂e/h"], [B("上架天数", "Uptime days"), c.uptimeDays || "—"], [B("MTTBF", "MTTBF"), (c.mttbf || "—") + " h"], [B("租户", "Tenant"), c.tenantName || c.tenant || "—"], [B("计费方式", "Billing"), c.billing === "reserved" ? t("common.reserved") : c.billing === "spot" ? t("common.spot") : t("common.onDemand")]].map((x) => `<div class="summary-line"><span>${esc(L(x[0]))}</span><b>${esc(L(x[1]))}</b></div>`).join("")}</div><div class="callout mt16">${money(c.priceEff || c.price || 0)} ${esc(t("common.perHour"))} · ${esc(B("目录价", "list"))} ${money(c.price || 0)} · ${esc(c.fabric || "")}</div>`, btn(t("common.close"), "close-modal"));
    return;
  }

  if (a.startsWith("asset:")) {
    const parts = a.split(":");
    const tab = parts[1], i = Number(parts[2]);
    const item = (S.assets[tab] || [])[i];
    if (!item) return;
    modal(t("as.btn.detail") + " · " + esc(item.name), `<div class="grid cols-2">${[[t("common.name"), item.name], [t("common.type"), L(item.type || item.task)], [t("common.size"), item.size], [t("common.version"), item.version], [t("common.source"), item.source], [t("as.th.updated"), item.date]].map((x) => `<div class="summary-line"><span>${esc(L(x[0]))}</span><b>${esc(L(x[1]))}</b></div>`).join("")}</div><div class="subhead mt16">${esc(L(B("访问 / 挂载示例", "Access / mount sample")))}</div><div class="code">${tab === "volumes" ? "mount -t nfs storage.runsuncloud.com:/volumes/" + item.name + " /mnt/data" : tab === "models" ? "model = " + item.name : tab === "datasets" ? "s3://datasets/" + item.name : "docker pull registry.runsuncloud.com/" + item.name + ":latest"}</div>`, btn(t("common.close"), "close-modal"));
    return;
  }
  if (a === "new-asset") {
    modal(B("登记资产", "Register asset"), `<div class="field"><label>${esc(t("common.name"))}</label><input id="asset-name" placeholder="my-model-v1"/></div><div class="mt16"><div class="field"><label>${esc(t("common.type"))}</label><select id="asset-type"><option value="models">${esc(t("as.tab.models"))}</option><option value="datasets">${esc(t("as.tab.datasets"))}</option><option value="images">${esc(t("as.tab.images"))}</option><option value="volumes">${esc(t("as.tab.volumes"))}</option></select></div></div>`,
      btn(t("common.cancel"), "close-modal") + btn(B("登记资产", "Register asset"), "confirm-asset", "primary"));
    return;
  }
  if (a === "confirm-asset") {
    const name = (($("#asset-name") || {}).value || "").trim();
    const tab = ($("#asset-type") || {}).value || "models";
    if (!name) return toast(B("请输入资产名称", "Asset name required"), "err");
    try {
      await api.createAsset(name, tab);
      S.assetTab = tab;
      save();
      closeModal();
      await refreshDomain();
      render();
      toast(B("资产已登记", "Asset registered"));
    } catch (e) { toast(e.message, "err"); }
    return;
  }

  if (a === "new-key") {
    modal(B("创建 API Key", "Create API key"), `<div class="field"><label>${esc(t("common.name"))}</label><input id="key-name" placeholder="staging-inference"/></div><div class="callout mt16">${esc(L(B("密钥由服务端安全生成，仅创建时完整展示一次，请妥善保存。", "Keys are generated server-side and shown in full only once at creation — store it safely.")))}</div>`,
      btn(t("common.cancel"), "close-modal") + btn(B("创建", "Create"), "confirm-key", "primary"));
    return;
  }
  if (a === "confirm-key") {
    const name = (($("#key-name") || {}).value || "").trim();
    if (!name) return toast(B("请输入密钥名称", "Key name required"), "err");
    try { await api.createKey(name); closeModal(); await refreshDomain(); render(); toast(B("API Key 已创建", "API key created")); } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("revoke-key:")) {
    try { await api.revokeKey(a.split(":")[1]); await refreshDomain(); render(); toast(B("密钥已撤销", "Key revoked")); } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a === "new-secret") {
    modal(B("新增 Secret 元数据", "Add secret metadata"), `<div class="field"><label>${esc(L(B("环境变量名", "Environment variable")))}</label><input id="secret-name" placeholder="HF_TOKEN"/></div><div class="callout mt16">${esc(L(B("Secret 值由服务端加密存储，运行时注入容器；浏览器不会保存明文。", "Secret values are encrypted server-side and injected at runtime; the browser never stores plaintext.")))}</div>`,
      btn(t("common.cancel"), "close-modal") + btn(B("登记", "Register"), "confirm-secret", "primary"));
    return;
  }
  if (a === "confirm-secret") {
    const name = (($("#secret-name") || {}).value || "").trim();
    if (!name) return toast(B("请输入变量名", "Variable name required"), "err");
    try { await api.createSecret(name); closeModal(); await refreshDomain(); render(); toast(B("Secret 元数据已登记", "Secret metadata registered")); } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("secret:")) {
    const name = a.split(":")[1];
    modal(B("Secret 使用说明", "Secret usage"), `<div class="code">${esc(name)}=********</div><div class="callout mt16">${esc(L(B("真实密钥值必须由服务端加密存储，并通过权限控制注入运行容器。", "Real secret values must be encrypted server-side and injected into containers under access control.")))}</div>`, btn(t("common.close"), "close-modal"));
    return;
  }

  if (a === "new-alert") {
    modal(B("创建告警规则", "Create alert rule"), `<div class="field"><label>${esc(t("common.name"))}</label><input id="alert-name" placeholder="${esc(getLang() === "zh" ? "GPU 显存使用率过高" : "GPU memory usage too high")}"/></div><div class="form-grid mt16"><div class="field"><label>${esc(t("mon.title"))}</label><select id="alert-metric"><option>GPU ${esc(t("ov.strip.util"))}</option><option>GPU ${esc(L(B("显存占用", "memory usage")))}</option><option>Endpoint p95</option><option>${esc(t("ep.metric.err"))}</option></select></div><div class="field"><label>${esc(L(B("告警阈值", "Threshold")))}</label><input id="alert-value" type="number" value="90" min="1"/></div></div>`,
      btn(t("common.cancel"), "close-modal") + btn(B("保存规则", "Save rule"), "confirm-alert", "primary"));
    return;
  }
  if (a === "confirm-alert") {
    const name = (($("#alert-name") || {}).value || "").trim();
    if (!name) return toast(B("请输入规则名称", "Rule name required"), "err");
    try {
      await api.createAlert(name, ($("#alert-metric") || {}).value, ($("#alert-value") || {}).value);
      closeModal();
      await refreshDomain();
      render();
      toast(B("告警规则已保存", "Alert rule saved"));
    } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a.startsWith("event:")) {
    const e = (S.events || [])[Number(a.split(":")[1])];
    if (!e) return;
    modal(B("告警事件详情", "Alert detail"), `<div class="between">${status(e.level)}<span class="small muted">${esc(e.time)}</span></div><p style="line-height:1.7">${esc(L(e.text))}</p><div class="callout">${esc(L(B("建议检查相关 GPU 指标、服务日志和弹性策略。", "Check related GPU metrics, service logs and scaling policies.")))}</div>`, btn(t("common.close"), "close-modal"));
    return;
  }

  if (a === "recharge") {
    modal(B("账户充值", "Add credits"), `<div class="callout mb16">${esc(L(B("充值将更新账户余额，即时生效。", "Credits update the account balance immediately.")))}</div><div class="field"><label>${esc(L(B("充值金额（USD）", "Amount (USD)")))}</label><input id="recharge-amount" type="number" min="1" value="1000"/></div>`,
      btn(t("common.cancel"), "close-modal") + btn(B("确认充值", "Confirm"), "confirm-recharge", "primary"));
    return;
  }
  if (a === "confirm-recharge") {
    const amount = Number(($("#recharge-amount") || {}).value);
    if (!Number.isFinite(amount) || amount <= 0) return toast(B("金额必须大于 0", "Amount must be greater than 0"), "err");
    try { const r = await api.recharge(amount); closeModal(); await refreshDomain(); render(); toast(B("余额已更新：", "Balance updated: ") + money(r.balance)); } catch (e) { toast(e.message, "err"); }
    return;
  }
  if (a === "save-budget") {
    const value = Number(($("#budget-input") || {}).value);
    if (!Number.isFinite(value) || value < 100) return toast(B("预算必须大于 100", "Budget must exceed 100"), "err");
    try { await api.setBudget(value); await refreshDomain(); render(); toast(B("预算设置已保存", "Budget saved")); } catch (e) { toast(e.message, "err"); }
    return;
  }

  toast(B("功能开发中", "Coming soon"));
}

// 事件委托
document.addEventListener("click", (e) => {
  const over = e.target.closest("[data-overlay]");
  if (over && e.target === over) return closeModal();
  const dOver = e.target.closest("[data-drawer-overlay]");
  if (dOver && e.target === dOver) { const d = $("#drawer-root"); if (d) d.innerHTML = ""; return; }
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
  if (mode) { S.create.mode = mode.dataset.modeSelect; save(); render(); return; }
  const im = e.target.closest("[data-image]");
  if (im) { S.create.image = im.dataset.image; save(); render(); return; }
  const t2 = e.target.closest("button[data-set][data-value],a[data-set][data-value]");
  if (t2) { e.preventDefault(); set(t2.dataset.set, t2.dataset.value); render(); }
});

document.addEventListener("change", (e) => {
  const el = e.target;
  // 管理端角色下拉
  if (el.dataset && el.dataset.adminRole) {
    api.adminUserRole(el.dataset.adminRole, el.value)
      .then(() => refreshDomain())
      .then(() => render())
      .then(() => toast(B("成员角色已更新", "Member role updated")))
      .catch((err) => toast(err.message, "err"));
    return;
  }
  if (el.dataset.check) {
    const p = el.dataset.check.split(".");
    S[p[0]][p[1]] = el.checked;
    save();
    render();
    return;
  }
  // 部署中心：下拉即选（区域 / 可用区 / 计价方式 / 模型）
  if (el.dataset.actPick) {
    const kind = el.dataset.actPick;
    const v = el.value;
    if (kind === "region") { S.create.region = v; S.create.zone = ""; save(); return render(); }
    if (kind === "zone") { S.create.zone = v; save(); return render(); }
    if (kind === "pricetype") { S.create.priceKind = v; save(); return render(); }
    if (kind === "model") {
      const groups = window.__MODEL_GROUPS || [];
      const m = groups.flatMap((g) => g.models).find((x) => x.id === v);
      if (m) { S.create.modelId = m.id; S.create.model = m.name; save(); return render(); }
    }
    return;
  }
  if (el.dataset.set) {
    set(el.dataset.set, el.value);
    render();
  }
});

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); runAction("open-command"); }
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

async function boot() {
  loadUI();
  setLang(S.lang || "zh");
  await refreshCatalog();
  window.__GPU = S.GPU;
  window.__IMAGES = S.IMAGES;
  window.__MODELS = S.MODELS;
  window.__MODEL_GROUPS = S.MODEL_GROUPS;
  window.__ENGINES = S.ENGINES;
  window.__REGIONS = S.REGIONS;
  window.__CLUSTER_SKUS = S.CLUSTER_SKUS;
  await refreshDomain();
  await render();
}

boot();
