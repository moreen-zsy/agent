/**
 * 1. login
 * 2. register
 * 3. me
 * 4. refresh
 * 5
 */

import type z from "zod";
import type { registerSchema, loginSchema } from "../schemas/auth";
import type { Models } from "../prisma/contract";
import { db } from "../prisma/db";
export class authService {
  constructor() {}
  /**
   * 1. 查找email 是否已经注册
   * 2. 使用bun.hash 加密存储
   * ## 关于类型
   * inputType 使用zodSchema , Output使用模型类型。
   * @param regs
   */
  async createUser(
    regs: z.infer<typeof registerSchema>,
  ): Promise<Pick<Models.public_User, "id" | "email" | "name">> {
    const { id, email, name } = await db.transaction(async (tx) => {
      const existing = await tx.orm.public.User.select("id")
        .where({ email: regs.email })
        .first();

      if (existing) {
        throw Error("");
      }
      const user = await tx.orm.public.User.create({
        email: regs.email,
        password: await Bun.password.hash(regs.password),
        name: regs.name ?? null,
      });
      return user;
    });

    return {
      id,
      email,
      name,
    };
  }
  /**
   *
   * ## 登录功能
   * 1. 使用`email` `password`登录
   * 2.
   * @param logs
   */
  async login(logs: z.infer<typeof loginSchema>) {
    // 未来加入检测， 是否多端登录
  }
}
