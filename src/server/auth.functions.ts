import { createServerFn } from "@tanstack/react-start";
import {
  forgotPasswordSchema,
  loginSchema,
  profileUpdateSchema,
  resetPasswordSchema,
  safeAuthError,
  signupSchema,
} from "@/lib/auth-validation";

type AuthResult = { ok: true; data?: unknown } | Response;

export const signupServer = createServerFn({ method: "POST" })
  .validator(signupSchema)
  .handler(async ({ data }): Promise<AuthResult> => ({ ok: true, data }));

export const loginServer = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async (): Promise<AuthResult> => ({ ok: true }));

export const forgotPasswordServer = createServerFn({ method: "POST" })
  .validator(forgotPasswordSchema)
  .handler(async (): Promise<AuthResult> => ({ ok: true }));

export const resetPasswordServer = createServerFn({ method: "POST" })
  .validator(resetPasswordSchema)
  .handler(async ({ data }): Promise<AuthResult> => ({ ok: true, data }));

export const updateProfileServer = createServerFn({ method: "POST" })
  .validator(profileUpdateSchema)
  .handler(async ({ data }): Promise<AuthResult> => ({ ok: true, data }));

export { safeAuthError };
