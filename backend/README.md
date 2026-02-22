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

Server default: `http://localhost:8787`
