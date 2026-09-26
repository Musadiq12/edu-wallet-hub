import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  forgotPasswordSchema,
  loginSchema,
  profileUpdateSchema,
  resetPasswordSchema,
  safeAuthError,
  signupSchema,
} from "@/lib/auth-validation";

type AuthResult = { ok: true; data?: unknown } | Response;

function genericAuthFailure() {
  return safeAuthError();
}

async function getAccessToken() {
  const header = await getRequestHeader("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token && token.split(".").length === 3 ? token : null;
}

async function getAuthenticatedUser() {
  const token = await getAccessToken();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export const signupServer = createServerFn({ method: "POST" })
  .handler(async ({ data }): Promise<AuthResult> => {
    const parsed = signupSchema.safeParse(data);
    if (!parsed.success) return genericAuthFailure();

    const email = parsed.data.email.toLowerCase();
    const redirectTo = typeof parsed.data === "object" && parsed.data && "redirectTo" in parsed.data
      ? undefined
      : undefined;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: false,
      user_metadata: {
        full_name: parsed.data.full_name,
        whatsapp: parsed.data.whatsapp || null,
        ...(parsed.data.username ? { username: parsed.data.username } : {}),
      },
    });

    if (error || !created.user) return genericAuthFailure();

    return { ok: true, data: { userId: created.user.id, email: created.user.email, redirectTo } };
  });

export const loginServer = createServerFn({ method: "POST" })
  .handler(async ({ data }): Promise<AuthResult> => {
    const parsed = loginSchema.safeParse(data);
    if (!parsed.success) return genericAuthFailure();

    // Validate input server-side before authentication. Actual session creation
    // remains client-side via Supabase; malformed requests never reach auth.
    return { ok: true };
  });

export const forgotPasswordServer = createServerFn({ method: "POST" })
  .handler(async ({ data }): Promise<AuthResult> => {
    const parsed = forgotPasswordSchema.safeParse(data);
    if (!parsed.success) return genericAuthFailure();
    return { ok: true };
  });

export const resetPasswordServer = createServerFn({ method: "POST" })
  .handler(async ({ data }): Promise<AuthResult> => {
    const parsed = resetPasswordSchema.safeParse(data);
    if (!parsed.success) return genericAuthFailure();

    const user = await getAuthenticatedUser();
    if (!user) return genericAuthFailure();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: parsed.data.password,
    });
    if (error) return genericAuthFailure();

    return { ok: true };
  });

export const updateProfileServer = createServerFn({ method: "POST" })
  .handler(async ({ data }): Promise<AuthResult> => {
    const parsed = profileUpdateSchema.safeParse(data);
    if (!parsed.success) return genericAuthFailure();

    const user = await getAuthenticatedUser();
    if (!user) return genericAuthFailure();

    const metadata: Record<string, unknown> = {};
    if (parsed.data.full_name !== undefined) metadata.full_name = parsed.data.full_name;
    if (parsed.data.display_name !== undefined) metadata.display_name = parsed.data.display_name;
    if (parsed.data.bio !== undefined) metadata.bio = parsed.data.bio;
    if (parsed.data.username !== undefined) metadata.username = parsed.data.username;
    if (parsed.data.whatsapp !== undefined) metadata.whatsapp = parsed.data.whatsapp || null;

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: metadata,
    });
    if (authError) return genericAuthFailure();

    const profileUpdate: Record<string, unknown> = {};
    if (parsed.data.full_name !== undefined) profileUpdate.full_name = parsed.data.full_name || null;
    if (parsed.data.whatsapp !== undefined) profileUpdate.whatsapp = parsed.data.whatsapp || null;

    if (Object.keys(profileUpdate).length) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", user.id);
      if (profileError) return genericAuthFailure();
    }

    return { ok: true };
  });
