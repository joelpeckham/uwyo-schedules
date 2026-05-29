/**
 * Trigger /api/cron/banner-ingest locally (or set INGEST_BASE_URL for another host).
 * Loads .env then .env.local from the repo root (same as drizzle.config.ts).
 *
 * Usage:
 *   pnpm ingest:hot
 *   pnpm ingest:archive
 *   pnpm ingest:descriptions
 *   node scripts/trigger-banner-ingest.cjs archive --linked
 */
const { config: loadEnv } = require("dotenv");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
loadEnv({ path: path.join(root, ".env"), quiet: true });
loadEnv({ path: path.join(root, ".env.local"), override: true, quiet: true });

// 127.0.0.1 avoids ::1 vs IPv4 listen mismatches; PORT matches Next when set in .env.local.
const port = process.env.PORT || "3000";
const base = (process.env.INGEST_BASE_URL || `http://127.0.0.1:${port}`).replace(
  /\/$/,
  "",
);
const secret = process.env.CRON_SECRET;

async function main() {
  const argv = process.argv.slice(2);
  const mode = argv[0];
  const includeLinked =
    argv.includes("--linked") || argv.includes("--include-linked");

  if (mode !== "hot" && mode !== "archive" && mode !== "descriptions") {
    console.error(
      "Usage: node scripts/trigger-banner-ingest.cjs <hot|archive|descriptions> [--linked]",
    );
    process.exit(1);
  }

  if (!secret) {
    console.error("CRON_SECRET is not set (check .env.local)");
    process.exit(1);
  }

  const path =
    mode === "descriptions"
      ? "/api/cron/banner-descriptions"
      : "/api/cron/banner-ingest";
  const params = new URLSearchParams();
  if (mode !== "descriptions") {
    params.set("mode", mode);
    if (mode === "archive" && includeLinked) {
      params.set("includeLinkedArchive", "1");
    }
  }

  const qs = params.toString();
  const url = `${base}${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!res.ok) {
    console.error(res.status, body);
    process.exit(1);
  }
  console.log(body);
}

function isConnRefused(err) {
  let e = err;
  for (let i = 0; i < 5 && e; i++) {
    if (e.code === "ECONNREFUSED") return true;
    e = e.cause;
  }
  return false;
}

main().catch((err) => {
  if (isConnRefused(err)) {
    console.error(
      `Could not reach ${base} (connection refused).\n` +
        `Start the dev server (pnpm dev) on that port, or set INGEST_BASE_URL (e.g. http://127.0.0.1:3001) or PORT in .env.local.`,
    );
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
