import { Hono } from "hono";
import { verify } from "hono/jwt";
import { Prisma } from "@prisma/client";
import { getConfig } from "../env";
import { getAdminEmails, isAdminEmail } from "../admin-config";
import { getPrismaClient } from "../prisma";
import { sendBroadcastEmail, sendWelcomeEmail } from "../email";
import { sendBroadcastNotification } from "../push";
import z from "zod";

type AdminEnv = {
  Bindings: {
    DATABASE_URL?: string;
    JWT_SECRET?: string;
    ADMIN_EMAILS?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    FRONTEND_URL?: string;
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT?: string;
  };
  Variables: {
    userId: number;
    adminEmail: string;
  };
};

export const adminRouter = new Hono<AdminEnv>();

const broadcastNotificationInput = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
});

const broadcastEmailInput = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
});

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

adminRouter.get("/stats", async (c) => {
  try {
    const { databaseUrl } = getConfig(c);
    const prisma = getPrismaClient(databaseUrl);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalPosts,
      postAuthors,
      commentAuthors,
      postLikers,
      commentLikers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.post.findMany({
        where: { createdAt: { gte: since } },
        select: { authorId: true },
        distinct: ["authorId"],
      }),
      prisma.comment.findMany({
        where: { createdAt: { gte: since } },
        select: { authorId: true },
        distinct: ["authorId"],
      }),
      prisma.postLike.findMany({
        where: { createdAt: { gte: since } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.commentLike.findMany({
        where: { createdAt: { gte: since } },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);

    // A user is "monthly active" if they posted, commented, or liked anything
    // (post or comment) within the last 30 days.
    const activeUserIds = new Set<number>();
    for (const row of postAuthors) activeUserIds.add(row.authorId);
    for (const row of commentAuthors) activeUserIds.add(row.authorId);
    for (const row of postLikers) activeUserIds.add(row.userId);
    for (const row of commentLikers) activeUserIds.add(row.userId);

    return c.json({
      stats: {
        totalUsers,
        totalPosts,
        monthlyActiveUsers: activeUserIds.size,
      },
    });
  } catch (e) {
    console.error(e);
    c.status(500);
    return c.json({ msg: "Failed to load stats" });
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

adminRouter.get("/email/recipients", async (c) => {
  try {
    const { databaseUrl } = getConfig(c);
    const prisma = getPrismaClient(databaseUrl);
    const recipients = await prisma.user.findMany({
      where: { status: "approved" },
      orderBy: { email: "asc" },
      select: { id: true, email: true, name: true },
    });

    return c.json({ recipients });
  } catch (e) {
    console.error(e);
    c.status(500);
    return c.json({ msg: "Failed to load email recipients" });
  }
});

adminRouter.post("/email/broadcast", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = broadcastEmailInput.safeParse(body);
    if (!parsed.success) {
      c.status(400);
      return c.json({
        msg: "Invalid broadcast email payload",
        errors: parsed.error.flatten(),
      });
    }

    const resendApiKey = c.env?.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
    const emailFrom = c.env?.EMAIL_FROM ?? process.env.EMAIL_FROM;
    if (!resendApiKey || !emailFrom) {
      c.status(400);
      return c.json({
        msg: "Email broadcast is not configured (missing RESEND_API_KEY or EMAIL_FROM).",
      });
    }

    const { databaseUrl } = getConfig(c);
    const prisma = getPrismaClient(databaseUrl);
    const recipients = await prisma.user.findMany({
      where: { status: "approved" },
      select: { email: true, name: true },
    });

    if (recipients.length === 0) {
      c.status(400);
      return c.json({ msg: "No approved users available for broadcast." });
    }

    const result = await sendBroadcastEmail({
      apiKey: resendApiKey,
      from: emailFrom,
      appName: "Eddie's Lounge",
      subject: parsed.data.subject,
      markdownBody: parsed.data.body,
      recipients,
    });

    if (result.delivered === 0) {
      console.error("[admin] email broadcast failed for all recipients", {
        attempted: result.attempted,
        failures: result.failures,
      });
      c.status(502);
      return c.json({
        msg: "Email broadcast failed for all recipients.",
        result: { attempted: result.attempted, delivered: 0, failed: result.failed },
      });
    }

    if (result.failed > 0) {
      console.warn("[admin] email broadcast had partial failures", {
        attempted: result.attempted,
        delivered: result.delivered,
        failed: result.failed,
        failures: result.failures,
      });
    }

    return c.json({
      msg: `Email sent to ${result.delivered} of ${result.attempted} user${result.attempted === 1 ? "" : "s"}.`,
      result: {
        attempted: result.attempted,
        delivered: result.delivered,
        failed: result.failed,
      },
    });
  } catch (e) {
    console.error(e);
    c.status(500);
    return c.json({ msg: "Failed to send broadcast email." });
  }
});

adminRouter.post("/push/broadcast", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = broadcastNotificationInput.safeParse(body);
    if (!parsed.success) {
      c.status(400);
      return c.json({
        msg: "Invalid broadcast notification payload",
        errors: parsed.error.flatten(),
      });
    }

    const { databaseUrl, vapidPublicKey, vapidPrivateKey, vapidSubject } = getConfig(c);
    const result = await sendBroadcastNotification({
      databaseUrl,
      title: parsed.data.title,
      body: parsed.data.body,
      vapidConfig: {
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject,
      },
    });

    return c.json({
      msg: `Broadcast sent to ${result.delivered} device${result.delivered === 1 ? "" : "s"}.`,
      result,
    });
  } catch (e) {
    if (e instanceof Error) {
      const msg = e.message || "Failed to send broadcast notification.";
      if (
        msg.includes("Push notifications are not configured") ||
        msg.includes("No subscribed users available") ||
        msg.includes("Broadcast delivery failed")
      ) {
        c.status(400);
        return c.json({ msg });
      }
    }

    console.error(e);
    c.status(500);
    return c.json({ msg: "Failed to send broadcast notification." });
  }
});
