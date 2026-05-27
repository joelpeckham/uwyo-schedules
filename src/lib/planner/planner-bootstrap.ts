/**
 * Pre-paint planner bootstrap (mirrors theme script in root layout).
 * Sets `data-planner-items` on <html> before React hydrates so the empty hero
 * slot matches localStorage without a flash.
 */

import { PLANNER_LOCAL_STORAGE_KEY, readTerm } from "@/lib/planner/local-state";

/** Item count for a term from localStorage (0 when missing or on server). */
export function getStoredItemCount(termCode: string): number {
  return readTerm(termCode).items.length;
}

/**
 * Inline IIFE run before planner body paint. Keep parse logic aligned with
 * `readLocalDoc` / `readTerm` in local-state.ts.
 */
/** Keep html[data-planner-items] aligned with React after local restore / edits. */
export function syncPlannerItemsDataset(itemCount: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.plannerItems = String(itemCount);
  delete document.documentElement.dataset.plannerNoTransition;
}

export function buildPlannerBootstrapScript(termCode: string): string {
  const termJson = JSON.stringify(termCode);
  const keyJson = JSON.stringify(PLANNER_LOCAL_STORAGE_KEY);
  return `(()=>{try{var k=${keyJson};var term=${termJson};var raw=localStorage.getItem(k);var n=0;if(raw){var doc=JSON.parse(raw);if(doc&&doc.v===2&&doc.terms&&doc.terms[term]&&Array.isArray(doc.terms[term].items)){n=doc.terms[term].items.length;}}document.documentElement.dataset.plannerItems=String(n);document.documentElement.dataset.plannerNoTransition="1";}catch(e){document.documentElement.dataset.plannerItems="0";document.documentElement.dataset.plannerNoTransition="1";}})();`;
}
