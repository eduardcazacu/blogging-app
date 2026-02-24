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
   - `PORT=8787` (optional)

Frontend (optional):

- Set `VITE_BACKEND_URL` to override API base URL.
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
```

3. Deploy:

```bash
npm run deploy
```

4. Run Prisma migrations against production DB:

```bash
DATABASE_URL="postgres://..." npm run prisma:deploy
```

## Frontend on Vercel

Use project root as repo root (not `frontend/`) because `frontend` depends on `../common`.

Recommended Vercel settings:
- Install Command: `cd frontend && npm ci`
- Build Command: `cd frontend && npm run build`
- Output Directory: `frontend/dist`

Required env var on Vercel:
- `VITE_BACKEND_URL=https://<your-worker-domain>`

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
