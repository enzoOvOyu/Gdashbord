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
      // Docker Desktop（Windows）的 bind mount 不向容器传播 inotify 事件，
      // 默认监听收不到宿主文件变更，dev 服务器会持续返回旧的转换结果。
      // 开启轮询监听保证容器内 HMR 生效（代价是少量 CPU 轮询）。
      usePolling: true,
      interval: 1000,
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
