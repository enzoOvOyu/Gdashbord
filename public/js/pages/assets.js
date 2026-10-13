// 对齐原型 assetsPage()
import { api } from "../api.js";
import { header, metric, section, btn, esc, tabs } from "../ui.js";

export default async function assetsPage(S) {
  const res = await api.assets();
  const assets = res.assets || {};
  const tab = S.assetTab;
  const data = assets[tab] || [];
  const iconMap = { models: "<i class='bi bi-box-seam'></i>", datasets: "<i class='bi bi-graph-up'></i>", images: "<i class='bi bi-hdd-stack'></i>", volumes: "<i class='bi bi-device-hdd'></i>" };

  return [
    header("模型与数据资产", "让训练、推理和开发环境共享模型、数据集、容器镜像与持久化存储。", btn("＋ 登记资产", "new-asset", "primary")),
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric("模型版本", (assets.models || []).length, "Registry · 权限与标签", "<i class='bi bi-box-seam'></i>", "", "hero"),
    metric("数据集", (assets.datasets || []).length, "对象存储 / 文件系统", "<i class='bi bi-graph-up'></i>", ""),
    metric("容器镜像", (assets.images || []).length, "预构建 / 自定义", "<i class='bi bi-hdd-stack'></i>", ""),
    metric("存储容量", "27 TB", "持久化 / 共享", "<i class='bi bi-device-hdd'></i>", ""),
    `</div>`,
    tabs([["models", "模型仓库"], ["datasets", "数据集"], ["images", "容器镜像"], ["volumes", "存储卷"]], tab, "assetTab"),
    `<div class="layout-main-side">`,
    `<div class="grid cols-2">`,
    data.map((a, i) => `<div class="card asset-card"><div class="asset-icon">${iconMap[tab]}</div><div class="flex-1"><h3>${esc(a.name)}</h3><p>${esc(a.type)} · ${esc(a.size)}<br>${esc(a.source)} · 更新于 ${esc(a.date)}</p><div class="asset-bottom"><span class="pill blue">${esc(a.version)}</span>${btn(tab === "volumes" ? "挂载说明" : tab === "models" ? "部署模型" : "查看详情", "asset:" + tab + ":" + i, "sm")}</div></div></div>`).join(""),
    `</div>`,
    `<div class="card card-pad sticky">${section("数据资产的云原生能力")}<div class="grid">`,
    [["持久化", "实例停止或重建，模型和数据不丢失"], ["共享挂载", "多个 Workspace / Job / Endpoint 复用"], ["版本管理", "模型与数据集版本可追溯"], ["冷热分层", "对象存储与高速共享文件系统组合"], ["权限与审计", "项目隔离、密钥管理、访问日志"]]
      .map((x) => `<div class="flex"><span class="pill green"><i class='bi bi-check2-circle'></i></span><div><b class="small">${x[0]}</b><div class="small muted" style="margin-top:3px">${x[1]}</div></div></div>`).join(""),
    `</div><div class="callout mt16">与仅提供“本地 SSD 数据盘”的租赁平台不同，这里将模型与数据资产作为跨工作负载的第一类资源。</div></div></div>`,
  ].join("");
}
