import { headers } from "next/headers";

/** Best-effort client key for rate limiting (shared proxies may bucket users). */
export async function catalogActionClientKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = h.get("x-real-ip")?.trim();
  return forwarded || realIp || "unknown";
}
