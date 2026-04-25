import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

/**
 * Neon `Pool` uses WebSockets (interactive sessions / Drizzle `transaction()`).
 * Node 22+ exposes `globalThis.WebSocket`; Node 20 needs the `ws` package (Neon docs).
 */
function ensureNeonWebSocket(): void {
  if (neonConfig.webSocketConstructor) return;
  if (typeof globalThis.WebSocket === "function") {
    neonConfig.webSocketConstructor = globalThis.WebSocket;
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Node 20 fallback only
  neonConfig.webSocketConstructor = require("ws") as typeof globalThis.WebSocket;
}

const globalForPool = globalThis as typeof globalThis & {
  __uwyoNeonPool?: Pool;
};

/**
 * WebSocket-backed pool so Drizzle can run `transaction()` (not supported on neon-http).
 * Reuses one pool per runtime instance (dev HMR / warm serverless).
 */
export function createDb() {
  ensureNeonWebSocket();
  if (!globalForPool.__uwyoNeonPool) {
    globalForPool.__uwyoNeonPool = new Pool({
      connectionString: requireDatabaseUrl(),
      max: 10,
    });
    globalForPool.__uwyoNeonPool.on("error", (err: Error) => {
      console.error("[db] Neon pool error", err);
    });
  }
  return drizzle(globalForPool.__uwyoNeonPool, { schema });
}

export type Database = ReturnType<typeof createDb>;

export * from "./schema";
