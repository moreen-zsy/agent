import { Elysia } from "elysia";
import { staticPlugin } from "@elysia/static";
import { cors } from "@elysia/cors";
import { getRuntime } from "@a2ui/agent";
import config from "./config/config_dev";
import { authPlugin } from "./plugins/auth-plugin";
import { authRoutes } from "./routes/auth";
import { foodRoutes } from "./routes/food";
import { agentRoutes } from "./routes/agent";
import { metricsRoutes } from "./routes/metrics";

const { port } = config;

// 初始化引擎运行时（Redis 会话/缓存/遥测），失败自动降级内存
await getRuntime();

/**
 * 静态资源服务
 *
 * 菜品图片存放于 `a2ui-server2/public/images/`，
 * 通过 `/images/*` 对外提供，供 A2UI 的 Image / Carousel 组件直接引用。
 *
 * 注意：staticPlugin 是异步的（返回 Promise），必须在 listen 之前 await。
 */
const assets = await staticPlugin({
  // prefix 会被削去后再拼到 assets 下，故 assets 直接指向图片目录
  assets: `${import.meta.dir}/../public/images`,
  prefix: "/images",
  // 文件名带固定后缀，可长期缓存
  maxAge: 60 * 60 * 24 * 7,
  etag: true,
});

const app = new Elysia()
  .use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .use(assets)
  .use(authPlugin) // 认证基础设施，全局只注册一次
  .use(authRoutes(authPlugin)) // 传实例给路由模块，复用其装饰器与 resolve
  .use(foodRoutes(authPlugin))
  .use(agentRoutes)
  .use(metricsRoutes)
  .get("/health", () => ({ ok: true }))
  .listen({ port, hostname: "0.0.0.0" });

console.log(`Server running at http://localhost:${app.server?.port ?? port}`);
console.log(`静态图片:     http://localhost:${app.server?.port ?? port}/images/dish-burger.jpg`);
