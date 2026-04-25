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
};

export type ClientCatalogMeeting = {
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
};
