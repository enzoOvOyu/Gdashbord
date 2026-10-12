// 对齐原型 jobsPage() / jobsTable() / clustersView()
import { api } from "../api.js";
import { header, metric, section, btn, esc, status, tabs } from "../ui.js";

export default async function jobsPage(S) {
  const res = await api.jobs();
  const jobs = res.jobs || [];
  const clusters = res.clusters || [];

  return [
    header("训练任务与集群", "面向模型训练、评估、批处理与多节点分布式计算：任务排队、日志、Checkpoint 与成本可视化。",
      btn("＋ 提交训练任务", "create-job", "primary") + btn("创建集群", "create-cluster")),
    tabs([["jobs", "训练与批处理任务"], ["clusters", "分布式 GPU 集群"]], S.jobTab, "jobTab"),
    S.jobTab === "jobs"
      ? [
          `<div class="grid cols-4 mb16">`,
          metric("运行中任务", res.running, "分配中的 GPU Job", "▷", ""),
          metric("排队任务", res.queued, "等待资源调度", "◷", ""),
          metric("成功率", "96.8%", "近 7 天", "✓", ""),
          metric("训练 GPU 时", "1,280 h", "近 30 天", "▦", ""),
          `</div>`,
          `<div class="layout-wide-side">`,
          `<div class="card"><div class="table-wrap"><table><thead><tr><th>任务 / 类型</th><th>GPU 资源</th><th>数据集</th><th>状态</th><th>进度</th><th>已运行</th><th>操作</th></tr></thead><tbody>`,
          jobs.map((j) => `<tr><td><a href="javascript:void(0)" data-act="job:${j.id}"><strong>${esc(j.name)}</strong></a><small>${esc(j.type)} · ${esc(j.id)}</small></td><td>${esc(j.gpu)} × ${j.count}</td><td>${esc(j.dataset)}</td><td>${status(j.status)}</td><td style="min-width:130px"><div class="progress"><span style="width:${j.progress}%"></span></div><small>${j.progress}%</small></td><td>${esc(j.duration)}</td><td><div class="table-actions">${btn("日志", "job-logs:" + j.id, "sm")}${btn("重试", "retry-job:" + j.id, "sm")}</div></td></tr>`).join(""),
          `</tbody></table></div></div>`,
          `<div class="card card-pad">${section("训练任务运行链路")}<div class="grid" style="gap:9px">`,
          [["1", "提交任务", "镜像、启动命令、数据集"], ["2", "队列调度", "GPU 配额、优先级、抢占"], ["3", "运行与监控", "Loss / GPU / 日志 / 告警"], ["4", "Checkpoint", "周期性保存模型状态"], ["5", "产物管理", "模型版本、输出与复现"]]
            .map((x) => `<div class="flex" style="padding:9px;background:#f8faff;border-radius:9px"><span class="step-num">${x[0]}</span><div><b>${x[1]}</b><div class="small muted" style="margin-top:3px">${x[2]}</div></div></div>`).join(""),
          `</div><div class="callout mt16">借鉴 Lambda 的多机训练与 Modal 的作业运行可观测性，将 GPU 视为调度资源，而非用户手动管理的服务器。</div></div></div>`,
        ].join("")
      : [
          `<div class="grid cols-3 mb16">`,
          metric("GPU 集群", clusters.length, "独立集群", "◈", ""),
          metric("总 GPU 卡数", clusters.reduce((a, c) => a + c.count, 0), "多节点资源池", "▦", ""),
          metric("高速网络", "400G IB", "RDMA / NCCL 优化", "⇄", ""),
          `</div>`,
          `<div class="grid cols-2">`,
          clusters.map((c) => `<div class="card card-pad">${section(esc(c.name), status(c.status))}<div class="chiprow mb16"><span class="tag">${esc(c.scheduler)}</span><span class="tag">${esc(c.network)}</span><span class="tag">${esc(c.gpu)}</span></div><div class="grid cols-3"><div><div class="muted small">节点数</div><div class="metric-value">${c.nodes}</div></div><div><div class="muted small">GPU 总数</div><div class="metric-value">${c.count}</div></div><div><div class="muted small">利用率</div><div class="metric-value">${c.util}%</div></div></div><div class="progress mb16"><span style="width:${c.util}%"></span></div><div class="between"><span class="small muted">节点拓扑 · 调度器 · 共享卷</span>${btn("查看拓扑", "cluster:" + c.id, "sm")}</div></div>`).join(""),
          `</div>`,
        ].join(""),
  ].join("");
}
