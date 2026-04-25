import { cookies } from "next/headers";
import { PLANNER_SESSION_COOKIE, UUID_RE } from "./constants";

export async function readPlannerSessionIdFromCookies(): Promise<
  string | null
> {
  const jar = await cookies();
  const raw = jar.get(PLANNER_SESSION_COOKIE)?.value;
  if (!raw || !UUID_RE.test(raw)) return null;
  return raw;
}
