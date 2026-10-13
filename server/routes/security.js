import { Router } from "express";
import { get, save, pushEvent } from "../store.js";

const EV = (zh, en) => ({ zh, en });

export default function securityRouter() {
  const r = Router();
  r.get("/", (req, res) => {
    const s = get();
    res.json({ keys: s.keys, secrets: s.secrets, project: s.project });
  });

  r.post("/keys", (req, res) => {
    const s = get();
    const name = String((req.body || {}).name || "").trim();
    if (!name) return res.status(400).json({ error: "请输入密钥名称 / Key name required" });
    const key = {
      id: "key-" + Date.now().toString().slice(-6),
      name,
      prefix: "runsun_••••" + Math.random().toString(36).slice(2, 6).toUpperCase(),
      created: new Date().toISOString().slice(0, 10),
      last: { zh: "未使用", en: "Never used" },
      active: true,
    };
    s.keys.unshift(key);
    pushEvent("success", EV(`演示 API Key ${name} 已创建`, `Demo API key ${name} created`));
    save();
    res.json({ ok: true, key });
  });

  r.delete("/keys/:id", (req, res) => {
    const s = get();
    const k = s.keys.find((x) => x.id === req.params.id);
    if (!k) return res.status(404).json({ error: "key not found" });
    k.active = false;
    pushEvent("warning", EV(`演示密钥 ${k.name} 已撤销`, `Demo key ${k.name} revoked`));
    save();
    res.json({ ok: true, key: k });
  });

  r.post("/secrets", (req, res) => {
    const s = get();
    const name = String((req.body || {}).name || "").trim();
    if (!name) return res.status(400).json({ error: "请输入变量名 / Variable name required" });
    const secret = { name, scope: s.project, updated: new Date().toISOString().slice(0, 10) };
    s.secrets.unshift(secret);
    pushEvent("info", EV(`Secret ${name} 元数据已登记`, `Secret ${name} metadata registered`));
    save();
    res.json({ ok: true, secret });
  });
  return r;
}
