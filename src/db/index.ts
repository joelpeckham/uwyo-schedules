import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

export function createDb() {
  const sql = neon(requireDatabaseUrl());
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof createDb>;

export * from "./schema";
