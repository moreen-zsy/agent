#!/bin/bash
set -e

echo "=== A2UI Deployment Script ==="

# 启动基础设施
echo "Starting infrastructure..."
docker-compose up -d postgres redis

# 等待数据库就绪
echo "Waiting for database..."
until docker-compose exec -T postgres pg_isready -U a2ui -d a2ui > /dev/null 2>&1; do
  sleep 1
done

# 推送数据库迁移（如使用 drizzle-kit）
# echo "Running database migrations..."
# bun run db:migrate

# 种子数据
echo "Seeding database..."
bun --filter @a2ui/server db:seed || echo "Seed skipped or failed"

# 构建并启动服务
echo "Building and starting server..."
docker-compose up --build -d server

echo "=== Deployment complete ==="
echo "Server: http://localhost:3000"
echo "API docs: http://localhost:3000/api/docs"
