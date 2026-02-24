import { Hono, type Context, type Next } from "hono";
import { Prisma } from "@prisma/client";
import { sign, verify } from "hono/jwt";
import { signinInput, signupInput } from "@blogging-app/common";
import z from "zod";
import { getConfig } from "../env";
import { getAdminEmails, isAdminEmail } from "../admin-config";
import { getPrismaClient } from "../prisma";
import {
	generateVerificationToken,
	getVerificationExpiryDate,
	normalizeEmail,
	RESEND_COOLDOWN_MS,
	VERIFICATION_TOKEN_TTL_MS,
	sha256Hex
} from "../verification";
import { sendVerificationEmail } from "../email";

type UserRouteEnv = {
	Bindings: {
		DATABASE_URL?: string,
		JWT_SECRET?: string,
		ADMIN_EMAILS?: string,
		RESEND_API_KEY?: string,
		EMAIL_FROM?: string,
		FRONTEND_URL?: string,
	},
	Variables: {
		userId: number
	},
};

export const userRouter = new Hono<UserRouteEnv>();

const profileAuthMiddleware = async (c: Context<UserRouteEnv>, next: Next) => {
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
			error: e instanceof Error ? e.message : "Invalid token"
		});
	}
};

userRouter.use("/me", profileAuthMiddleware);
userRouter.use("/me/*", profileAuthMiddleware);

const verifyEmailInput = z.object({
	email: z.string().email(),
	token: z.string().min(10),
});

const resendVerificationInput = z.object({
	email: z.string().email(),
});

userRouter.post('/signup', async (c) => {
	try {
		const body = await c.req.json();
		const parsed = signupInput.safeParse(body);
		if(!parsed.success){
			c.status(400);
			return c.json({
				msg: "Inputs are incorrect",
				errors: parsed.error.flatten()
			})
		}
		const adminEmails = getAdminEmails(c);
		const { databaseUrl } = getConfig(c);
		const prisma = getPrismaClient(databaseUrl);
		const resendApiKey = c.env?.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
		const emailFrom = c.env?.EMAIL_FROM ?? process.env.EMAIL_FROM;
		const frontendUrl = c.env?.FRONTEND_URL ?? process.env.FRONTEND_URL ?? "http://localhost:5173";
		if (!resendApiKey || !emailFrom) {
			throw new Error("RESEND_API_KEY and EMAIL_FROM are required for signup");
		}

		const normalizedEmail = normalizeEmail(parsed.data.email);
		const requestedStatus = isAdminEmail(parsed.data.email, adminEmails)
			? "approved"
			: "pending";
		const verificationToken = generateVerificationToken();
		const verificationTokenHash = await sha256Hex(verificationToken);
		const verificationExpiry = getVerificationExpiryDate();

		const user = await prisma.user.create({
			data: {
				email: normalizedEmail,
				password: parsed.data.password,
				name: parsed.data.name ?? null,
				status: requestedStatus,
				emailVerificationTokenHash: verificationTokenHash,
				emailVerificationExpiresAt: verificationExpiry,
			},
			select: {
				id: true,
				name: true,
			}
		});

		const verificationUrl = new URL("/verify-email", frontendUrl);
		verificationUrl.searchParams.set("token", verificationToken);
		verificationUrl.searchParams.set("email", normalizedEmail);

		try {
			await sendVerificationEmail({
				apiKey: resendApiKey,
				from: emailFrom,
				to: normalizedEmail,
				appName: "Eddie's Lounge",
				verificationUrl: verificationUrl.toString(),
				recipientName: user.name,
			});
		} catch (emailError) {
			console.error(emailError);
			return c.json({
				msg: "Account created, but verification email could not be sent. Use resend verification after fixing email configuration.",
				userId: user.id
			});
		}

		return c.json({
			msg: requestedStatus === "approved"
				? "Account created. Please verify your email before signing in."
				: "Account request submitted. Verify your email, then wait for admin approval.",
			userId: user.id
		});
	
  } catch(e: unknown) {
		console.error(e);
		if (e instanceof Error && e.message.includes("RESEND_API_KEY and EMAIL_FROM are required")) {
			c.status(500);
			return c.json({ msg: "Server email configuration is missing. Set RESEND_API_KEY and EMAIL_FROM." });
		}
		if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
			c.status(409);
			return c.json({ msg: "Email already exists" });
		}
		c.status(500);
		return c.json({ msg: "Failed to create user" });
	}
})

