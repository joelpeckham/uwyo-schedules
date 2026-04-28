/**
 * Serializable catalog slice for client-side planner derivation (swap, calendar).
 * Built server-side in `catalog-bootstrap.ts`.
 */

export type ClientCatalogSection = {
  crn: string;
  subject: string;
  courseNumber: string;
  scheduleTypeDescription: string | null;
  sequenceNumber: string | null;
  subjectCourse: string | null;
  instructionalMethod: string | null;
  instructionalMethodDescription: string | null;
  /** Credit hours from `sections.creditHours`. May be null for sections like labs. */
  creditHours: number | null;
  /**
   * Open seats remaining (`sections.seatsAvailable`). `null` when Banner
   * doesn't expose the seat count for a section.
   */
  seatsAvailable: number | null;
};

type ClientCatalogMeeting = {
  id: number;
  sectionCrn: string;
  beginTime: string | null;
  endTime: string | null;
  meetingScheduleType: string | null;
  monday: boolean | null;
  tuesday: boolean | null;
  wednesday: boolean | null;
  thursday: boolean | null;
  friday: boolean | null;
  saturday: boolean | null;
  sunday: boolean | null;
  building: string | null;
  buildingDescription: string | null;
  room: string | null;
  /** Section-meeting effective start date, used to bound .ics RRULE. */
  startDate: string | null;
  /** Section-meeting effective end date, used to bound .ics RRULE. */
  endDate: string | null;
};

export type ClientLinkedBundleRow = {
  id: number;
  anchorCrn: string;
  bundleIndex: number;
};

export type ClientLinkedBundleMemberRow = {
  bundleId: number;
  crn: string;
  position: number;
};

export type PlannerCatalogJson = {
  sections: ClientCatalogSection[];
  meetings: ClientCatalogMeeting[];
  linkedBundles: ClientLinkedBundleRow[];
  linkedBundleMembers: ClientLinkedBundleMemberRow[];
  /** Section CRN → instructor display names for calendar (comma-separated). */
  facultyByCrn: Record<string, string>;
};
