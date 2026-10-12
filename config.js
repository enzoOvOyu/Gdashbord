// 独立配置：端口、数据目录、日志目录均隔离在本工程内，不复用其他项目配置
export const config = {
  appName: "Nebula GPU Cloud",
  port: Number(process.env.NEBULA_PORT || 8080),
  host: "0.0.0.0",
  dataFile: "/opt/gdashboard/repo/data/state.json",
  logFile: "/opt/gdashboard/repo/log/server.log",
  publicDir: "/opt/gdashboard/repo/public",
  apiPrefix: "/api",
  storageKey: "nebula_gpu_cloud_v3",
};