userRouter.post('/signin', async (c) => {
	
	try {
		const body = await c.req.json();
		const parsed = signinInput.safeParse(body);
		if(!parsed.success){
			c.status(400);
			return c.json({
				msg: "Inputs are incorrect",
				errors: parsed.error.flatten()
			})
		}
		const { databaseUrl, jwtSecret } = getConfig(c);
		const prisma = getPrismaClient(databaseUrl);

		const user = await prisma.user.findFirst({
			where: {
				email: normalizeEmail(parsed.data.email),
				password: parsed.data.password
			},
			select: {
				id: true,
				status: true,
				emailVerifiedAt: true,
			}
		});
	
		if (!user) {
			c.status(403); //unauthorised
			return c.json({ msg: "Incorrect credentials" });
		}

		if (!user.emailVerifiedAt) {
			c.status(403);
			return c.json({ msg: "Please verify your email before signing in." });
		}

		if (user.status !== "approved") {
			c.status(403);
			return c.json({ msg: "Your account is pending admin approval." });
		}
	
		const jwt = await sign({ id: user.id }, jwtSecret, "HS256");
		return c.text(jwt);
	
	} catch(e) {
		console.error(e);
		c.status(500);
		return c.json({ msg: "Failed to sign in" })
	}

	})

userRouter.post("/verify-email", async (c) => {
	try {
		const body = await c.req.json();
		const parsed = verifyEmailInput.safeParse(body);
		if (!parsed.success) {
			c.status(400);
			return c.json({
				msg: "Invalid verification request",
				errors: parsed.error.flatten(),
			});
		}

		const { databaseUrl } = getConfig(c);
		const prisma = getPrismaClient(databaseUrl);
		const email = normalizeEmail(parsed.data.email);
		const tokenHash = await sha256Hex(parsed.data.token);
		const now = new Date();

		const user = await prisma.user.findUnique({
			where: {
				email,
			},
			select: {
				id: true,
				emailVerifiedAt: true,
				emailVerificationTokenHash: true,
				emailVerificationExpiresAt: true,
			},
		});

		if (!user) {
			c.status(400);
			return c.json({ msg: "Invalid or expired verification link." });
		}

		if (user.emailVerifiedAt) {
			return c.json({ msg: "Email already verified. You can sign in." });
		}

		const tokenMatches = user.emailVerificationTokenHash === tokenHash;
		const tokenExpired =
			!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < now;
		if (!tokenMatches || tokenExpired) {
			c.status(400);
			return c.json({ msg: "Invalid or expired verification link." });
		}

		await prisma.user.update({
			where: {
				id: user.id,
			},
			data: {
				emailVerifiedAt: now,
				emailVerificationTokenHash: null,
				emailVerificationExpiresAt: null,
			},
		});

		return c.json({ msg: "Email verified. You can now sign in." });
	} catch (e) {
		console.error(e);
		c.status(500);
		return c.json({ msg: "Failed to verify email" });
	}
});

