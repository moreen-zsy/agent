import { Elysia } from "elysia";
import { jwt } from "@elysia/jwt";
import { bearer } from "@elysia/bearer";
import config from "../config/config_dev";

/**
 * 认证基础设施插件 —— 全局只定义一次
 *
 * 其他路由模块直接 `.use(authPlugin)` 即可获得：
 *   - `bearer`  由 @elysia/bearer 提供
 *   - `jwt`     由 @elysia/jwt 提供
 *   - `user`    认证后的载荷（未认证时为 null）
 *
 * 为什么用 `.resolve()` 而不是 `.macro()`：
 *   Elysia 1.4 的 macro `resolve` 注入不会进入 handler 的 Context 类型，
 *   `{ user }` 会推导失败。`.resolve()` 的返回值则真正参与类型推导，
 *   且在跨模块 `.use()` 时依旧保留。
 *
 * 关于注入时机：
 *   本插件只做「尽力解析」，不直接拒绝请求，因此可安全用于所有路由。
 *   需要强制登录的路由再自行判断 `user` 是否为空。
 */

export const authPlugin = new Elysia({ name: "auth" })
  .use(bearer())
  .use(
    jwt({
      name: "jwt",
      secret: config.JWT.secret,
    }),
  )
  .resolve({ as: "global" }, async ({ bearer, jwt }) => {
    const payload = bearer ? await jwt.verify(bearer) : false;

    return {
      // 解析失败统一视为未登录，交给具体路由决定是否拦截
      user: payload || null,
    };
  });

export type AuthPlugin = typeof authPlugin;
