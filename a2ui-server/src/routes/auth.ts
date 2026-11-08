import { Elysia, t } from "elysia";
import { db } from "../prisma/db.ts";
import type { AuthPlugin } from "../plugins/auth-plugin";
import { loginSchema, registerSchema } from "../schemas/auth.ts";

/**
 * 认证路由
 *
 * 接收共享的 `authPlugin`（含 bearer / jwt / user 装饰器），
 * 本模块不重复注册依赖，只声明路由。
 *
 * 凭证通过 `Authorization: Bearer <token>` 传递（暂不使用 httpOnly cookie）。
 *
 * ### 认证相关路由
 *
 */

const TOKEN_TTL = "1h";
const REFRESH_TTL = "7d";
const REFRESH_MARKER = "refresh";

const isUniqueViolation = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.toUpperCase().includes("UNIQUE");
};
/**
 * ## e2e test
 * 1. 测试完整数据写入 ✅
 * ```ps
 * curl -X POST -H "Content-Type: application/json" `
 *  -d '{"name":"json", "email":"test@example.com", "password":"234"}' `
 * http://localhost:3000/auth/register
 * ```
 * > {"id":"421b9d44-79bd-4087-ae90-e5e74e03d38e","email":"test@example.com","name":"json"}
 * 2. 测试zod.email()校验
 * ```ps
 * curl -X POST -H "Content-Type: application/json" `
 *  -d '{"name":"json", "email":"test", "password":"234"}' `
 * http://localhost:3000/auth/register
 * ```
 * > { .., message: "Invalid email address"}
 */
export const authRoutes = (auth: AuthPlugin) =>
  new Elysia({ name: "auth-routes", prefix: "/auth" })
    .use(auth)

    .post(
      "/register",
      async ({ body, status }) => {
        const email = body.email.trim().toLowerCase();

        // 先查重给出明确业务错误，同时依赖 DB 唯一约束兜底并发注册
        const existing = await db.orm.public.User.select("id")
          .where({ email })
          .first();

        if (existing) return status(409, { error: "Email already registered" });

        try {
          const user = await db.orm.public.User.create({
            email,
            password: await Bun.password.hash(body.password), // 使用bun提供的hash方法进行加密
            name: body.name ?? null,
          });

          return { id: String(user.id), email: user.email, name: user.name };
        } catch (error) {
          if (isUniqueViolation(error)) {
            return status(409, { error: "Email already registered" }); // ✅, 测试成功
          }
          throw error;
        }
      },
      {
        body: registerSchema,
      },
    )

    /**
     * ## e2e test
     * > "/login"
     */
    .post(
      "/login",
      async ({ body, jwt, status }) => {
        const email = body.email.trim().toLowerCase();

        // 登录需要取 password；其余接口刻意不 select 它
        const user = await db.orm.public.User.select(
          "id",
          "email",
          "name",
          "password",
        )
          .where({ email })
          .first();

        // 账号不存在与密码错误返回同一提示，避免枚举账号
        if (!user) return status(401, { error: "Invalid email or password" });

        const valid = await Bun.password.verify(body.password, user.password);
        if (!valid) return status(401, { error: "Invalid email or password" });

        const claims = { sub: String(user.id), email: user.email };

        const [accessToken, refreshToken] = await Promise.all([
          jwt.sign({ ...claims, iat: true, exp: TOKEN_TTL }),
          jwt.sign({
            ...claims,
            iat: true,
            exp: REFRESH_TTL,
            tokenType: REFRESH_MARKER,
          }),
        ]);

        return {
          accessToken,
          refreshToken,
          tokenType: "Bearer",
          expiresIn: TOKEN_TTL,
        };
      },
      {
        body: loginSchema,
      },
    )

    // -------------------------------------------------------- 当前用户
    .get("/me", async ({ user: claims, status }) => {
      // authPlugin 已尽力解析 token，这里负责强制校验
      if (!claims) return status(401, "Missing or invalid token");

      const userId = typeof claims.sub === "string" ? claims.sub : undefined;
      if (!userId) return status(401, "Invalid token payload");

      const user = await db.orm.public.User.select(
        "id",
        "email",
        "name",
        "avatar",
        "phone",
        "createdAt",
      )
        .where({ id: userId })
        .first();

      if (!user) return status(404, "User not found");

      return {
        id: String(user.id),
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        phone: user.phone,
        createdAt: user.createdAt,
      };
    })

    // ------------------------------------------------------------ 刷新
    .post(
      "/refresh",
      async ({ body, jwt, status }) => {
        const claims = await jwt.verify(body.refreshToken);

        // verify 失败返回 false；同时拒绝用 access token 冒充 refresh token
        if (!claims || claims.tokenType !== REFRESH_MARKER) {
          return status(401, "Invalid or expired refresh token");
        }

        const userId = typeof claims.sub === "string" ? claims.sub : undefined;
        if (!userId) return status(401, "Invalid token payload");

        // 确认用户仍存在，并以数据库中的最新邮箱重新签发
        const user = await db.orm.public.User.select("id", "email")
          .where({ id: userId })
          .first();

        if (!user) return status(401, "User no longer exists");

        const nextClaims = { sub: String(user.id), email: user.email };

        const [accessToken, refreshToken] = await Promise.all([
          jwt.sign({ ...nextClaims, iat: true, exp: TOKEN_TTL }),
          jwt.sign({
            ...nextClaims,
            iat: true,
            exp: REFRESH_TTL,
            tokenType: REFRESH_MARKER,
          }),
        ]);

        return {
          accessToken,
          refreshToken,
          tokenType: "Bearer",
          expiresIn: TOKEN_TTL,
        };
      },
      {
        body: t.Object({
          refreshToken: t.String({ minLength: 1 }),
        }),
      },
    );
