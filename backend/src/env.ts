import type { Context } from "hono";

export type AppEnv = {
  DATABASE_URL?: string;
  JWT_SECRET?: string;
};

export function getConfig(c: Context<{ Bindings: AppEnv }>) {
  const databaseUrl = c.env?.DATABASE_URL ?? process.env.DATABASE_URL;
  const jwtSecret = c.env?.JWT_SECRET ?? process.env.JWT_SECRET;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }

  return { databaseUrl, jwtSecret };
}
