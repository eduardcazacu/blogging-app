# Eddie's Lounge

Full-stack blogging app with:
- `frontend`: React + Vite + Tailwind
- `backend`: Hono API (Node local dev + Cloudflare Workers deploy)
- `common`: shared Zod input schemas
- PostgreSQL via Prisma Client (`@prisma/adapter-pg`)

It is my private, online hangout space. I’ve created it out of frustration caused by the state of social media today, and a strong nostalgia for the early days of social platforms.

Based on syedahmedullah14's example of a Medium-like app.

## Repo Layout

- `frontend/` UI app
- `backend/` API service
- `common/` shared package consumed by frontend/backend

## Local Development

### 1) Prerequisites

- Node.js 20+
- PostgreSQL (local or hosted)

### 2) Configure environment

Backend:

1. Copy `backend/.env.example` to `backend/.env`
2. Set:
   - `DATABASE_URL=postgres://...`
   - `JWT_SECRET=...`
   - `ADMIN_EMAILS=admin@example.com` (comma-separated supported)
   - `RESEND_API_KEY=re_xxx`
   - `EMAIL_FROM=Eddie's Lounge <onboarding@resend.dev>`
   - `FRONTEND_URL=http://localhost:5173`
   - `R2_PUBLIC_BASE_URL=https://pub-<bucket-subdomain>.r2.dev` (for post images)
   - `PORT=8787` (optional)

Frontend (optional):

- Set `VITE_BACKEND_URL` to override API base URL.
- Set `VITE_IMAGE_TRANSFORM_BASE_URL=https://images.<your-domain>` to force Cloudflare image transformations through your custom image domain.
- If not set, frontend defaults to `http://localhost:8787`.

### 3) Install dependencies

```bash
cd common && npm install
cd ../backend && npm install
cd ../frontend && npm install
```

### 4) Generate Prisma client + run migrations

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate -- --name init
```

### 5) Run apps

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Default local URLs:
- API: `http://localhost:8787`
- Frontend: `http://localhost:5173`

## Deployment

## Backend on Cloudflare Workers

`backend/wrangler.toml` is already configured.

1. Login:

```bash
cd backend
npx wrangler login
```

2. Set Worker secrets:

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put JWT_SECRET
npx wrangler secret put ADMIN_EMAILS
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM
npx wrangler secret put FRONTEND_URL
npx wrangler secret put R2_PUBLIC_BASE_URL
```

3. Configure R2 bucket binding and public URL

- In Cloudflare Dashboard:
  - `R2` -> `Create bucket` (name it `eddies-lounge-images` or update `backend/wrangler.toml` to match your bucket name).
  - Open the bucket -> `Settings` -> enable **Public Development URL**.
  - Copy the generated URL (looks like `https://pub-xxxx.r2.dev`) and use it as `R2_PUBLIC_BASE_URL`.
- `backend/wrangler.toml` already includes:
  - `[[r2_buckets]] binding = "BLOG_IMAGES"`
  - `bucket_name = "eddies-lounge-images"`
- If you use a different bucket name, edit `backend/wrangler.toml`.

4. Deploy:

```bash
npm run deploy
```

5. Run Prisma migrations against production DB:

```bash
DATABASE_URL="postgres://..." npm run prisma:deploy
```

## Image Uploads (R2 + Cloudflare Transformations)

- Users can upload **one image per post** from the publish page.
- Images are optimized client-side before upload (max stored resolution: **1920x1080**).
- API upload route: `POST /api/v1/blog/upload-image` (`multipart/form-data`, field: `image`).
- Post payload supports `imageKey`; post APIs return `imageKey` and `imageUrl`.
- Frontend serves transformed variants using:
  - `/cdn-cgi/image/width=...,quality=...,fit=...,format=auto/<imageUrl>`
- This keeps R2 storage/origin egress low on the free tier.

## Frontend on Vercel

Use project root as repo root (not `frontend/`) because `frontend` depends on `../common`.

Recommended Vercel settings:
- Install Command: `cd frontend && npm ci`
- Build Command: `cd frontend && npm run build`
- Output Directory: `frontend/dist`

Required env var on Vercel:
- `VITE_BACKEND_URL=https://<your-worker-domain>`
- `VITE_IMAGE_TRANSFORM_BASE_URL=https://images.<your-domain>`

SPA routing fallback is configured in root `vercel.json`.

## PWA / Icons

PWA manifest and icons are configured in `frontend/public/`:
- `manifest.webmanifest`
- `icon-192.png`
- `icon-512.png`
- `icon-512-maskable.png`
- favicon + apple touch icon files

## Useful Scripts

Backend:
- `npm run dev` - local API server
- `npm run deploy` - Cloudflare deploy
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:deploy`
- `npm run prisma:studio`

Frontend:
- `npm run dev`
- `npm run build`
- `npm run preview`

## Auth Notes

- Signup sends a verification email via Resend.
- Signin requires:
  - verified email
  - approved account status (for non-admin emails)
