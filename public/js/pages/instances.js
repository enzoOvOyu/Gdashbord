// 工作空间与实例：状态标签、批量筛选、详情面板（操作分级）
import { api } from "../api.js";
import { header, metric, section, btn, esc, money, status, gpu, t, L } from "../ui.js";

const S2 = (zh, en) => ({ zh, en });

export default async function instancesPage(S) {
  const res = await api.workloads();
  const all = res.instances || [];
  const f = S.instanceFilter, q = S.instanceQuery;
  const list = all.filter((x) => (f === "all" || x.status === f) && (!q || x.name.includes(q) || x.gpu.includes(q)));
  const selected = all.find((x) => x.id === S.selectedInstance) || all[0];
  const volGb = (S.assets?.volumes || []).reduce((a, v) => a + Number(v.gb || 0), 0);

  return [
    header("ins.title", "ins.sub", btn("ins.cta", "create-workspace", "primary")),
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric(S2("运行中", "Running"), all.filter((x) => x.status === "running").length, S2("可连接工作空间", "Connectable workspaces"), "<i class='bi bi-play-circle'></i>", "", ""),
    metric(S2("已停止", "Stopped"), all.filter((x) => x.status === "stopped").length, S2("工作卷仍保留", "Volumes retained"), "<i class='bi bi-stop-circle'></i>", "", ""),
    metric(S2("GPU 分配", "GPUs assigned"), res.gpuAssigned + " " + t("mk.card.stock"), S2("活跃实例占用", "Held by active instances"), "<i class='bi bi-gpu-card'></i>", "", "hero"),
    metric(S2("持久化存储", "Persistent storage"), (volGb / 1024).toFixed(1) + " TB", S2("数据卷 / 模型缓存", "Volumes / model cache"), "<i class='bi bi-device-hdd'></i>", "", ""),
    `</div>`,
    `<div class="card filterbar mb16">`,
    `<input placeholder="${esc(L(S2("搜索实例名称或 GPU 型号", "Search name or GPU model")))}" value="${esc(q)}" data-set="instanceQuery"/>`,
    `<select data-set="instanceFilter">${[["all", t("common.all")], ["running", t("status.running")], ["stopped", t("status.stopped")], ["starting", t("status.starting")]].map((it) => `<option value="${it[0]}" ${f === it[0] ? "selected" : ""}>${esc(it[1])}</option>`).join("")}</select>`,
    btn(S2("刷新", "Refresh"), "refresh", "sm"), btn(S2("批量操作", "Bulk actions"), "batch-help", "sm"),
    `</div>`,
    `<div class="layout-wide-side">`,
    `<div class="card"><div class="table-wrap"><table><thead><tr><th>${esc(L(S2("实例名称", "Instance")))}</th><th>${esc(L(S2("GPU 配置", "GPU config")))}</th><th>${esc(t("common.region"))}</th><th>${esc(t("common.status"))}</th><th>${esc(L(S2("运行时长", "Uptime")))}</th><th>${esc(L(S2("费用 / 小时", "Cost / hour")))}</th><th>${esc(t("common.actions"))}</th></tr></thead><tbody>`,
    list.map((x) => `<tr><td><a href="javascript:void(0)" data-act="instance:${x.id}"><strong>${esc(x.name)}</strong></a><small>${esc(L(x.kind))} · ${esc(x.id)}</small></td><td>${esc(x.gpu)} × ${x.count}<small>${gpu(x.gpu).vram * x.count} GB VRAM</small></td><td>${esc(x.region)}</td><td>${status(x.status)}</td><td>${esc(L(x.age))}</td><td>${money(gpu(x.gpu).price * x.count)}</td><td><div class="table-actions">${btn(x.status === "running" ? S2("停止", "Stop") : S2("启动", "Start"), "toggle-instance:" + x.id, "sm")}${btn("ins.connect", "connect:" + x.id, x.status === "running" ? "sm primary" : "sm")}${btn("common.detail", "instance:" + x.id, "sm ghost")}</div></td></tr>`).join(""),
    `</tbody></table>${list.length ? "" : `<div class="empty">${esc(L(S2("没有符合条件的实例", "No instance matches the filter")))}</div>`}</div></div>`,
    `<div class="detail-panel">`,
    selected
      ? [
          section("ins.detail", `<span>${status(selected.status)}</span>`),
          `<div class="detail-header"><div><h2>${esc(selected.name)}</h2><p>${esc(selected.id)} · ${esc(L(selected.kind))}</p></div><span class="metric-icon"><i class='bi bi-hdd-stack'></i></span></div>`,
          [[t("common.gpu"), selected.gpu + " × " + selected.count], [L(S2("镜像", "Image")), selected.image], [t("common.region"), selected.region], [L(S2("公网 IP（示例）", "Public IP (demo)")), selected.ip], [L(S2("数据卷", "Volume")), selected.disk + " GB · RWX"], [L(S2("自动关机", "Auto-shutdown")), "2h idle"], [L(S2("工作目录", "Workdir")), "/workspace"]]
            .map((x) => `<div class="detail-kv"><span>${esc(x[0])}</span><b>${esc(L(x[1]))}</b></div>`).join(""),
          `<div class="grid cols-2 mt16">${btn("<i class='bi bi-terminal'></i> SSH / VS Code", "connect:" + selected.id, "sm primary")}${btn("JupyterLab", "jupyter:" + selected.id, "sm")}${btn("<i class='bi bi-graph-up'></i> " + t("job.btn.logs"), "logs:" + selected.id, "sm")}${btn("<i class='bi bi-speedometer2'></i> " + t("mon.title"), "monitor:" + selected.id, "sm")}${btn("↻ " + L(S2("重启", "Restart")), "restart:" + selected.id, "sm")}${btn("ins.danger", "delete-instance:" + selected.id, "sm danger")}</div>`,
          `<div class="callout mt16">${esc(L(S2("实例停止后工作卷仍保留，持久化存储可能继续计费；这是工作空间与物理资源解耦的关键。", "Volumes survive instance stop and may keep billing — that decoupling is the point of a workspace.")))}</div>`,
        ].join("")
      : `<div class="empty">${esc(t("common.none"))}</div>`,
    `</div></div>`,
  ].join("");
}
