/**
 * Classify how a UW Banner section is delivered. The signal is a mix of:
 *
 * 1. The Banner-supplied `instructionalMethod` code (`TR`, `I`, etc.) and
 *    `instructionalMethodDescription` string ("Traditional", "Online-Asynchronous",
 *    "Hybrid", ...). The codes vary across UW programs, so the description text
 *    is the more reliable signal.
 * 2. Whether any of the section's meetings actually have a time block and at
 *    least one day flag. A "Traditional" section that ingest left with no
 *    timed meetings is functionally TBA from the student's perspective.
 *
 * `meetingRowToIntervals` already returns `[]` for unparsable times, so the
 * solver does not need to know about delivery mode. This helper exists purely
 * so the UI can mark online/async/TBA sections instead of silently dropping
 * them off the calendar.
 */
export type DeliveryMode =
  | "in_person"
  | "online_async"
  | "online_sync"
  | "hybrid"
  | "tba";

export type DeliveryClassifyInput = {
  instructionalMethod: string | null | undefined;
  instructionalMethodDescription: string | null | undefined;
  hasTimedMeetings: boolean;
};

/** Lightweight "does this meeting put a block on the calendar" predicate. */
export function meetingHasTimeBlock(m: {
  beginTime: string | null | undefined;
  endTime: string | null | undefined;
  monday: boolean | null | undefined;
  tuesday: boolean | null | undefined;
  wednesday: boolean | null | undefined;
  thursday: boolean | null | undefined;
  friday: boolean | null | undefined;
  saturday: boolean | null | undefined;
  sunday: boolean | null | undefined;
}): boolean {
  if (!m.beginTime || !m.endTime) return false;
  return Boolean(
    m.monday ||
      m.tuesday ||
      m.wednesday ||
      m.thursday ||
      m.friday ||
      m.saturday ||
      m.sunday,
  );
}

function normalizeDescription(s: string | null | undefined): string {
  return (s ?? "").toLowerCase();
}

export function classifyDeliveryMode(input: DeliveryClassifyInput): DeliveryMode {
  const desc = normalizeDescription(input.instructionalMethodDescription);
  const code = (input.instructionalMethod ?? "").trim().toUpperCase();

  const looksOnline =
    desc.includes("online") || desc.includes("internet") || desc.includes("web");
  const looksAsync = desc.includes("async");
  const looksSync = desc.includes("sync") && !looksAsync;
  const looksHybrid =
    desc.includes("hybrid") || desc.includes("blended");

  if (looksHybrid) return "hybrid";
  if (looksOnline) {
    if (looksAsync) return "online_async";
    if (looksSync) return "online_sync";
    return input.hasTimedMeetings ? "online_sync" : "online_async";
  }

  if (code === "I") return "online_async";

  if (!input.hasTimedMeetings) return "tba";

  return "in_person";
}

/** Short pill-friendly label. `null` means "do not show a pill". */
export function deliveryModeLabel(mode: DeliveryMode): string | null {
  switch (mode) {
    case "in_person":
      return null;
    case "online_async":
      return "Online \u00b7 async";
    case "online_sync":
      return "Online \u00b7 live";
    case "hybrid":
      return "Hybrid";
    case "tba":
      return "Time TBA";
  }
}

/** Short prose for SectionDetailPanels and the planner detail card. */
export function deliveryModeDescription(mode: DeliveryMode): string {
  switch (mode) {
    case "in_person":
      return "In person";
    case "online_async":
      return "Online, asynchronous";
    case "online_sync":
      return "Online, live";
    case "hybrid":
      return "Hybrid";
    case "tba":
      return "Meeting time not yet set";
  }
}
