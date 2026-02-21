import { Hono } from "hono";
import { verify } from 'hono/jwt'
import { createBlogInput, updateBlogInput } from "@blogging-app/common";
import { getConfig } from "../env";
import { getDb } from "../db";

export const blogRouter = new Hono<{
	Bindings: {
		DATABASE_URL?: string,
		JWT_SECRET?: string,
	},
    Variables: {
        userId: number
    }
}>();

blogRouter.use("/*", async (c, next) => {
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
        const user = await verify(token, jwtSecret, "HS256");
        const userId = Number(user?.id);
        if(Number.isFinite(userId)){
            c.set("userId", userId);
            return await next();
        }
        else{
            c.status(403) //unauthorized
            return c.json({
                msg: "Token payload is missing a valid user id"
            })
        }
    } catch(e){
        c.status(403) //unauthorized
        return c.json({
            msg: "You are not logged in",
            error: e instanceof Error ? e.message : "Invalid token"
        })
    }
    
});

  blogRouter.post('/',async (c) => {
    const body = await c.req.json()
    const { success } = createBlogInput.safeParse(body)
    if(!success){
        c.status(411);
        return c.json({
            msg: "Inputs are Incorrect"
        })
    }
    const authorId = c.get("userId")
    const { databaseUrl } = getConfig(c);
    const db = getDb(databaseUrl);
    const posts = await db<{ id: number }[]>`
      INSERT INTO posts (title, content, author_id)
      VALUES (${body.title}, ${body.content}, ${authorId})
      RETURNING id
    `;
    const blog = posts[0];
        return c.json({
            id: blog.id
        })
    })
  
  blogRouter.put('/',async (c) => {
    const body = await c.req.json()
    const { success } = updateBlogInput.safeParse(body)
    if(!success){
        c.status(411);
        return c.json({
            msg: "Inputs are Incorrect"
        })
    }
    const authorId = c.get("userId")
    const { databaseUrl } = getConfig(c);
    const db = getDb(databaseUrl);
    const posts = await db<{ id: number }[]>`
      UPDATE posts
      SET title = ${body.title}, content = ${body.content}
      WHERE id = ${body.id} AND author_id = ${authorId}
      RETURNING id
    `;
    const blog = posts[0];
    if (!blog) {
      c.status(404);
      return c.json({
        msg: "Blog not found"
      });
    }
        return c.json({
            id: blog.id
        })
    })

    //TODO pagination
    blogRouter.get('/bulk',async (c) => {
        const { databaseUrl } = getConfig(c);
        const db = getDb(databaseUrl);
        const blogs = await db<{
          content: string;
          title: string;
          id: number;
          author_name: string | null;
          author_bio: string;
          created_at: Date;
        }[]>`
          SELECT p.id, p.title, p.content, p.created_at, u.name AS author_name, u.bio AS author_bio
          FROM posts p
          INNER JOIN users u ON u.id = p.author_id
          ORDER BY p.id DESC
        `;

        return c.json({
            blogs: blogs.map((blog) => ({
              id: blog.id,
              title: blog.title,
              content: blog.content,
              createdAt: blog.created_at.toISOString(),
              author: {
                name: blog.author_name,
                bio: blog.author_bio
              }
            }))
        })
    })
  
  blogRouter.get('/:id',async (c) => {
    const id = Number(c.req.param("id"))
    if (!Number.isFinite(id)) {
      c.status(400);
      return c.json({ msg: "Invalid blog id" });
    }
    const { databaseUrl } = getConfig(c);
    const db = getDb(databaseUrl);

    try {
    const blogs = await db<{
      id: number;
      title: string;
      content: string;
      author_name: string | null;
      author_bio: string;
      created_at: Date;
    }[]>`
      SELECT p.id, p.title, p.content, p.created_at, u.name AS author_name, u.bio AS author_bio
      FROM posts p
      INNER JOIN users u ON u.id = p.author_id
      WHERE p.id = ${id}
      LIMIT 1
    `;
    const blog = blogs[0];
    if (!blog) {
      c.status(404);
      return c.json({
        msg: "Blog not found"
      });
    }
        return c.json({
            blog: {
              id: blog.id,
              title: blog.title,
              content: blog.content,
              createdAt: blog.created_at.toISOString(),
              author: {
                name: blog.author_name,
                bio: blog.author_bio
              }
            }
        });
    } catch(e){
        console.error(e);
        c.status(411);
        return c.json({
            msg: "Error while fecthing the blog post"
        })
    }
})
