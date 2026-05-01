FROM oven/bun:1.2-slim AS builder
WORKDIR /app

# 复制 monorepo 根文件
COPY package.json bun.lock ./
COPY tsconfig.json ./

# 复制 workspace 包
COPY a2ui-core/package.json ./a2ui-core/
COPY a2ui-agent/package.json ./a2ui-agent/
COPY a2ui-render/react-render/package.json ./a2ui-render/react-render/
COPY a2ui-server/package.json ./a2ui-server/

# 安装依赖
RUN bun install --frozen-lockfile

# 复制源码
COPY a2ui-core/src ./a2ui-core/src
COPY a2ui-agent/src ./a2ui-agent/src
COPY a2ui-render/react-render/src ./a2ui-render/react-render/src
COPY a2ui-server/src ./a2ui-server/src

# 构建
RUN bun --filter @a2ui/core build || true
RUN bun --filter @a2ui/react-render build || true
RUN bun --filter @a2ui/agent build || true

# 运行时镜像
FROM oven/bun:1.2-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/a2ui-core ./a2ui-core
COPY --from=builder /app/a2ui-agent ./a2ui-agent
COPY --from=builder /app/a2ui-render ./a2ui-render
COPY --from=builder /app/a2ui-server ./a2ui-server

EXPOSE 3000

CMD ["bun", "run", "a2ui-server/src/index.ts"]
