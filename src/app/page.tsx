import { HomePlanner } from "@/components/planner/HomePlanner";
import { createDb } from "@/db/index";
import {
  buildCalendarBlocks,
  buildSwapGhostsPrefetchMap,
  getLatestTermCode,
  listPlannerItems,
  listTerms,
} from "@/lib/planner/data";
import { readPlannerSessionIdFromCookies } from "@/lib/planner/session";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const db = createDb();
  const terms = await listTerms(db);
  const sp = await searchParams;
  const latest = await getLatestTermCode(db);
  const termFromQuery =
    sp.term && terms.some((t) => t.code === sp.term) ? sp.term : null;
  const termCode =
    termFromQuery ?? latest ?? (terms.length > 0 ? terms[0]!.code : "");

  const sessionId = await readPlannerSessionIdFromCookies();
  const plannerItems =
    sessionId && termCode
      ? await listPlannerItems(db, sessionId, termCode)
      : [];
  const calendarBlocks =
    sessionId && termCode
      ? await buildCalendarBlocks(db, sessionId, termCode)
      : [];
  const swapGhostsPrefetch =
    sessionId && termCode && calendarBlocks.length > 0
      ? await buildSwapGhostsPrefetchMap(db, termCode, calendarBlocks)
      : {};

  return (
    <HomePlanner
      terms={terms}
      termCode={termCode}
      plannerItems={plannerItems}
      calendarBlocks={calendarBlocks}
      swapGhostsPrefetch={swapGhostsPrefetch}
      hasSessionCookie={!!sessionId}
    />
  );
}
