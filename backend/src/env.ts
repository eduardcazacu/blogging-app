import type { Context } from "hono";

export type AppEnv = {
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  R2_PUBLIC_BASE_URL?: string;
};

export function getConfig(c: Context<any>) {
  const databaseUrl = c.env?.DATABASE_URL ?? process.env.DATABASE_URL;
  const jwtSecret = c.env?.JWT_SECRET ?? process.env.JWT_SECRET;
  const r2PublicBaseUrl = c.env?.R2_PUBLIC_BASE_URL ?? process.env.R2_PUBLIC_BASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }

  return { databaseUrl, jwtSecret, r2PublicBaseUrl };
}
