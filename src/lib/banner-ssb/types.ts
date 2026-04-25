/** Banner `getTerms` row */
export type BannerTerm = {
  code: string;
  description: string;
};

/** Banner `get_subject` row */
export type BannerSubject = {
  code: string;
  description: string;
};

export type BannerFaculty = {
  bannerId?: string;
  displayName?: string;
  emailAddress?: string;
  primaryIndicator?: boolean;
  [key: string]: unknown;
};

export type BannerMeetingTime = {
  beginTime?: string | null;
  endTime?: string | null;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
  building?: string | null;
  buildingDescription?: string | null;
  room?: string | null;
  campus?: string | null;
  campusDescription?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  meetingScheduleType?: string | null;
  meetingType?: string | null;
  meetingTypeDescription?: string | null;
  hoursWeek?: number | null;
  creditHourSession?: number | null;
  category?: string | null;
  [key: string]: unknown;
};

export type BannerMeetingFaculty = {
  meetingTime?: BannerMeetingTime;
  category?: string | null;
  faculty?: BannerFaculty[];
  [key: string]: unknown;
};

export type BannerSectionAttribute = {
  code?: string;
  description?: string | null;
  isZTCAttribute?: boolean;
  [key: string]: unknown;
};

/** Row shape from `searchResults` / linked bundle inner arrays (fixtures 07, 08). */
export type BannerSectionRow = {
  id?: number;
  term?: string;
  termDesc?: string;
  courseReferenceNumber?: string;
  partOfTerm?: string | null;
  courseNumber?: string;
  courseDisplay?: string;
  subject?: string;
  subjectDescription?: string;
  sequenceNumber?: string;
  campusDescription?: string | null;
  scheduleTypeDescription?: string | null;
  courseTitle?: string;
  creditHours?: number | null;
  maximumEnrollment?: number | null;
  enrollment?: number | null;
  seatsAvailable?: number | null;
  waitCapacity?: number | null;
  waitCount?: number | null;
  waitAvailable?: number | null;
  crossList?: string | null;
  crossListCapacity?: number | null;
  crossListCount?: number | null;
  crossListAvailable?: number | null;
  creditHourHigh?: number | null;
  creditHourLow?: number | null;
  creditHourIndicator?: string | null;
  openSection?: boolean;
  linkIdentifier?: string | null;
  isSectionLinked?: boolean;
  subjectCourse?: string;
  faculty?: BannerFaculty[];
  meetingsFaculty?: BannerMeetingFaculty[];
  sectionAttributes?: BannerSectionAttribute[];
  instructionalMethod?: string | null;
  instructionalMethodDescription?: string | null;
  status?: {
    sectionOpen?: boolean;
    timeConflict?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type SearchResultsResponse = {
  success?: boolean;
  totalCount?: number;
  data?: BannerSectionRow[] | null;
};

export type LinkedSectionsResponse = {
  linkedData?: BannerSectionRow[][];
};
