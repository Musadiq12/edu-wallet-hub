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

function validator<T extends { safeParse: (input: unknown) => { success: true; data: T extends { safeParse: any } ? never : never } }>(schema: any) {
  return (input: unknown) => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw safeAuthError();
    return parsed.data;
  };
}

export const signupServer = createServerFn({ method: "POST" })
  .validator(validator(signupSchema))
  .handler(async ({ data }): Promise<AuthResult> => ({ ok: true, data }));

export const loginServer = createServerFn({ method: "POST" })
  .validator(validator(loginSchema))
  .handler(async (): Promise<AuthResult> => ({ ok: true }));

export const forgotPasswordServer = createServerFn({ method: "POST" })
  .validator(validator(forgotPasswordSchema))
  .handler(async (): Promise<AuthResult> => ({ ok: true }));

export const resetPasswordServer = createServerFn({ method: "POST" })
  .validator(validator(resetPasswordSchema))
  .handler(async ({ data }): Promise<AuthResult> => ({ ok: true, data }));

export const updateProfileServer = createServerFn({ method: "POST" })
  .validator(validator(profileUpdateSchema))
  .handler(async ({ data }): Promise<AuthResult> => ({ ok: true, data }));
