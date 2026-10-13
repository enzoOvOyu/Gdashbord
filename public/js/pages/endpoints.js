// 对齐原型 endpointsPage()
import { api } from "../api.js";
import { header, metric, section, btn, esc, status, chart, tabs, field, money } from "../ui.js";

export default async function endpointsPage(S) {
  const res = await api.endpoints();
  const list = res.endpoints || [];
  const x = list.find((e) => e.id === S.endpointSelected) || list[0];
  const m = await api.metrics("inference", "1h");

  return [
    header("模型推理服务", "把模型变成可调用的生产 API：自动扩缩容、灰度版本、请求分析与服务健康。", btn("＋ 部署 Endpoint", "go-endpoint", "primary")),
    `<div class="grid cols-4 mb16 kpi-row">`,
    metric("总请求量", (res.totalRequests / 1000).toFixed(1) + "K", "近 30 天 · 全量 Endpoint", "<i class='bi bi-arrow-left-right'></i>", "↗ 18.6%", "hero"),
    metric("活跃 Endpoints", list.length, "专属与 Serverless", "<i class='bi bi-lightning-charge-fill'></i>", ""),
    metric("推理 p95 延迟", (x ? x.p95 : 0) + " ms", x ? x.name : "—", "<i class='bi bi-clock-history'></i>", "↓ 9.8%"),
    metric("服务可用率", "99.95%", "近 30 天", "<i class='bi bi-check2-circle'></i>", "SLO 达标"),
    `</div>`,
    `<div class="grid cols-3 mb16">`,
    list.map((e) => `<div class="card endpoint-card${x && x.id === e.id ? " selected" : ""}" data-act="endpoint:${e.id}"><div class="endpoint-top"><div class="endpoint-logo">${e.model.includes("FLUX") ? "<i class='bi bi-box-seam'></i>" : "<i class='bi bi-lightning-charge-fill'></i>"}</div><div style="flex:1"><div class="endpoint-name">${esc(e.name)}</div><div class="endpoint-sub">${esc(e.model)}</div></div>${status(e.status)}</div><div class="chiprow mb12"><span class="tag">${esc(e.engine)}</span><span class="tag">${esc(e.gpu)}</span><span class="tag">${e.min}–${e.max} 副本</span></div><div class="endpoint-stats"><div>QPS<b>${e.qps}</b></div><div>p95 延迟<b>${e.p95 || "—"} ms</b></div><div>活跃副本<b>${e.replicas}</b></div></div><div class="between mt12"><span class="small muted">${esc(e.version)} · ${e.min === 0 ? "支持 Scale-to-Zero" : "最小保留 " + e.min + " 副本"}</span>${btn("查看服务 →", "endpoint:" + e.id, "sm ghost")}</div></div>`).join(""),
    `</div>`,
    x
      ? [
          `<div class="layout-wide-side">`,
          `<div class="card card-pad">${section(esc(x.name) + " · 服务工作台", tabs([["overview", "调用概览"], ["playground", "在线调试"], ["versions", "版本与发布"]], S.endpointTab, "endpointTab"))}`,
          S.endpointTab === "overview"
            ? [
                chart(m.primary, { second: m.secondary, height: 215, startText: "60 分钟前", endText: "现在" }),
                `<div class="flex small muted"><span class="blue">● 请求吞吐量</span><span class="purple">● 活跃容器数（归一化）</span></div>`,
                `<div class="grid cols-3 mt16">${metric("近 24h 调用", x.requests.toLocaleString(), "请求数", "<i class='bi bi-arrow-left-right'></i>", "")}${metric("错误率", "0.12%", "5xx / 超时", "!", "")}${metric("Token 吞吐", "2,860 /s", "生成 tokens", "<i class='bi bi-cpu'></i>", "")}</div>`,
              ].join("")
            : S.endpointTab === "playground"
            ? [
                `<div class="callout mb16">这是 API Playground 模拟环境，请求将发往服务端 /api/endpoints/${x.id}/action。</div>`,
                field("请求内容", `<textarea id="playground-input" placeholder="请输入模型提示词，例如：请用三句话解释 GPU 云的优势">${esc(S.endpointPlayground)}</textarea>`),
                `<div class="flex mt12">${btn("发送测试请求", "run-playground", "primary")}${btn("复制 cURL", "copy-curl", "sm")}</div>`,
                `<div id="playground-response" class="code mt16">// 点击“发送测试请求”查看模拟响应</div>`,
              ].join("")
            : [
                `<div class="table-wrap"><table><thead><tr><th>版本</th><th>流量权重</th><th>状态</th><th>发布时间</th><th>操作</th></tr></thead><tbody><tr><td><strong>${esc(x.version)}</strong></td><td>90%</td><td>${status("healthy")}</td><td>今天 12:40</td><td>${btn("当前版本", "none", "sm")}</td></tr><tr><td><strong>v1.2.9</strong></td><td>10%</td><td>${status("healthy")}</td><td>10月10日</td><td>${btn("回滚演示", "rollback", "sm")}</td></tr></tbody></table></div>`,
                `<div class="callout mt16">版本权重与灰度发布为交互示意。真实生产系统需配合健康检查、流量切换和回滚机制。</div>`,
              ].join(""),
          `</div>`,
          `<div class="detail-panel">${section("Endpoint 配置", status(x.status))}`,
          `<div class="detail-header"><div><h2>${esc(x.name)}</h2><p>OpenAI-Compatible API · ${esc(x.engine)}</p></div></div>`,
          [["服务模型", x.model], ["GPU 类型", x.gpu], ["活跃副本", x.replicas + " / " + x.max], ["弹性范围", x.min + " – " + x.max], ["部署版本", x.version], ["鉴权方式", "API Key"], ["服务 URL（演示）", "https://api.example.invalid/v1/" + x.name]]
            .map((y) => `<div class="detail-kv"><span>${y[0]}</span><b>${esc(y[1])}</b></div>`).join(""),
          `<div class="subhead mt16">自动伸缩策略</div><div class="progress"><span style="width:${(x.replicas / x.max) * 100}%"></span></div>`,
          `<div class="between mt12 small"><span class="muted">当前 ${x.replicas} 副本</span><span class="muted">上限 ${x.max}</span></div>`,
          `<div class="grid cols-2 mt16">${btn("调整副本", "scale:" + x.id, "sm")}${btn("复制调用示例", "copy-curl", "sm")}${btn("查看监控", "monitor-endpoint:" + x.id, "sm")}${btn("请求日志", "endpoint-logs:" + x.id, "sm")}</div>`,
          `<div class="callout mt16">端点 URL 为不可访问的示例域名；所有请求与扩缩容操作均由服务端模拟处理。</div>`,
          `</div></div>`,
        ].join("")
      : "",
  ].join("");
}
