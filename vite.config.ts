import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// RunSun 控制台 — Vite 配置
// 说明：构建期注入 VITE_* 环境变量（见 ARCHITECTURE.md §12.7）。
// dev 模式监听 0.0.0.0 以便容器内/外部访问。
export default defineConfig({
  plugins: [react()],
  root: '.',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    watch: {
      // Docker Desktop（Windows）bind mount 监听策略（2026-10-19 修复「5173 打不开」）：
      // 1) 禁用 usePolling：轮询会对整个 /app 周期性全量 stat。项目根曾残留
      //    231MB 的 .pnpm-store（数万个文件），轮询把 gRPC-FUSE 连接打满后返回
      //    EIO，Vite 反复崩溃、请求 10s~60s 级超时（用户侧现象即「打不开」）。
      // 2) 默认 inotify 监听为事件驱动、无常驻负载，服务稳定；但 Docker Desktop
      //    bind mount 不向容器传播宿主文件事件 ⇒ 容器内 HMR 不生效。
      //    修改源码后需 `docker compose up -d --force-recreate frontend` 重建
      //    前端容器，浏览器刷新后才会拿到新代码（见 README「Docker 开发环境」）。
      // 3) ignored 保证监听初始扫描轻量；.pnpm-store 已移出仓库，compose 亦将
      //    pnpm store 指向命名卷 /pnpm-store，正常情况下不会再现。
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/docker/**',
        '**/.pnpm-store/**',
        '**/.pnpm-store',
        '**/.workbuddy/**',
        '**/*.map',
      ],
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  envPrefix: 'VITE_',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
