# Blogging App

Local-first blogging app with:
- React + Vite frontend
- Hono backend
- Local PostgreSQL

## Local Development

1. Start PostgreSQL locally and create a database.
2. Configure backend env:
   - copy `backend/.env.example` to `backend/.env`
   - set `DATABASE_URL` and `JWT_SECRET`
3. Install dependencies:
   - `cd common && npm install`
   - `cd ../backend && npm install`
   - `cd ../frontend && npm install`
4. Start services:
   - backend: `cd backend && npm run dev`
   - frontend: `cd frontend && npm run dev`

The backend runs on `http://localhost:8787` by default.
The frontend uses `VITE_BACKEND_URL` if set, otherwise defaults to `http://localhost:8787`.

## Notes

- Prisma has been removed for local development; backend queries PostgreSQL directly.
- For future deployment on Cloudflare Workers/Vercel, keep env values platform-specific and avoid hardcoded URLs/secrets.
