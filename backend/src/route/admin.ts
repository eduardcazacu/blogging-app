import { Hono } from "hono";
import { verify } from "hono/jwt";
import { Prisma } from "@prisma/client";
import { getConfig } from "../env";
import { getAdminEmails, isAdminEmail } from "../admin-config";
import { getPrismaClient } from "../prisma";
import { sendWelcomeEmail } from "../email";

type AdminEnv = {
  Bindings: {
    DATABASE_URL?: string;
    JWT_SECRET?: string;
    ADMIN_EMAILS?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    FRONTEND_URL?: string;
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

    const { databaseUrl, jwtSecret } = getConfig(c);
    const prisma = getPrismaClient(databaseUrl);
    const payload = await verify(token, jwtSecret, "HS256");
    const userId = Number(payload?.id);
    if (!Number.isFinite(userId)) {
      c.status(403);
      return c.json({ msg: "Token payload is missing a valid user id" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
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
    const prisma = getPrismaClient(databaseUrl);
    const users = await prisma.user.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return c.json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
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
    const prisma = getPrismaClient(databaseUrl);
    const adminId = c.get("userId");
    const resendApiKey = c.env?.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
    const emailFrom = c.env?.EMAIL_FROM ?? process.env.EMAIL_FROM;
    const frontendUrl = c.env?.FRONTEND_URL ?? process.env.FRONTEND_URL ?? "http://localhost:5173";

    const existingUser = await prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    });

    if (!existingUser) {
      c.status(404);
      return c.json({ msg: "User not found" });
    }

    const wasApproved = existingUser.status === "approved";
    const user = await prisma.user.update({
      where: { id: targetId },
      data: {
        status: "approved",
        approvedBy: adminId,
      },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    if (wasApproved) {
      return c.json({ msg: "User is already approved", user });
    }

    if (!resendApiKey || !emailFrom) {
      return c.json({
        msg: "User approved, but welcome email was skipped (missing RESEND_API_KEY or EMAIL_FROM).",
        user,
      });
    }

    const signinUrl = new URL("/signin", frontendUrl).toString();

    try {
      await sendWelcomeEmail({
        apiKey: resendApiKey,
        from: emailFrom,
        to: existingUser.email,
        appName: "Eddie's Lounge",
        recipientName: existingUser.name,
        signinUrl,
      });
      return c.json({ msg: "User approved and welcome email sent", user });
    } catch (emailError) {
      console.error(emailError);
      return c.json({
        msg: "User approved, but failed to send welcome email.",
        user,
      });
    }
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
    const prisma = getPrismaClient(databaseUrl);
    try {
      const user = await prisma.user.update({
        where: { id: targetId },
        data: { status: "rejected" },
        select: {
          id: true,
          email: true,
          status: true,
        },
      });
      return c.json({ msg: "User rejected", user });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        c.status(404);
        return c.json({ msg: "User not found" });
      }
      throw e;
    }
  } catch (e) {
    console.error(e);
    c.status(500);
    return c.json({ msg: "Failed to reject user" });
  }
});
