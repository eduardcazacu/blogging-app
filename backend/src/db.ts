import postgres, { type Sql } from "postgres";

const clients = new Map<string, Sql>();
const initialized = new Set<string>();

export function getDb(databaseUrl: string) {
  let client = clients.get(databaseUrl);
  if (!client) {
    client = postgres(databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    clients.set(databaseUrl, client);
  }
  return client;
}

export async function ensureSchema(databaseUrl: string) {
  if (initialized.has(databaseUrl)) {
    return;
  }

  const sql = getDb(databaseUrl);

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      published BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  await sql`
    ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `;

  initialized.add(databaseUrl);
}
