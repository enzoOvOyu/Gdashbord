// 客户端状态：对齐原型单一状态树 S（UI 态持久化 + 领域态来自服务端）
import { api } from "./api.js";

const STORAGE_KEY = "gpu_cloud_console_v3";

export const init = {
  page: "overview",
  sidebarCollapsed: false,
  project: "AI Platform / Production",
  market: { query: "", gpu: "all", region: "all", sort: "recommended", mode: "all" },
  create: {
    mode: "workspace", step: 1, name: "dev-workspace", gpu: "H100", count: 1, region: "北京三区",
    image: "PyTorch 2.5 · CUDA 12.4", dataset: "nlp-corpus-v3", disk: 200, autoStop: "2", ssh: true, jupyter: true,
    model: "Qwen3-32B-Instruct", engine: "vLLM", minReplicas: 0, maxReplicas: 4, auth: true,
    jobTemplate: "PyTorch DDP", epochs: 3, spot: false, nodes: 2, scheduler: "Slurm",
  },
  instanceFilter: "all",
  instanceQuery: "",
  selectedInstance: "ws-001",
  endpointSelected: "ep-001",
  endpointPlayground: "",
  endpointTab: "overview",
  jobTab: "jobs",
  jobSelected: "job-001",
  assetTab: "models",
  securityTab: "keys",
  monitorTab: "gpu",
  monitorTarget: "ws-001",
  monitorRange: "1h",
  billingTab: "overview",
  billingRange: "30d",
  overviewRange: "7d",
  k8sTab: "overview",
  k8sPool: "all",
  k8sStatus: "all",
  k8sNs: "all",
  k8sPhase: "all",
  k8sRange: "1h",

};

// UI 态（对齐原型的 localStorage 持久化）
const UI_KEYS = ["page", "sidebarCollapsed", "market", "create", "instanceFilter", "instanceQuery", "selectedInstance", "endpointSelected", "endpointPlayground", "endpointTab", "jobTab", "jobSelected", "assetTab", "securityTab", "monitorTab", "monitorTarget", "monitorRange", "billingTab", "billingRange", "overviewRange", "k8sTab", "k8sPool", "k8sStatus", "k8sNs", "k8sPhase", "k8sRange"];

export let S = Object.assign({}, init);

export function loadUI() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    S = Object.assign({}, init, raw);
    S.market = Object.assign({}, init.market, raw.market);
    S.create = Object.assign({}, init.create, raw.create);
  } catch (e) {
    S = Object.assign({}, init);
  }
}

export function save() {
  const snapshot = {};
  UI_KEYS.forEach((k) => (snapshot[k] = S[k]));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    /* 忽略隐私模式写入失败 */
  }
}

// 对齐原型 set(path, value)
export function set(path, value, redraw = true) {
  const [a, b] = path.split(".");
  if (b) S[a][b] = value;
  else S[a] = value;
  save();
  return redraw;
}

// 领域态：从服务端拉取（对齐原型 init 中的领域数据）
export async function refreshDomain() {
  const st = await api.state();
  Object.assign(S, {
    project: st.project,
    balance: st.balance,
    budget: st.budget,
    instances: st.instances,
    endpoints: st.endpoints,
    jobs: st.jobs,
    clusters: st.clusters,
    assets: st.assets,
    events: st.events,
    bills: st.bills,
    keys: st.keys,
    secrets: st.secrets,
    k8s: st.k8s,
  });
  return S;
}

export async function refreshCatalog() {
  const c = await api.catalog();
  S.GPU = c.GPU;
  S.IMAGES = c.IMAGES;
  S.MODELS = c.MODELS;
  S.REGIONS = c.REGIONS;
  S.NAV = c.NAV;
  return c;
}
