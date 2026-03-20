import type { Context } from "hono";

export type AppEnv = {
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  R2_PUBLIC_BASE_URL?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

export function getConfig(c: Context<any>) {
  const databaseUrl = c.env?.DATABASE_URL ?? process.env.DATABASE_URL;
  const jwtSecret = c.env?.JWT_SECRET ?? process.env.JWT_SECRET;
  const r2PublicBaseUrl = c.env?.R2_PUBLIC_BASE_URL ?? process.env.R2_PUBLIC_BASE_URL;
  const vapidPublicKey = c.env?.VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = c.env?.VAPID_PRIVATE_KEY ?? process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = c.env?.VAPID_SUBJECT ?? process.env.VAPID_SUBJECT;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }

  return { databaseUrl, jwtSecret, r2PublicBaseUrl, vapidPublicKey, vapidPrivateKey, vapidSubject };
}
