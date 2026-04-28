import type { CourseSolvePack } from "./solve-schedules-core";
import { normalizeScheduleTypeKey } from "./swap-helpers";

/** Radix `Select` value meaning no instructor constraint. */
export const INSTRUCTOR_SELECT_ANY = "__uwyo_any__";

function anchorFacultyPrimaryPool(
  faculty: { displayName: string | null; primaryIndicator: boolean | null }[],
): string[] {
  const primaryNames = faculty
    .filter((f) => f.primaryIndicator === true)
    .map((f) => f.displayName);
  const pool =
    primaryNames.length > 0 ? primaryNames : faculty.map((f) => f.displayName);
  const out: string[] = [];
  for (const n of pool) {
    const t = (n ?? "").trim();
    if (t) out.push(t);
  }
  return out;
}

function dedupeInstructorNames(names: string[]): string[] {
  const byLower = new Map<string, string>();
  for (const n of names) {
    const k = n.trim().toLowerCase();
    if (!k) continue;
    if (!byLower.has(k)) byLower.set(k, n.trim());
  }
  return [...byLower.values()].sort((a, b) => a.localeCompare(b));
}

/** Union of anchor primary pools across all candidates (matches solver scoring pools). */
export function primaryInstructorOptions(pack: CourseSolvePack): string[] {
  const anchors = new Set(pack.candidates.map((c) => c.anchorCrn));
  const acc: string[] = [];
  for (const crn of anchors) {
    const fac = pack.facultyByCrn[crn] ?? [];
    acc.push(...anchorFacultyPrimaryPool(fac));
  }
  return dedupeInstructorNames(acc);
}

type LinkedScheduleTypeRow = {
  scheduleTypeKey: string;
  label: string;
  instructorOptions: string[];
};

/**
 * One row per linked-bundle member schedule type in this course’s pack,
 * with instructors who appear on any member CRN of that type.
 */
export function linkedScheduleTypeRows(pack: CourseSolvePack): LinkedScheduleTypeRow[] {
  const labelByKey = new Map<string, string>();
  const crnsByKey = new Map<string, Set<string>>();

  for (const c of pack.candidates) {
    if (c.selectionKind !== "linked_bundle") continue;
    for (const crn of c.crns) {
      if (crn === c.anchorCrn) continue;
      const st = pack.scheduleTypeByCrn[crn] ?? null;
      const key = normalizeScheduleTypeKey(st);
      if (!key) continue;
      if (!labelByKey.has(key)) {
        const raw = (st ?? "").trim();
        labelByKey.set(key, raw || key);
      }
      let set = crnsByKey.get(key);
      if (!set) {
        set = new Set();
        crnsByKey.set(key, set);
      }
      set.add(crn);
    }
  }

  const sortedKeys = [...crnsByKey.keys()].sort((a, b) =>
    (labelByKey.get(a) ?? a).localeCompare(labelByKey.get(b) ?? b),
  );
  const rows: LinkedScheduleTypeRow[] = [];
  for (const key of sortedKeys) {
    const acc: string[] = [];
    for (const crn of crnsByKey.get(key) ?? []) {
      const fac = pack.facultyByCrn[crn] ?? [];
      for (const f of fac) {
        const t = (f.displayName ?? "").trim();
        if (t) acc.push(t);
      }
    }
    rows.push({
      scheduleTypeKey: key,
      label: labelByKey.get(key) ?? key,
      instructorOptions: dedupeInstructorNames(acc),
    });
  }
  return rows;
}
