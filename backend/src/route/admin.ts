import { Hono } from "hono";
import { verify } from "hono/jwt";
import { getConfig } from "../env";
import { getDb } from "../db";
import { getAdminEmails, isAdminEmail } from "../admin-config";

type AdminEnv = {
  Bindings: {
    DATABASE_URL?: string;
    JWT_SECRET?: string;
    ADMIN_EMAILS?: string;
  };
  Variables: {
    userId: number;
    adminEmail: string;
  };
};

export const adminRouter = new Hono<AdminEnv>();

adminRouter.use("/*", async (c, next) => {
  try {
    const authHeader = c.req.header("Authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : authHeader.trim();

    if (!token) {
      c.status(403);
      return c.json({ msg: "Missing authorization token" });
    }

    const { jwtSecret, databaseUrl } = getConfig(c);
    const payload = await verify(token, jwtSecret, "HS256");
    const userId = Number(payload?.id);
    if (!Number.isFinite(userId)) {
      c.status(403);
      return c.json({ msg: "Token payload is missing a valid user id" });
    }

    const db = getDb(databaseUrl);
    const users = await db<{ email: string }[]>`
      SELECT email FROM users WHERE id = ${userId} LIMIT 1
    `;
    const user = users[0];
    if (!user) {
      c.status(403);
      return c.json({ msg: "Invalid user" });
    }

    const adminEmails = getAdminEmails(c);
    if (!isAdminEmail(user.email, adminEmails)) {
      c.status(403);
      return c.json({ msg: "Admin access required" });
    }

    c.set("userId", userId);
    c.set("adminEmail", user.email);
    await next();
  } catch (e) {
    c.status(403);
    return c.json({
      msg: "You are not logged in",
      error: e instanceof Error ? e.message : "Invalid token",
    });
  }
});

adminRouter.get("/pending-users", async (c) => {
  try {
    const { databaseUrl } = getConfig(c);
    const db = getDb(databaseUrl);

    const users = await db<{
      id: number;
      email: string;
      name: string | null;
      created_at: Date;
    }[]>`
      SELECT id, email, name, created_at
      FROM users
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `;

    return c.json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at.toISOString(),
      })),
    });
  } catch (e) {
    console.error(e);
    c.status(500);
    return c.json({ msg: "Failed to load pending users" });
  }
});

adminRouter.put("/approve/:id", async (c) => {
  const targetId = Number(c.req.param("id"));
  if (!Number.isFinite(targetId)) {
    c.status(400);
    return c.json({ msg: "Invalid user id" });
  }

  try {
    const { databaseUrl } = getConfig(c);
    const db = getDb(databaseUrl);
    const adminId = c.get("userId");

    const users = await db<{ id: number; email: string; status: string }[]>`
      UPDATE users
      SET status = 'approved', approved_by = ${adminId}
      WHERE id = ${targetId}
      RETURNING id, email, status
    `;

    const user = users[0];
    if (!user) {
      c.status(404);
      return c.json({ msg: "User not found" });
    }

    return c.json({ msg: "User approved", user });
  } catch (e) {
    console.error(e);
    c.status(500);
    return c.json({ msg: "Failed to approve user" });
  }
});

adminRouter.put("/reject/:id", async (c) => {
  const targetId = Number(c.req.param("id"));
  if (!Number.isFinite(targetId)) {
    c.status(400);
    return c.json({ msg: "Invalid user id" });
  }

  try {
    const { databaseUrl } = getConfig(c);
    const db = getDb(databaseUrl);

    const users = await db<{ id: number; email: string; status: string }[]>`
      UPDATE users
      SET status = 'rejected'
      WHERE id = ${targetId}
      RETURNING id, email, status
    `;

    const user = users[0];
    if (!user) {
      c.status(404);
      return c.json({ msg: "User not found" });
    }

    return c.json({ msg: "User rejected", user });
  } catch (e) {
    console.error(e);
    c.status(500);
    return c.json({ msg: "Failed to reject user" });
  }
});
