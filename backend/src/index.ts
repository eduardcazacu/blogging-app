import { Hono } from 'hono'
import { userRouter } from './route/user'
import { blogRouter } from './route/blog'
import { adminRouter } from './route/admin'
import { cors } from 'hono/cors'

// Create the main Hono app
const app = new Hono<{
	Bindings: {
		DATABASE_URL?: string,
		JWT_SECRET?: string,
		ADMIN_EMAILS?: string,
		RESEND_API_KEY?: string,
		EMAIL_FROM?: string,
		FRONTEND_URL?: string,
		VAPID_PUBLIC_KEY?: string,
		VAPID_PRIVATE_KEY?: string,
		VAPID_SUBJECT?: string,
		R2_PUBLIC_BASE_URL?: string,
		BLOG_IMAGES?: {
			put: (key: string, value: ArrayBuffer, options?: {
				httpMetadata?: { contentType?: string },
				customMetadata?: Record<string, string>
			}) => Promise<unknown>,
			head: (key: string) => Promise<unknown | null>
		}
	}
}>();

app.use('/*', (c, next) => {
  const frontendUrl = c.env?.FRONTEND_URL ?? process.env.FRONTEND_URL ?? "http://localhost:5173";
  const frontendOrigin = (() => {
    try {
      return new URL(frontendUrl).origin;
    } catch {
      return frontendUrl;
    }
  })();

  const corsMiddleware = cors({
    origin: [frontendOrigin, "http://localhost:5173", "http://127.0.0.1:5173"],
    allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });
  return corsMiddleware(c, next);
})
app.route("api/v1/user", userRouter)
app.route("api/v1/blog", blogRouter)
app.route("api/v1/admin", adminRouter)

app.use('/message/*', async (c, next) => {
  await next()
})

export default app
