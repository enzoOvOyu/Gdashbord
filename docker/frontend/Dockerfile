# RunSun 控制台 — 前端开发容器
# 基础镜像：Node 22（ARCHITECTURE.md §1 要求 Node 环境跑 Vite 6）
FROM node:22-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

EXPOSE 5173

# 说明：
# - 源码由 docker-compose 通过 `.:/app` 绑定挂载提供，故镜像内无需 COPY 源码。
# - 依赖（node_modules）使用命名卷挂载，避免 Windows 文件系统下的性能/权限问题，
#   且保证容器内的 Linux 原生依赖（esbuild/rollup 等）与宿主 Windows 环境隔离。
# - 容器启动时由 compose 的 command 执行 `pnpm install`（经宿主代理访问 npm）+ `pnpm dev`。
#   若直接运行本镜像（不带 compose），下方 CMD 作为兜底。
CMD ["sh", "-c", "pnpm install && pnpm dev --host 0.0.0.0 --port 5173"]
