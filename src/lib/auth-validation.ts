import { z } from "zod";

export const AUTH_ERROR_MESSAGE = "Invalid request.";

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;
const MAX_USERNAME_LENGTH = 32;
const MAX_DISPLAY_NAME_LENGTH = 100;
const MAX_BIO_LENGTH = 500;
const MAX_WHATSAPP_LENGTH = 20;

const emailSchema = z.string()
  .trim()
  .min(3)
  .max(MAX_EMAIL_LENGTH)
  .email()
  .refine((value) => {
    const at = value.lastIndexOf("@");
    if (at <= 0 || at === value.length - 1) return false;
    const domain = value.slice(at + 1).toLowerCase();
    return domain.length <= 253
      && domain.includes(".")
      && !domain.startsWith(".")
      && !domain.endsWith(".")
      && !domain.includes("..")
      && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(domain);
  });

const passwordSchema = z.string()
  .min(8)
  .max(MAX_PASSWORD_LENGTH)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

const usernameSchema = z.string()
  .trim()
  .min(1)
  .max(MAX_USERNAME_LENGTH)
  .regex(/^[A-Za-z0-9_-]+$/);

const freeText = (max: number) => z.string()
  .trim()
  .max(max)
  .transform((value) =>
    value
      .replace(/<[^>]*>/g, "")
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .trim()
  );

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: freeText(MAX_DISPLAY_NAME_LENGTH),
  whatsapp: z.string().trim().max(MAX_WHATSAPP_LENGTH).regex(/^[0-9+()\-\s]+$/).optional().or(z.literal("")),
  username: usernameSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

export const profileUpdateSchema = z.object({
  full_name: freeText(MAX_DISPLAY_NAME_LENGTH).optional(),
  display_name: freeText(MAX_DISPLAY_NAME_LENGTH).optional(),
  bio: freeText(MAX_BIO_LENGTH).optional(),
  username: usernameSchema.optional(),
  whatsapp: z.string().trim().max(MAX_WHATSAPP_LENGTH).regex(/^[0-9+()\-\s]+$/).optional().or(z.literal("")),
});

export const safeAuthError = () => new Response(
  JSON.stringify({ error: AUTH_ERROR_MESSAGE }),
  { status: 400, headers: { "content-type": "application/json" } },
);
