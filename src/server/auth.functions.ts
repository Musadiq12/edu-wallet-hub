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
  .validator(signupSchema)
  .handler(async ({ data }): Promise<AuthResult> => {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.password,
      email_confirm: false,
      user_metadata: {
        full_name: data.full_name,
        whatsapp: data.whatsapp || null,
        ...(data.username ? { username: data.username } : {}),
      },
    });

    return error || !created.user ? genericAuthFailure() : { ok: true };
  });

export const loginServer = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async (): Promise<AuthResult> => ({ ok: true }));

export const forgotPasswordServer = createServerFn({ method: "POST" })
  .validator(forgotPasswordSchema)
  .handler(async (): Promise<AuthResult> => ({ ok: true }));

export const resetPasswordServer = createServerFn({ method: "POST" })
  .validator(resetPasswordSchema)
  .handler(async ({ data }): Promise<AuthResult> => {
    const user = await getAuthenticatedUser();
    if (!user) return genericAuthFailure();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.password,
    });
    return error ? genericAuthFailure() : { ok: true };
  });

export const updateProfileServer = createServerFn({ method: "POST" })
  .validator(profileUpdateSchema)
  .handler(async ({ data }): Promise<AuthResult> => {
    const user = await getAuthenticatedUser();
    if (!user) return genericAuthFailure();

    const metadata: Record<string, unknown> = {};
    if (data.full_name !== undefined) metadata.full_name = data.full_name;
    if (data.display_name !== undefined) metadata.display_name = data.display_name;
    if (data.bio !== undefined) metadata.bio = data.bio;
    if (data.username !== undefined) metadata.username = data.username;
    if (data.whatsapp !== undefined) metadata.whatsapp = data.whatsapp || null;

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: metadata,
    });
    if (authError) return genericAuthFailure();

    const profileUpdate: Record<string, unknown> = {};
    if (data.full_name !== undefined) profileUpdate.full_name = data.full_name || null;
    if (data.whatsapp !== undefined) profileUpdate.whatsapp = data.whatsapp || null;

    if (Object.keys(profileUpdate).length) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", user.id);
      if (error) return genericAuthFailure();
    }

    return { ok: true };
  });
