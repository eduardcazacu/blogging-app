import type { Context } from "hono";

const DEFAULT_ADMINS = [""];

export function getAdminEmails(c: Context<any>) {
  const fromEnv = c.env?.ADMIN_EMAILS ?? process.env.ADMIN_EMAILS;
  if (!fromEnv) {
    return DEFAULT_ADMINS;
  }

  const parsed = fromEnv
    .split(",")
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : DEFAULT_ADMINS;
}

export function isAdminEmail(email: string, admins: string[]) {
  return admins.includes(email.trim().toLowerCase());
}
