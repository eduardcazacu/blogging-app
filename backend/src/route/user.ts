import { Hono, type Context, type Next } from "hono";
import { Prisma } from "@prisma/client";
import { sign, verify } from "hono/jwt";
import { signinInput, signupInput } from "@blogging-app/common";
import { getConfig } from "../env";
import { getAdminEmails, isAdminEmail } from "../admin-config";
import { getPrismaClient } from "../prisma";

type UserRouteEnv = {
	Bindings: {
		DATABASE_URL?: string,
		JWT_SECRET?: string,
		ADMIN_EMAILS?: string,
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
		const requestedStatus = isAdminEmail(parsed.data.email, adminEmails)
			? "approved"
			: "pending";

		const user = await prisma.user.create({
			data: {
				email: parsed.data.email,
				password: parsed.data.password,
				name: parsed.data.name ?? null,
				status: requestedStatus
			},
			select: {
				id: true
			}
		});
		if (requestedStatus === "approved") {
			return c.json({
				msg: "Admin account created and approved.",
				userId: user.id
			});
		}
		return c.json({
			msg: "Account request submitted. An admin must approve your account before you can sign in.",
			userId: user.id
		});
	
  } catch(e: unknown) {
		console.error(e);
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
				email: parsed.data.email,
				password: parsed.data.password
			},
			select: {
				id: true,
				status: true
			}
		});
	
		if (!user) {
			c.status(403); //unauthorised
			return c.json({ msg: "Incorrect credentials" });
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
