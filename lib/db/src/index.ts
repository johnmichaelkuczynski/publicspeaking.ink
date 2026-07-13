import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;

// Enable SSL for managed providers (Neon, Render, Supabase, etc.).
// Local URLs (localhost / 127.0.0.1) keep SSL off.
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
const sslDisabled = process.env.DATABASE_SSL === "false";
const useSsl = !isLocal && !sslDisabled;

export const pool = new Pool({
  connectionString,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
