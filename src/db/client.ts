import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../config/env.ts";
import { logger } from "../logger/index.ts";
import * as schema from "./schema/index.ts";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;

export async function closeDb(): Promise<void> {
  await pool.end();
  logger.info("Database pool closed");
}

if (import.meta.main) {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    logger.info("Database connection OK");
  } catch (err) {
    logger.error({ err }, "Database connection failed");
    process.exit(1);
  } finally {
    await closeDb();
  }
}