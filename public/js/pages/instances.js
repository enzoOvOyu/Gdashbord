// 对齐原型 instancesPage()
import { api } from "../api.js";
import { header, metric, section, btn, esc, money, status, gpu } from "../ui.js";

export default async function instancesPage(S) {
  const res = await api.workloads();
  const all = res.instances || [];
  const f = S.instanceFilter, q = S.instanceQuery;
  const list = all.filter((x) => (f === "all" || x.status === f) && (!q || x.name.includes(q) || x.gpu.includes(q)));
  const selected = all.find((x) => x.id === S.selectedInstance) || all[0];

  return [
    header("工作空间与实例", "统一管理 GPU Pods、开发工作空间与远程访问；资源生命周期与持久化数据分离。", btn("＋ 创建工作空间", "create-workspace", "primary")),
    `<div class="grid cols-4 mb16">`,
    metric("运行中", all.filter((x) => x.status === "running").length, "可连接工作空间", "▷", ""),
    metric("已停止", all.filter((x) => x.status === "stopped").length, "工作卷仍保留", "□", ""),
    metric("GPU 分配", res.gpuAssigned + " 张", "活跃实例占用", "▣", ""),
    metric("持久化存储", "7.2 TB", "数据卷 / 模型缓存", "◫", ""),
    `</div>`,
    `<div class="card filterbar mb16">`,
    `<input placeholder="搜索实例名称或 GPU 型号" value="${esc(q)}" data-set="instanceQuery"/>`,
    `<select data-set="instanceFilter">${[["all", "全部状态"], ["running", "运行中"], ["stopped", "已停止"], ["starting", "启动中"]].map((it) => `<option value="${it[0]}" ${f === it[0] ? "selected" : ""}>${it[1]}</option>`).join("")}</select>`,
    btn("刷新", "refresh", "sm"), btn("批量操作", "batch-help", "sm"),
    `</div>`,
    `<div class="layout-wide-side">`,
    `<div class="card"><div class="table-wrap"><table><thead><tr><th>实例名称</th><th>GPU 配置</th><th>地域</th><th>状态</th><th>运行时长</th><th>费用 / 小时</th><th>操作</th></tr></thead><tbody>`,
    list.map((x) => `<tr><td><a href="javascript:void(0)" data-act="instance:${x.id}"><strong>${esc(x.name)}</strong></a><small>${esc(x.kind)} · ${esc(x.id)}</small></td><td>${esc(x.gpu)} × ${x.count}<small>${gpu(x.gpu).vram * x.count}GB 显存</small></td><td>${esc(x.region)}</td><td>${status(x.status)}</td><td>${esc(x.age)}</td><td>${money(gpu(x.gpu).price * x.count)}</td><td><div class="table-actions">${btn(x.status === "running" ? "停止" : "启动", "toggle-instance:" + x.id, "sm")}${btn("连接", "connect:" + x.id, "sm")}${btn("详情", "instance:" + x.id, "sm")}</div></td></tr>`).join(""),
    `</tbody></table>${list.length ? "" : `<div class="empty">没有符合条件的实例</div>`}</div></div>`,
    `<div class="detail-panel">`,
    selected
      ? [
          section("工作空间详情", `<span>${status(selected.status)}</span>`),
          `<div class="detail-header"><div><h2>${esc(selected.name)}</h2><p>${esc(selected.id)} · ${esc(selected.kind)}</p></div><span class="metric-icon">▤</span></div>`,
          [["GPU", selected.gpu + " × " + selected.count], ["镜像", selected.image], ["区域", selected.region], ["公网 IP（示例）", selected.ip], ["数据卷", selected.disk + " GB · 持久化"], ["自动关机", "2 小时空闲"], ["工作目录", "/workspace"]]
            .map((x) => `<div class="detail-kv"><span>${x[0]}</span><b>${esc(x[1])}</b></div>`).join(""),
          `<div class="grid cols-2 mt16">${btn("⌘ SSH / VS Code", "connect:" + selected.id, "sm")}${btn("📓 JupyterLab", "jupyter:" + selected.id, "sm")}${btn("▥ 查看日志", "logs:" + selected.id, "sm")}${btn("◈ 资源监控", "monitor:" + selected.id, "sm")}${btn("↻ 重启", "restart:" + selected.id, "sm")}${btn("删除", "delete-instance:" + selected.id, "sm danger")}</div>`,
          `<div class="callout mt16">实例停止后工作卷仍保留，持久化存储可能继续计费；这是工作空间与物理资源解耦的关键。</div>`,
        ].join("")
      : `<div class="empty">暂无实例</div>`,
    `</div></div>`,
  ].join("");
}
