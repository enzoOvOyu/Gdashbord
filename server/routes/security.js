import { Router } from "express";
import { get, save, pushEvent } from "../store.js";

export default function securityRouter() {
  const r = Router();
  r.get("/", (req, res) => {
    const s = get();
    res.json({ keys: s.keys, secrets: s.secrets, project: s.project });
  });

  r.post("/keys", (req, res) => {
    const s = get();
    const name = String((req.body || {}).name || "").trim();
    if (!name) return res.status(400).json({ error: "请输入密钥名称" });
    const key = {
      id: "key-" + Date.now().toString().slice(-6),
      name,
      prefix: "neb_demo_••••" + Math.random().toString(36).slice(2, 6).toUpperCase(),
      created: new Date().toISOString().slice(0, 10),
      last: "未使用",
      active: true,
    };
    s.keys.unshift(key);
    pushEvent("success", `演示 API Key ${name} 已创建`);
    save();
    res.json({ ok: true, key });
  });

  r.delete("/keys/:id", (req, res) => {
    const s = get();
    const k = s.keys.find((x) => x.id === req.params.id);
    if (!k) return res.status(404).json({ error: "key not found" });
    k.active = false;
    pushEvent("warning", `演示密钥 ${k.name} 已撤销`);
    save();
    res.json({ ok: true, key: k });
  });

  r.post("/secrets", (req, res) => {
    const s = get();
    const name = String((req.body || {}).name || "").trim();
    if (!name) return res.status(400).json({ error: "请输入变量名" });
    const secret = { name, scope: s.project, updated: new Date().toISOString().slice(0, 10) };
    s.secrets.unshift(secret);
    pushEvent("info", `Secret ${name} 元数据已登记`);
    save();
    res.json({ ok: true, secret });
  });
  return r;
}
