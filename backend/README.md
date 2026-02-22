## Backend (Local)

1. Copy `.env.example` to `.env`.
2. Set:
   - `DATABASE_URL=postgres://postgres:postgres@localhost:5432/blogging_app`
   - `JWT_SECRET=your-local-secret`
   - `ADMIN_EMAILS=admin@example.com` (comma-separated for multiple admins)
3. Install and run:

```bash
npm install
npm run dev
```

If you use Prisma 7, ensure these runtime deps are installed:

```bash
npm install @prisma/adapter-pg pg
```

Server default: `http://localhost:8787`

## Prisma Setup

Paste your real Prisma connection string(s) into `backend/.env` (this file is git-ignored):

- `DATABASE_URL=...`

Then run:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init_prisma
```
