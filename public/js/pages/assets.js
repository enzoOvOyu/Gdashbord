// 模型与数据资产：模型仓库 / 数据集 / 容器镜像 / 存储卷 / 共享与权限
import { api } from "../api.js";
import { header, metric, section, btn, esc, tabs, t, L, status } from "../ui.js";

const ICON = {
  models: "<i class='bi bi-box-seam'></i>",
  datasets: "<i class='bi bi-database'></i>",
  images: "<i class='bi bi-hdd-stack'></i>",
  volumes: "<i class='bi bi-device-hdd'></i>",
  acl: "<i class='bi bi-shield-lock'></i>",
};

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${esc(L(h))}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function modelsView(items) {
  return table([t("common.name"), t("as.th.task"), t("as.th.params"), t("as.th.license"), t("common.size"), t("common.version"), t("common.source"), t("as.th.downloads"), t("as.th.acl"), t("common.actions")],
    items.map((a, i) => [
      `<strong>${esc(a.name)}</strong><small>${esc(a.source)}</small>`,
      esc(L(a.task)), esc(a.params), esc(a.license), esc(a.size), esc(a.version), esc(a.source),
      (a.downloads || 0).toLocaleString(),
      esc(L(a.acl)),
      `<div class="table-actions">${btn("as.btn.deploy", "deploy-asset-model:" + i, "sm primary")}${btn("as.btn.detail", "asset:models:" + i, "sm")}</div>`,
    ]));
}

function datasetsView(items) {
  return table([t("common.name"), t("common.type"), "规模", "格式", t("as.th.license"), t("common.size"), "存储类别", t("common.region"), t("as.th.updated")],
    items.map((a, i) => [
      `<strong>${esc(a.name)}</strong><small>${esc(a.source)}</small>`,
      esc(L(a.type)), esc(a.rows), esc(a.format), esc(a.license), esc(a.size),
      esc(L(a.storageClass)), esc(a.region), esc(a.date),
    ]));
}

function imagesView(items) {
  return table([t("common.name"), t("common.type"), "基础镜像", "CUDA", t("common.size"), t("common.version"), "安全扫描", "拉取次数", t("common.source")],
    items.map((a, i) => [
      `<strong>${esc(a.name)}</strong><small>${esc(a.source)}</small>`,
      esc(L(a.type)), esc(a.base), esc(a.cuda), esc(a.size), esc(a.version),
      `<span class="pill ${String(L(a.scan)).includes("无") || String(L(a.scan)).includes("No") ? "green" : "amber"}"><i class="dot"></i>${esc(L(a.scan))}</span>`,
      (a.pulls || 0).toLocaleString(), esc(a.source),
    ]));
}

function volumesView(items) {
  return table([t("common.name"), t("common.type"), t("as.th.used"), t("as.th.mount"), "模式", "IOPS", t("common.region"), "加密", "快照策略", t("common.actions")],
    items.map((a, i) => [
      `<strong>${esc(a.name)}</strong><small>${esc(a.size)}</small>`,
      esc(L(a.type)),
      `<div class="progress sm"><span style="width:${a.used}%"></span></div><small>${a.used}%</small>`,
      `<code>${esc(a.mount)}</code>`,
      esc(a.mode), esc(a.iops), esc(a.region),
      a.encrypted ? `<span class="pill green"><i class="dot"></i>${esc(t("common.enabled"))}</span>` : `<span class="pill gray"><i class="dot"></i>${esc(t("common.disabled"))}</span>`,
      esc(L(a.snapshot)),
      `<div class="table-actions">${btn("as.btn.mount", "asset:volumes:" + i, "sm")}</div>`,
    ]));
}

function aclView(items) {
  return table([t("as.acl.th.resource"), t("as.acl.th.grantee"), t("as.acl.th.role"), t("as.acl.th.scope"), t("as.acl.th.expire"), t("common.actions")],
    items.map((a, i) => [
      `<strong>${esc(a.resource)}</strong>`,
      esc(L(a.grantee)),
      `<span class="tag">${esc(L(a.perm))}</span>`,
      esc(L(a.scope)), esc(a.expire),
      `<div class="table-actions">${btn("as.btn.revoke", "revoke-acl:" + i, "sm danger")}</div>`,
    ]));
}

const VIEWS = { models: modelsView, datasets: datasetsView, images: imagesView, volumes: volumesView, acl: aclView };

export default async function assetsPage(S) {
  const res = await api.assets();
  const assets = res.assets || {};
  const tab = S.assetTab || "models";
  const data = assets[tab] || [];
  const volGb = (assets.volumes || []).reduce((a, v) => a + Number(v.gb || 0), 0);

  return [
    header("as.title", "as.sub", btn("as.cta", "new-asset", "primary")),
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric("as.kpi.models", (assets.models || []).length, "as.kpi.models.desc", ICON.models, "", "hero"),
    metric("as.kpi.datasets", (assets.datasets || []).length, "as.kpi.datasets.desc", ICON.datasets, ""),
    metric("as.kpi.images", (assets.images || []).length, "as.kpi.images.desc", ICON.images, ""),
    metric("as.kpi.storage", (volGb / 1024).toFixed(1) + " TB", "as.kpi.storage.desc", ICON.volumes, ""),
    `</div>`,
    tabs([["models", "as.tab.models"], ["datasets", "as.tab.datasets"], ["images", "as.tab.images"], ["volumes", "as.tab.volumes"], ["acl", "as.tab.acl"]], tab, "assetTab"),
    `<div class="layout-wide-side">`,
    `<div class="card card-pad">${section({
      models: t("as.tab.models"), datasets: t("as.tab.datasets"), images: t("as.tab.images"), volumes: t("as.tab.volumes"), acl: t("as.tab.acl"),
    }[tab], `<span class="small muted">${data.length} ${esc(t("mk.list.unit"))}</span>`)}${data.length ? (VIEWS[tab] || modelsView)(data) : `<div class="empty">—</div>`}</div>`,
    `<div class="card card-pad sticky">${section("as.cap.title")}<div class="grid">`,
    [["as.cap.persist", "as.cap.persist.d"], ["as.cap.share", "as.cap.share.d"], ["as.cap.version", "as.cap.version.d"], ["as.cap.tier", "as.cap.tier.d"], ["as.cap.acl", "as.cap.acl.d"]]
      .map((x) => `<div class="flex"><span class="pill green"><i class='bi bi-check2-circle'></i></span><div><b class="small">${esc(t(x[0]))}</b><div class="small muted" style="margin-top:3px">${esc(t(x[1]))}</div></div></div>`).join(""),
    `</div><div class="callout mt16">${esc(t("as.cap.tip"))}</div></div></div>`,
  ].join("");
}
