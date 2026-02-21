import { Hono } from "hono";
import { sign } from "hono/jwt";
import { signinInput, signupInput } from "@blogging-app/common";
import { getConfig } from "../env";
import { getDb } from "../db";

export const userRouter = new Hono<{
	Bindings: {
		DATABASE_URL?: string,
		JWT_SECRET?: string,
	}
}>();

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
