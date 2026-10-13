// 状态仓库：对齐原型的单一状态树 S（init + save），此处改为服务端持久化
import fs from "fs";
import path from "path";
import { config } from "../config.js";
import { seed } from "./data/seed.js";

const DOMAIN_KEYS = [
  "project", "balance", "budget", "instances", "endpoints", "jobs",
  "clusters", "assets", "events", "bills", "keys", "secrets", "k8s",
];

let state = null;

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

export function load() {
  if (state) return state;
  try {
    if (fs.existsSync(config.dataFile)) {
      state = JSON.parse(fs.readFileSync(config.dataFile, "utf-8"));
    }
  } catch (e) {
    console.error("[store] 读取状态失败，回退种子数据:", e.message);
  }
  if (!state) state = seed();
  save();
  return state;
}

export function save() {
  try {
    ensureDir(config.dataFile);
    fs.writeFileSync(config.dataFile, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("[store] 持久化失败:", e.message);
  }
}

export function get() {
  return load();
}

// 对齐原型 set(path, value)：仅允许领域字段写入，UI 态留在前端
export function set(pathKey, value) {
  const s = load();
  const [a, b] = String(pathKey).split(".");
  if (!DOMAIN_KEYS.includes(a)) return { ok: false, error: "non-domain key: " + a };
  if (b) s[a][b] = value;
  else s[a] = value;
  save();
  return { ok: true, state: s };
}

// 对齐原型 events 事件流
export function pushEvent(level, text) {
  const s = load();
  const now = new Date();
  const time = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  s.events.unshift({ level, time, text });
  s.events = s.events.slice(0, 30);
  save();
  return s.events[0];
}

export function reset() {
  state = seed();
  save();
  return state;
}
