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

blogRouter.post('/:id/comments', async (c) => {
    const postId = Number(c.req.param("id"));
    if (!Number.isFinite(postId)) {
      c.status(400);
      return c.json({ msg: "Invalid blog id" });
    }

    const body = await c.req.json();
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content) {
      c.status(400);
      return c.json({ msg: "Comment content is required" });
    }

    const authorId = c.get("userId");
    const { databaseUrl } = getConfig(c);
    const db = getDb(databaseUrl);

    try {
      const comments = await db<{
        id: number;
        content: string;
        created_at: Date;
        author_name: string | null;
      }[]>`
        INSERT INTO comments (content, post_id, author_id)
        VALUES (${content}, ${postId}, ${authorId})
        RETURNING id, content, created_at,
          (SELECT name FROM users WHERE id = ${authorId}) AS author_name
      `;
      const comment = comments[0];
      return c.json({
        comment: {
          id: comment.id,
          content: comment.content,
          createdAt: comment.created_at.toISOString(),
          author: {
            name: comment.author_name
          }
        }
      });
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "23503") {
        c.status(404);
        return c.json({ msg: "Blog not found" });
      }
      console.error(e);
      c.status(500);
      return c.json({ msg: "Failed to create comment" });
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
        const blogRows = await db<{
          content: string;
          title: string;
          id: number;
          author_name: string | null;
          author_bio: string;
          comment_count: string | number;
          created_at: Date;
        }[]>`
          SELECT
            p.id,
            p.title,
            p.content,
            p.created_at,
            u.name AS author_name,
            u.bio AS author_bio,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
          FROM posts p
          INNER JOIN users u ON u.id = p.author_id
          ORDER BY p.id DESC
        `;

        const blogs = await Promise.all(
          blogRows.map(async (blog) => {
            const comments = await db<{
              id: number;
              content: string;
              created_at: Date;
              author_name: string | null;
            }[]>`
              SELECT c.id, c.content, c.created_at, u.name AS author_name
              FROM comments c
              INNER JOIN users u ON u.id = c.author_id
              WHERE c.post_id = ${blog.id}
              ORDER BY c.created_at ASC
              LIMIT 3
            `;
            return {
              id: blog.id,
              title: blog.title,
              content: blog.content,
              createdAt: blog.created_at.toISOString(),
              author: {
                name: blog.author_name,
                bio: blog.author_bio
              },
              commentCount: Number(blog.comment_count),
              topComments: comments.map((comment) => ({
                id: comment.id,
                content: comment.content,
                createdAt: comment.created_at.toISOString(),
                author: {
                  name: comment.author_name
                }
              }))
            };
          })
        );

        return c.json({
            blogs
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
    const comments = await db<{
      id: number;
      content: string;
      created_at: Date;
      author_name: string | null;
    }[]>`
      SELECT c.id, c.content, c.created_at, u.name AS author_name
      FROM comments c
      INNER JOIN users u ON u.id = c.author_id
      WHERE c.post_id = ${id}
      ORDER BY c.created_at ASC
    `;
        return c.json({
            blog: {
              id: blog.id,
              title: blog.title,
              content: blog.content,
              createdAt: blog.created_at.toISOString(),
              author: {
                name: blog.author_name,
                bio: blog.author_bio
              },
              comments: comments.map((comment) => ({
                id: comment.id,
                content: comment.content,
                createdAt: comment.created_at.toISOString(),
                author: {
                  name: comment.author_name
                }
              }))
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
