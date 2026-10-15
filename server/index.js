// 入口：对齐原型 bootstrap（加载状态 → 渲染），此处为 挂载 API + 托管前端
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { config } from "../config.js";
import { get, set, load, reset } from "./store.js";
import { GPU, IMAGES, MODELS, REGIONS, NAV, MODEL_GROUPS, ENGINES, CLUSTER_SKUS, CURRENCY } from "./data/catalog.js";
import overviewRouter from "./routes/overview.js";
import marketRouter from "./routes/market.js";
import workloadsRouter from "./routes/workloads.js";
import endpointsRouter from "./routes/endpoints.js";
import jobsRouter from "./routes/jobs.js";
import assetsRouter from "./routes/assets.js";
import securityRouter from "./routes/security.js";
import monitorRouter from "./routes/monitor.js";
import billingRouter from "./routes/billing.js";
import k8sRouter from "./routes/k8s.js";
import adminRouter from "./routes/admin.js";
import fleetRouter from "./routes/fleet.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// 批量操作（如逐条 PATCH 部署数百实例）会超出 express 默认 100KB 限制，
// 这里放宽到 2MB，并把解析错误统一转成 JSON，避免前端只拿到 HTML 难以定位。
app.use(express.json({ limit: "2mb" }));

// 目录与常量（区域 / GPU 型号 / 模型分组 / 集群 SKU，统一 USD 计价）
app.get("/api/catalog", (req, res) => res.json({
  GPU, IMAGES, MODELS, REGIONS, NAV,
  MODEL_GROUPS, ENGINES, CLUSTER_SKUS,
  currency: CURRENCY,
  appName: config.appName,
  storageKey: config.storageKey,
}));

// 全量领域状态（对齐原型单一状态树 S）
app.get("/api/state", (req, res) => res.json(get()));
app.patch("/api/state", (req, res) => {
  const { path: p, value } = req.body || {};
  if (!p) return res.status(400).json({ error: "path required" });
  const r = set(p, value);
  if (!r.ok) return res.status(400).json(r);
  res.json({ ok: true, state: r.state });
});
app.post("/api/state/reset", (req, res) => res.json({ ok: true, state: reset() }));

app.use("/api/overview", overviewRouter());
app.use("/api/market", marketRouter());
app.use("/api/workloads", workloadsRouter());
app.use("/api/endpoints", endpointsRouter());
app.use("/api/jobs", jobsRouter());
app.use("/api/assets", assetsRouter());
app.use("/api/security", securityRouter());
app.use("/api/monitor", monitorRouter());
app.use("/api/billing", billingRouter());
app.use("/api/k8s", k8sRouter());
app.use("/api/admin", adminRouter());
app.use("/api/fleet", fleetRouter());

// 托管前端（无构建，对齐原型单文件 → 拆分为模块）
app.use(express.static(config.publicDir));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(config.publicDir, "index.html")));

// 统一错误处理（放最后）：保证 /api 始终返回 JSON 错误
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = Number(err.status || err.statusCode) || 500;
  if (status === 413) return res.status(413).json({ error: "请求体过大（单次写入上限 2MB），请减少单次批量条数" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "请求体不是合法 JSON" });
  console.error("[api] 未处理错误:", err.message);
  return res.status(status).json({ error: err.message || "服务器内部错误" });
});

load();
app.listen(config.port, config.host, () => {
  const line = `[${config.appName}] listening on http://${config.host}:${config.port}  (data=${config.dataFile})`;
  console.log(line);
  fs.mkdirSync(path.dirname(config.logFile), { recursive: true });
  fs.appendFileSync(config.logFile, new Date().toISOString() + " " + line + "\n");
});
