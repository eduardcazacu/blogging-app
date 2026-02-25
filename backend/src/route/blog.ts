import { Hono } from "hono";
import { Prisma } from "@prisma/client";
import { verify } from 'hono/jwt'
import { createBlogInput, updateBlogInput } from "@blogging-app/common";
import { getConfig } from "../env";
import { getPrismaClient } from "../prisma";

export const blogRouter = new Hono<{
	Bindings: {
		DATABASE_URL?: string,
		JWT_SECRET?: string,
    R2_PUBLIC_BASE_URL?: string,
    BLOG_IMAGES?: {
      put: (key: string, value: ArrayBuffer, options?: {
        httpMetadata?: { contentType?: string },
        customMetadata?: Record<string, string>
      }) => Promise<unknown>,
      head: (key: string) => Promise<unknown | null>
    }
	},
    Variables: {
        userId: number
    }
}>();

const MAX_IMAGE_FILE_SIZE_BYTES = 3 * 1024 * 1024;
const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function buildPublicImageUrl(baseUrl: string | undefined, key: string) {
  if (!baseUrl) {
    return null;
  }
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalizedBase}/${key}`;
}

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

blogRouter.post("/upload-image", async (c) => {
  const bucket = c.env?.BLOG_IMAGES;
  if (!bucket) {
    c.status(500);
    return c.json({ msg: "BLOG_IMAGES R2 binding is not configured." });
  }

  try {
    const formData = await c.req.formData();
    const fileInput = formData.get("image");
    if (!(fileInput instanceof File)) {
      c.status(400);
      return c.json({ msg: "Image file is required." });
    }

    if (!allowedImageMimeTypes.has(fileInput.type)) {
      c.status(400);
      return c.json({ msg: "Only JPG, PNG, WEBP, or GIF images are allowed." });
    }

    if (fileInput.size <= 0 || fileInput.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      c.status(400);
      return c.json({ msg: "Image must be between 1B and 3MB." });
    }

    const authorId = c.get("userId");
    const extensionByMime: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const extension = extensionByMime[fileInput.type] ?? "bin";
    const key = `posts/${authorId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const bytes = await fileInput.arrayBuffer();

    await bucket.put(key, bytes, {
      httpMetadata: {
        contentType: fileInput.type,
      },
      customMetadata: {
        authorId: String(authorId),
      },
    });

    const { r2PublicBaseUrl } = getConfig(c);
    return c.json({
      key,
      url: buildPublicImageUrl(r2PublicBaseUrl, key),
    });
  } catch (e) {
    console.error(e);
    c.status(500);
    return c.json({ msg: "Failed to upload image." });
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
    const prisma = getPrismaClient(databaseUrl);
    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { id: true },
      });
      if (!post) {
        c.status(404);
        return c.json({ msg: "Blog not found" });
      }
      const comment = await prisma.comment.create({
        data: {
          content,
          postId,
          authorId,
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: {
            select: {
              name: true,
            },
          },
        },
      });
      return c.json({
        comment: {
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
          author: {
            name: comment.author.name
          }
        }
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
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
    const parsed = createBlogInput.safeParse(body)
    if(!parsed.success){
        c.status(411);
        return c.json({
            msg: "Inputs are Incorrect"
        })
    }
    const authorId = c.get("userId")
    const { databaseUrl, r2PublicBaseUrl } = getConfig(c);
    if (parsed.data.imageKey) {
      const imageKey = parsed.data.imageKey.trim();
      const bucket = c.env?.BLOG_IMAGES;
      if (!imageKey.startsWith(`posts/${authorId}/`)) {
        c.status(400);
        return c.json({ msg: "Invalid image key." });
      }
      if (!bucket) {
        c.status(500);
        return c.json({ msg: "BLOG_IMAGES R2 binding is not configured." });
      }
      const exists = await bucket.head(imageKey);
      if (!exists) {
        c.status(400);
        return c.json({ msg: "Image upload not found. Please upload again." });
      }
    }
    const prisma = getPrismaClient(databaseUrl);
    const blog = await prisma.post.create({
      data: {
        title: parsed.data.title,
        content: parsed.data.content,
        imageKey: parsed.data.imageKey?.trim() || null,
        authorId,
      },
      select: {
        id: true,
        imageKey: true,
      },
    });
        return c.json({
            id: blog.id,
            imageUrl: blog.imageKey ? buildPublicImageUrl(r2PublicBaseUrl, blog.imageKey) : null
        })
    })
  
  blogRouter.put('/',async (c) => {
    const body = await c.req.json()
    const parsed = updateBlogInput.safeParse(body)
    if(!parsed.success){
        c.status(411);
        return c.json({
            msg: "Inputs are Incorrect"
        })
    }
    const authorId = c.get("userId")
    const { databaseUrl } = getConfig(c);
    const prisma = getPrismaClient(databaseUrl);
    const updated = await prisma.post.updateMany({
      where: {
        id: parsed.data.id,
        authorId,
      },
      data: {
        title: parsed.data.title,
        content: parsed.data.content,
      },
    });
    if (updated.count === 0) {
      c.status(404);
      return c.json({
        msg: "Blog not found"
      });
    }
        return c.json({
            id: parsed.data.id
        })
    })

    blogRouter.get('/bulk',async (c) => {
        const rawCursor = c.req.query("cursor");
        const rawLimit = c.req.query("limit");
        const parsedCursor = rawCursor ? Number(rawCursor) : undefined;
        const parsedLimit = rawLimit ? Number(rawLimit) : 10;
        const limit = Number.isFinite(parsedLimit)
          ? Math.max(1, Math.min(25, parsedLimit))
          : 10;
        const cursor = Number.isFinite(parsedCursor) ? parsedCursor : undefined;

        const { databaseUrl, r2PublicBaseUrl } = getConfig(c);
        const prisma = getPrismaClient(databaseUrl);
        const blogRows = await prisma.post.findMany({
          where: cursor ? { id: { lt: cursor } } : undefined,
          take: limit + 1,
          orderBy: {
            id: "desc",
          },
          select: {
            id: true,
            title: true,
            content: true,
            imageKey: true,
            createdAt: true,
            author: {
              select: {
                name: true,
                bio: true,
                themeKey: true,
              },
            },
            _count: {
              select: {
                comments: true,
              },
            },
            comments: {
              orderBy: {
                createdAt: "asc",
              },
              take: 3,
              select: {
                id: true,
                content: true,
                createdAt: true,
                author: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        });

        const hasMore = blogRows.length > limit;
        const pageRows = hasMore ? blogRows.slice(0, limit) : blogRows;
        const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null;

        const blogs = pageRows.map((blog) => ({
          id: blog.id,
          title: blog.title,
          content: blog.content,
          imageKey: blog.imageKey,
          imageUrl: blog.imageKey ? buildPublicImageUrl(r2PublicBaseUrl, blog.imageKey) : null,
          createdAt: blog.createdAt.toISOString(),
          author: {
            name: blog.author.name,
            bio: blog.author.bio,
            themeKey: blog.author.themeKey
          },
          commentCount: blog._count.comments,
          topComments: blog.comments.map((comment) => ({
            id: comment.id,
            content: comment.content,
            createdAt: comment.createdAt.toISOString(),
            author: {
              name: comment.author.name
            }
          }))
        }));

        return c.json({
            blogs,
            nextCursor,
            hasMore
        })
    })
  
  blogRouter.get('/:id',async (c) => {
    const id = Number(c.req.param("id"))
    if (!Number.isFinite(id)) {
      c.status(400);
      return c.json({ msg: "Invalid blog id" });
    }
    const { databaseUrl, r2PublicBaseUrl } = getConfig(c);
    const prisma = getPrismaClient(databaseUrl);
    try {
    const blog = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        imageKey: true,
        createdAt: true,
        author: {
          select: {
            name: true,
            bio: true,
            themeKey: true,
          },
        },
        comments: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
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
              imageKey: blog.imageKey,
              imageUrl: blog.imageKey ? buildPublicImageUrl(r2PublicBaseUrl, blog.imageKey) : null,
              createdAt: blog.createdAt.toISOString(),
              author: {
                name: blog.author.name,
                bio: blog.author.bio,
                themeKey: blog.author.themeKey
              },
              comments: blog.comments.map((comment) => ({
                id: comment.id,
                content: comment.content,
                createdAt: comment.createdAt.toISOString(),
                author: {
                  name: comment.author.name
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
