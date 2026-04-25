import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Banner term code, e.g. 202710 */
export const terms = pgTable("terms", {
  code: text("code").primaryKey(),
  description: text("description").notNull(),
  lastFullScrapeAt: timestamp("last_full_scrape_at", { withTimezone: true }),
  lastHotScrapeAt: timestamp("last_hot_scrape_at", { withTimezone: true }),
});

/** Catalog course identity within a term (subject + number). */
export const courses = pgTable(
  "courses",
  {
    termCode: text("term_code")
      .notNull()
      .references(() => terms.code, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    courseNumber: text("course_number").notNull(),
    subjectCourse: text("subject_course"),
  },
  (t) => [
    primaryKey({ columns: [t.termCode, t.subject, t.courseNumber] }),
    index("courses_term_idx").on(t.termCode),
  ],
);

/**
 * Section row from Banner searchResults / linked bundles.
 * CRN is unique per term.
 */
export const sections = pgTable(
  "sections",
  {
    termCode: text("term_code")
      .notNull()
      .references(() => terms.code, { onDelete: "cascade" }),
    crn: text("crn").notNull(),
    subject: text("subject").notNull(),
    courseNumber: text("course_number").notNull(),
    sequenceNumber: text("sequence_number"),
    subjectDescription: text("subject_description"),
    courseTitle: text("course_title"),
    subjectCourse: text("subject_course"),
    scheduleTypeDescription: text("schedule_type_description"),
    partOfTerm: text("part_of_term"),
    campusDescription: text("campus_description"),
    instructionalMethod: text("instructional_method"),
    instructionalMethodDescription: text("instructional_method_description"),
    creditHours: real("credit_hours"),
    creditHourHigh: real("credit_hour_high"),
    creditHourLow: real("credit_hour_low"),
    creditHourIndicator: text("credit_hour_indicator"),
    enrollment: integer("enrollment"),
    maximumEnrollment: integer("maximum_enrollment"),
    seatsAvailable: integer("seats_available"),
    waitCapacity: integer("wait_capacity"),
    waitCount: integer("wait_count"),
    waitAvailable: integer("wait_available"),
    openSection: boolean("open_section"),
    crossList: text("cross_list"),
    crossListCapacity: integer("cross_list_capacity"),
    crossListCount: integer("cross_list_count"),
    crossListAvailable: integer("cross_list_available"),
    linkIdentifier: text("link_identifier"),
    isSectionLinked: boolean("is_section_linked"),
    bannerRowId: integer("banner_row_id"),
    rawJson: jsonb("raw_json").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.termCode, t.crn] }),
    index("sections_term_subject_idx").on(t.termCode, t.subject),
    index("sections_term_linked_idx").on(t.termCode, t.isSectionLinked),
    index("sections_term_link_id_idx").on(t.termCode, t.linkIdentifier),
  ],
);

export const sectionMeetings = pgTable(
  "section_meetings",
  {
    id: serial("id").primaryKey(),
    termCode: text("term_code").notNull(),
    sectionCrn: text("section_crn").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    beginTime: text("begin_time"),
    endTime: text("end_time"),
    monday: boolean("monday"),
    tuesday: boolean("tuesday"),
    wednesday: boolean("wednesday"),
    thursday: boolean("thursday"),
    friday: boolean("friday"),
    saturday: boolean("saturday"),
    sunday: boolean("sunday"),
    building: text("building"),
    buildingDescription: text("building_description"),
    room: text("room"),
    campus: text("campus"),
    campusDescription: text("campus_description"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    meetingScheduleType: text("meeting_schedule_type"),
    meetingType: text("meeting_type"),
    meetingTypeDescription: text("meeting_type_description"),
    hoursWeek: real("hours_week"),
    creditHourSession: real("credit_hour_session"),
    category: text("category"),
    rawJson: jsonb("meeting_raw_json"),
  },
  (t) => [
    index("section_meetings_section_idx").on(t.termCode, t.sectionCrn),
  ],
);

export const sectionFaculty = pgTable(
  "section_faculty",
  {
    id: serial("id").primaryKey(),
    termCode: text("term_code").notNull(),
    sectionCrn: text("section_crn").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    bannerId: text("banner_id"),
    displayName: text("display_name"),
    emailAddress: text("email_address"),
    primaryIndicator: boolean("primary_indicator"),
    rawJson: jsonb("faculty_raw_json"),
  },
  (t) => [index("section_faculty_section_idx").on(t.termCode, t.sectionCrn)],
);

export const sectionAttributes = pgTable(
  "section_attributes",
  {
    id: serial("id").primaryKey(),
    termCode: text("term_code").notNull(),
    sectionCrn: text("section_crn").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    isZtcAttribute: boolean("is_ztc_attribute"),
    rawJson: jsonb("attr_raw_json"),
  },
  (t) => [
    uniqueIndex("section_attributes_unique").on(
      t.termCode,
      t.sectionCrn,
      t.code,
    ),
  ],
);

/**
 * Linked registration (Banner `linkedData` from `fetchLinkedSections`):
 * - Outer array index `bundle_index`: mutually exclusive registration options (OR).
 * - Inner members (via `linked_bundle_members`): sections that must be taken together (AND).
 * - `anchor_crn` is the query CRN only; inner rows may omit it (e.g. lecture anchor + lab/discussion only).
 * - `link_identifier` on sections denotes slot/role within an AND-bundle, not the OR group.
 */
export const linkedBundles = pgTable(
  "linked_bundles",
  {
    id: serial("id").primaryKey(),
    termCode: text("term_code").notNull(),
    anchorCrn: text("anchor_crn").notNull(),
    bundleIndex: integer("bundle_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("linked_bundles_natural").on(
      t.termCode,
      t.anchorCrn,
      t.bundleIndex,
    ),
    index("linked_bundles_term_anchor_idx").on(t.termCode, t.anchorCrn),
  ],
);

/** AND-members within one linked bundle (inner array), ordered by position j. */
export const linkedBundleMembers = pgTable(
  "linked_bundle_members",
  {
    id: serial("id").primaryKey(),
    bundleId: integer("bundle_id")
      .notNull()
      .references(() => linkedBundles.id, { onDelete: "cascade" }),
    crn: text("crn").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    uniqueIndex("linked_bundle_members_unique").on(t.bundleId, t.position),
    uniqueIndex("linked_bundle_members_crn_unique").on(t.bundleId, t.crn),
  ],
);
