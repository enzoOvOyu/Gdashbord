import { Router } from "express";
import { get, save, pushEvent } from "../store.js";
import { adminOverview, setTenantStatus, setTenantQuota, setUserRole, setUserStatus, inviteUser, priceBook, setPrice, resolveTicket, publishAnnouncement } from "../services/admin.js";
import { costSummary } from "../services/cost.js";
import { GPU, REGIONS, CLUSTER_SKUS } from "../data/catalog.js";

export default function adminRouter() {
  const r = Router();

  // 平台总览：租户 / 用户 / 机队 / 工单 / 服务健康 / 公告
  r.get("/overview", (req, res) => {
    const s = get();
    res.json({ platform: s.admin.platform, overview: adminOverview(s), cost: costSummary(s) });
  });

  // 租户与用户
  r.get("/tenants", (req, res) => {
    const s = get();
    res.json({ tenants: s.admin.tenants, users: s.admin.users, roles: s.admin.roles, matrix: s.admin.matrix });
  });

  r.post("/tenants/:id/status", (req, res) => {
    const s = get();
    const out = setTenantStatus(s, req.params.id, String((req.body || {}).status || "active"));
    if (out.error) return res.status(400).json(out);
    save();
    res.json(out);
  });

  r.post("/tenants/:id/quota", (req, res) => {
    const s = get();
    const out = setTenantQuota(s, req.params.id, (req.body || {}).quota);
    if (out.error) return res.status(400).json(out);
    save();
    res.json(out);
  });

  r.post("/users", (req, res) => {
    const s = get();
    const out = inviteUser(s, req.body || {});
    if (out.error) return res.status(400).json(out);
    save();
    res.json(out);
  });

  r.post("/users/:id/role", (req, res) => {
    const s = get();
    const out = setUserRole(s, req.params.id, String((req.body || {}).role || "viewer"));
    if (out.error) return res.status(400).json(out);
    save();
    res.json(out);
  });

  r.post("/users/:id/status", (req, res) => {
    const s = get();
    const out = setUserStatus(s, req.params.id, String((req.body || {}).status || "active"));
    if (out.error) return res.status(400).json(out);
    save();
    res.json(out);
  });

  // 资源与配额
  r.get("/capacity", (req, res) => {
    const s = get();
    res.json({
      fleet: adminOverview(s).fleet,
      regions: REGIONS,
      plans: s.admin.plans,
      quotas: s.k8s ? s.k8s.quotas : [],
    });
  });

  // 计费与价格
  r.get("/billing", (req, res) => {
    const s = get();
    res.json({ priceBook: priceBook(s), invoices: s.admin.invoices, cost: costSummary(s) });
  });

  r.post("/price", (req, res) => {
    const s = get();
    const { id, field, value } = req.body || {};
    const out = setPrice(s, id, field, value);
    if (out.error) return res.status(400).json(out);
    save();
    res.json(out);
  });

  // 运维与审计
  r.get("/ops", (req, res) => {
    const s = get();
    res.json({ services: s.admin.services, tickets: s.admin.tickets, audit: s.admin.audit, announcements: s.admin.announcements });
  });

  r.post("/tickets/:id/resolve", (req, res) => {
    const s = get();
    const out = resolveTicket(s, req.params.id);
    if (out.error) return res.status(400).json(out);
    save();
    res.json(out);
  });

  r.post("/announcements", (req, res) => {
    const s = get();
    const out = publishAnnouncement(s, req.body || {});
    if (out.error) return res.status(400).json(out);
    save();
    res.json(out);
  });

  // 集群规格价目（供训练页一键集群使用）
  r.get("/cluster-skus", (req, res) => res.json({ skus: CLUSTER_SKUS, gpus: GPU }));

  return r;
}