userRouter.post("/resend-verification", async (c) => {
	try {
		const body = await c.req.json();
		const parsed = resendVerificationInput.safeParse(body);
		if (!parsed.success) {
			c.status(400);
			return c.json({
				msg: "Invalid email",
				errors: parsed.error.flatten(),
			});
		}

		const resendApiKey = c.env?.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
		const emailFrom = c.env?.EMAIL_FROM ?? process.env.EMAIL_FROM;
		const frontendUrl = c.env?.FRONTEND_URL ?? process.env.FRONTEND_URL ?? "http://localhost:5173";
		if (!resendApiKey || !emailFrom) {
			throw new Error("RESEND_API_KEY and EMAIL_FROM are required for resend");
		}

		const { databaseUrl } = getConfig(c);
		const prisma = getPrismaClient(databaseUrl);
		const email = normalizeEmail(parsed.data.email);

		const user = await prisma.user.findUnique({
			where: {
				email,
			},
			select: {
				id: true,
				name: true,
				emailVerifiedAt: true,
				emailVerificationExpiresAt: true,
			},
		});

		if (!user || user.emailVerifiedAt) {
			return c.json({
				msg: "If your account exists and is unverified, a verification email has been sent.",
			});
		}

		const now = Date.now();
		const lastSentAtMs = user.emailVerificationExpiresAt
			? user.emailVerificationExpiresAt.getTime() - VERIFICATION_TOKEN_TTL_MS
			: 0;
		const elapsedMs = now - lastSentAtMs;
		if (lastSentAtMs > 0 && elapsedMs < RESEND_COOLDOWN_MS) {
			const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000);
			c.status(429);
			return c.json({
				msg: `Please wait ${retryAfterSeconds}s before requesting another verification email.`,
				retryAfterSeconds,
			});
		}

		const verificationToken = generateVerificationToken();
		const verificationTokenHash = await sha256Hex(verificationToken);
		const verificationExpiry = getVerificationExpiryDate();

		await prisma.user.update({
			where: {
				id: user.id,
			},
			data: {
				emailVerificationTokenHash: verificationTokenHash,
				emailVerificationExpiresAt: verificationExpiry,
			},
		});

		const verificationUrl = new URL("/verify-email", frontendUrl);
		verificationUrl.searchParams.set("token", verificationToken);
		verificationUrl.searchParams.set("email", email);

		await sendVerificationEmail({
			apiKey: resendApiKey,
			from: emailFrom,
			to: email,
			appName: "Eddie's Lounge",
			verificationUrl: verificationUrl.toString(),
			recipientName: user.name,
		});

		return c.json({
			msg: "If your account exists and is unverified, a verification email has been sent.",
		});
	} catch (e) {
		console.error(e);
		c.status(500);
		return c.json({ msg: "Failed to resend verification email" });
	}
});

userRouter.get("/me", async (c) => {
	try {
		const { databaseUrl } = getConfig(c);
		const prisma = getPrismaClient(databaseUrl);
		const userId = c.get("userId");
		const user = await prisma.user.findUnique({
			where: {
				id: userId
			},
			select: {
				id: true,
				email: true,
				name: true,
				bio: true
			}
		});
		if (!user) {
			c.status(404);
			return c.json({ msg: "User not found" });
		}
		const isAdmin = isAdminEmail(user.email, getAdminEmails(c));
		return c.json({ user: { ...user, isAdmin } });
	} catch (e) {
		console.error(e);
		c.status(500);
		return c.json({ msg: "Failed to load profile" });
	}
});

userRouter.put("/me", async (c) => {
	try {
		const { databaseUrl } = getConfig(c);
		const prisma = getPrismaClient(databaseUrl);
		const body = await c.req.json();
		const bio = typeof body?.bio === "string" ? body.bio.trim() : "";
		if (bio.length > 100) {
			c.status(400);
			return c.json({ msg: "Bio must be 100 characters or less" });
		}
		const userId = c.get("userId");
		try {
			const user = await prisma.user.update({
				where: {
					id: userId
				},
				data: {
					bio
				},
				select: {
					id: true,
					name: true,
					bio: true
				}
			});
			return c.json({ user });
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
		return c.json({ msg: "Failed to update profile" });
	}
});
