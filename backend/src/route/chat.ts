import { Hono, type Context, type Next } from "hono";
import { verify } from "hono/jwt";
import { createChatMessageInput, chatSettingsInput } from "@blogging-app/common";
import { getConfig } from "../env";
import { getAdminEmails, isAdminEmail } from "../admin-config";
import { getPrismaClient } from "../prisma";
import type { PrismaClient } from "@prisma/client";

type ChatEnv = {
	Bindings: {
		DATABASE_URL?: string,
		JWT_SECRET?: string,
		ADMIN_EMAILS?: string,
		R2_PUBLIC_BASE_URL?: string,
	},
	Variables: {
		userId: number
	}
};

const MESSAGES_PAGE_SIZE = 50;

export const chatRouter = new Hono<ChatEnv>();

function buildPublicImageUrl(baseUrl: string | undefined, key: string | null) {
	if (!baseUrl || !key) {
		return null;
	}
	const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
	return `${normalizedBase}/${key}`;
}

const messageAuthorSelect = {
	id: true,
	content: true,
	createdAt: true,
	author: {
		select: {
			id: true,
			name: true,
			themeKey: true,
			profilePictureKey: true,
		},
	},
} as const;

type MessageWithAuthor = {
	id: number;
	content: string;
	createdAt: Date;
	author: {
		id: number;
		name: string | null;
		themeKey: string;
		profilePictureKey: string | null;
	};
};

function serializeMessage(message: MessageWithAuthor, r2PublicBaseUrl: string | undefined) {
	return {
		id: message.id,
		content: message.content,
		createdAt: message.createdAt.toISOString(),
		author: {
			id: message.author.id,
			name: message.author.name,
			themeKey: message.author.themeKey,
			profilePictureUrl: buildPublicImageUrl(r2PublicBaseUrl, message.author.profilePictureKey),
		},
	};
}

async function getRetentionHours(prisma: PrismaClient) {
	const setting = await prisma.chatSetting.upsert({
		where: { id: 1 },
		update: {},
		create: { id: 1 },
		select: { retentionHours: true },
	});
	return setting.retentionHours;
}

function purgeExpired(c: Context<ChatEnv>, prisma: PrismaClient, cutoff: Date) {
	const work = prisma.chatMessage
		.deleteMany({ where: { createdAt: { lt: cutoff } } })
		.catch((err: unknown) => {
			console.error("Failed to purge expired chat messages", err);
		});
	// On Workers, defer with waitUntil. On Node, accessing executionCtx throws,
	// so fall back to fire-and-forget.
	try {
		const ctx = c.executionCtx;
		if (ctx && typeof ctx.waitUntil === "function") {
			ctx.waitUntil(Promise.resolve(work));
			return;
		}
	} catch {
		// No ExecutionContext (Node runtime).
	}
	void work;
}

chatRouter.use("/*", async (c: Context<ChatEnv>, next: Next) => {
	try {
		const authHeader = c.req.header("Authorization") || "";
		const token = authHeader.startsWith("Bearer ")
			? authHeader.slice("Bearer ".length).trim()
			: authHeader.trim();
		if (!token) {
			c.status(403);
			return c.json({ msg: "Missing authorization token" });
		}
		const { jwtSecret } = getConfig(c);
		const payload = await verify(token, jwtSecret, "HS256");
		const userId = Number(payload?.id);
		if (!Number.isFinite(userId)) {
			c.status(403);
			return c.json({ msg: "Token payload is missing a valid user id" });
		}
		c.set("userId", userId);
		await next();
	} catch (e) {
		c.status(403);
		return c.json({
			msg: "You are not logged in",
			error: e instanceof Error ? e.message : "Invalid token",
		});
	}
});

chatRouter.get("/messages", async (c) => {
	try {
		const { databaseUrl, r2PublicBaseUrl } = getConfig(c);
		const prisma = getPrismaClient(databaseUrl);
		const retentionHours = await getRetentionHours(prisma);
		const cutoff = new Date(Date.now() - retentionHours * 3600_000);

		const sinceParam = Number(c.req.query("since"));
		const since = Number.isFinite(sinceParam) && sinceParam > 0 ? sinceParam : null;

		let messages: MessageWithAuthor[];
		if (since !== null) {
			// Incremental poll: everything newer than the last seen id, oldest first.
			messages = await prisma.chatMessage.findMany({
				where: {
					createdAt: { gt: cutoff },
					id: { gt: since },
				},
				orderBy: { id: "asc" },
				select: messageAuthorSelect,
			});
		} else {
			// Initial load: newest page, then reverse to ascending for display.
			const newest = await prisma.chatMessage.findMany({
				where: { createdAt: { gt: cutoff } },
				orderBy: { id: "desc" },
				take: MESSAGES_PAGE_SIZE,
				select: messageAuthorSelect,
			});
			messages = newest.reverse();
		}

		purgeExpired(c, prisma, cutoff);

		return c.json({
			messages: messages.map((message) => serializeMessage(message, r2PublicBaseUrl)),
			retentionHours,
		});
	} catch (e) {
		console.error(e);
		c.status(500);
		return c.json({ msg: "Failed to load messages" });
	}
});

chatRouter.post("/messages", async (c) => {
	try {
		const body = await c.req.json();
		const parsed = createChatMessageInput.safeParse(body);
		if (!parsed.success) {
			c.status(400);
			return c.json({
				msg: "Invalid message",
				errors: parsed.error.flatten(),
			});
		}

		const { databaseUrl, r2PublicBaseUrl } = getConfig(c);
		const prisma = getPrismaClient(databaseUrl);
		const userId = c.get("userId");

		const message = await prisma.chatMessage.create({
			data: {
				content: parsed.data.content,
				authorId: userId,
			},
			select: messageAuthorSelect,
		});

		const retentionHours = await getRetentionHours(prisma);
		const cutoff = new Date(Date.now() - retentionHours * 3600_000);
		purgeExpired(c, prisma, cutoff);

		return c.json({ message: serializeMessage(message, r2PublicBaseUrl) });
	} catch (e) {
		console.error(e);
		c.status(500);
		return c.json({ msg: "Failed to send message" });
	}
});

chatRouter.get("/settings", async (c) => {
	try {
		const { databaseUrl } = getConfig(c);
		const prisma = getPrismaClient(databaseUrl);
		const retentionHours = await getRetentionHours(prisma);
		return c.json({ retentionHours });
	} catch (e) {
		console.error(e);
		c.status(500);
		return c.json({ msg: "Failed to load chat settings" });
	}
});

chatRouter.put("/settings", async (c) => {
	try {
		const body = await c.req.json();
		const parsed = chatSettingsInput.safeParse(body);
		if (!parsed.success) {
			c.status(400);
			return c.json({
				msg: "Invalid chat settings",
				errors: parsed.error.flatten(),
			});
		}

		const { databaseUrl } = getConfig(c);
		const prisma = getPrismaClient(databaseUrl);
		const userId = c.get("userId");

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});
		if (!user || !isAdminEmail(user.email, getAdminEmails(c))) {
			c.status(403);
			return c.json({ msg: "Admin access required" });
		}

		const setting = await prisma.chatSetting.upsert({
			where: { id: 1 },
			update: { retentionHours: parsed.data.retentionHours },
			create: { id: 1, retentionHours: parsed.data.retentionHours },
			select: { retentionHours: true },
		});

		return c.json({ retentionHours: setting.retentionHours });
	} catch (e) {
		console.error(e);
		c.status(500);
		return c.json({ msg: "Failed to update chat settings" });
	}
});
