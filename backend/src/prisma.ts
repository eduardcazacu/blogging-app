import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type GlobalPrismaCache = {
  prismaByUrl?: Map<string, PrismaClient>;
};

const globalForPrisma = globalThis as unknown as GlobalPrismaCache;

const isCloudflareWorkersRuntime =
  typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

function createPrismaClient(databaseUrl: string) {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export function getPrismaClient(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (isCloudflareWorkersRuntime) {
    // On Workers, avoid sharing a long-lived Node-style pool across requests.
    return createPrismaClient(databaseUrl);
  }

  if (!globalForPrisma.prismaByUrl) {
    globalForPrisma.prismaByUrl = new Map<string, PrismaClient>();
  }

  const existing = globalForPrisma.prismaByUrl.get(databaseUrl);
  if (existing) {
    return existing;
  }

  const client = createPrismaClient(databaseUrl);
  globalForPrisma.prismaByUrl.set(databaseUrl, client);
  return client;
}
