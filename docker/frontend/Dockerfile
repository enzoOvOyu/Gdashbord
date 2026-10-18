# RunSun 控制台 — 前端开发容器
# 基础镜像：Node 22（ARCHITECTURE.md §1 要求 Node 环境跑 Vite 6）
FROM node:22-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# 仅复制依赖清单先行安装，利用镜像层缓存（需 pnpm-lock.yaml 以可复现）
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

EXPOSE 5173

# dev 模式：监听 0.0.0.0，便于容器外（宿主 / 局域网）访问
# 注：docker-compose 通过命名卷 node_modules 挂载 Linux 依赖，并在启动时
# 再跑一次 pnpm install 以保证卷内依赖与 lockfile 一致（bind mount 不遮蔽它）。
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]
