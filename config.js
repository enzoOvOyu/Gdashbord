// 独立配置：端口、数据目录、日志目录均隔离在本工程内，不复用其他项目配置
export const config = {
  appName: "GPU Cloud 控制台",
  port: Number(process.env.GPU_CLOUD_PORT || 8080),
  host: "0.0.0.0",
  dataFile: "/opt/gdashboard/repo/data/state.json",
  logFile: "/opt/gdashboard/repo/log/server.log",
  publicDir: "/opt/gdashboard/repo/public",
  apiPrefix: "/api",
  storageKey: "gpu_cloud_console_v3",
};
