import { password } from "bun";
import z, { email } from "zod";

const registerSchema = z.object({
  email: z.email(),
  password: z.string(),
  name: z.optional(z.string()),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export { registerSchema, loginSchema };
