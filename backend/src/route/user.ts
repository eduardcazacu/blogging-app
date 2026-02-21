import { Hono, type Context, type Next } from "hono";
import { sign, verify } from "hono/jwt";
import { signinInput, signupInput } from "@blogging-app/common";
import { getConfig } from "../env";
import { getDb } from "../db";

type UserRouteEnv = {
	Bindings: {
		DATABASE_URL?: string,
		JWT_SECRET?: string,
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
		const { databaseUrl, jwtSecret } = getConfig(c);
		const db = getDb(databaseUrl);

		const users = await db<{ id: number }[]>`
      INSERT INTO users (email, password, name)
      VALUES (${parsed.data.email}, ${parsed.data.password}, ${parsed.data.name ?? null})
      RETURNING id
    `;
		const user = users[0];

    const jwt = await sign({ id: user.id }, jwtSecret, "HS256")
    return c.text(jwt);
	
  } catch(e: unknown) {
		console.error(e);
		const code = (e as { code?: string })?.code;
		if (code === "23505") {
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
		const db = getDb(databaseUrl);

		const users = await db<{ id: number }[]>`
      SELECT id
      FROM users
      WHERE email = ${parsed.data.email} AND password = ${parsed.data.password}
      LIMIT 1
    `;
		const user = users[0];
	
		if (!user) {
			c.status(403); //unauthorised
			return c.json({ msg: "Incorrect credentials" });
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
		const db = getDb(databaseUrl);
		const userId = c.get("userId");
		const users = await db<{
			id: number;
			email: string;
			name: string | null;
			bio: string;
		}[]>`
      SELECT id, email, name, bio
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;
		const user = users[0];
		if (!user) {
			c.status(404);
			return c.json({ msg: "User not found" });
		}
		return c.json({ user });
	} catch (e) {
		console.error(e);
		c.status(500);
		return c.json({ msg: "Failed to load profile" });
	}
});

userRouter.put("/me", async (c) => {
	try {
		const body = await c.req.json();
		const bio = typeof body?.bio === "string" ? body.bio.trim() : "";
		if (bio.length > 100) {
			c.status(400);
			return c.json({ msg: "Bio must be 100 characters or less" });
		}
		const { databaseUrl } = getConfig(c);
		const db = getDb(databaseUrl);
		const userId = c.get("userId");
		const users = await db<{ id: number; name: string | null; bio: string }[]>`
      UPDATE users
      SET bio = ${bio}
      WHERE id = ${userId}
      RETURNING id, name, bio
    `;
		const user = users[0];
		if (!user) {
			c.status(404);
			return c.json({ msg: "User not found" });
		}
		return c.json({ user });
	} catch (e) {
		console.error(e);
		c.status(500);
		return c.json({ msg: "Failed to update profile" });
	}
});
