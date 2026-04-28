import { sql } from "drizzle-orm";
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
  uuid,
} from "drizzle-orm/pg-core";
import type { SelectionKind } from "@/lib/planner/resolve-display-crns-shared";

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
    // Cross-term `(subject, course_number)` lookups for evergreen course pages
    // (`getCourseSeoDetail`, `listDistinctCourseKeysPage`, sitemap chunking).
    // The existing `(term_code, subject)` indexes can't satisfy these queries
    // because they are anchored on `term_code`.
    index("sections_subject_course_idx").on(t.subject, t.courseNumber),
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
  (t) => [
    index("section_faculty_section_idx").on(t.termCode, t.sectionCrn),
    // Backs `listSectionsForInstructorDisplayName` in
    // `src/lib/seo/queries.ts`, which filters by `display_name` directly.
    // Without this index every instructor SEO page does a sequential scan.
    index("section_faculty_display_name_idx").on(t.displayName),
  ],
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

/** Anonymous browser planner session (HTTP-only cookie). */
export const plannerSessions = pgTable("planner_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * One row per course on the user's list for a term.
 * `selection_kind` + `anchor_crn` + optional `linked_bundle_id` resolve which CRNs appear on the calendar.
 * `unresolved`: wish-list row before automation picks a section; `anchor_crn` / `linked_bundle_id` are null.
 */
export const plannerItems = pgTable(
  "planner_items",
  {
    id: serial("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => plannerSessions.id, { onDelete: "cascade" }),
    termCode: text("term_code")
      .notNull()
      .references(() => terms.code, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    courseNumber: text("course_number").notNull(),
    displayColor: text("display_color").notNull(),
    /** `unresolved` | `single_crn` | `linked_bundle`. Refined at the type level
     * via `$type<SelectionKind>()` so callers don't need to assert when reading
     * planner rows — all writers must validate the union before persisting. */
    selectionKind: text("selection_kind").$type<SelectionKind>().notNull(),
    anchorCrn: text("anchor_crn"),
    linkedBundleId: integer("linked_bundle_id").references(
      () => linkedBundles.id,
      { onDelete: "set null" },
    ),
    instructorPrefs: jsonb("instructor_prefs")
      .notNull()
      .default(sql`'{"v":1,"primary":[]}'::jsonb`),
    /** Per schedule-type pins while `selection_kind` is `unresolved` — `{ v:1, byType: { [key]: crn } }`. */
    sectionPins: jsonb("section_pins")
      .notNull()
      .default(sql`'{"v":1,"byType":{}}'::jsonb`),
  },
  (t) => [
    index("planner_items_session_term_idx").on(t.sessionId, t.termCode),
  ],
);

/**
 * Lightweight idempotency / leasing primitive for cron jobs and other
 * fire-once-per-window background tasks. Each `key` represents one logical
 * job (e.g. `banner-ingest:hot`); a fresh row means the lease was just
 * acquired and the caller may proceed, while an existing row inside the lease
 * window means another invocation is still running and the caller must skip.
 */
export const cronLease = pgTable("cron_lease", {
  key: text("key").primaryKey(),
  acquiredAt: timestamp("acquired_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Fixed-window rate limit counters shared across Vercel function instances.
 * Each row tracks the number of requests for one `client_key` since
 * `window_start`. The atomic upsert in `takeCatalogActionRateLimit`
 * either rolls the window forward (when expired) or increments `count`,
 * so concurrent calls cannot race past the cap.
 */
export const catalogActionRateLimit = pgTable("catalog_action_rate_limit", {
  clientKey: text("client_key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true })
    .notNull()
    .defaultNow(),
  count: integer("count").notNull().default(0),
});

/** Last-viewed / favorite schedule indices for paging valid combinations (per session + term). */
export const plannerTermUiState = pgTable(
  "planner_term_ui_state",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => plannerSessions.id, { onDelete: "cascade" }),
    termCode: text("term_code")
      .notNull()
      .references(() => terms.code, { onDelete: "cascade" }),
    lastSolutionIndex: integer("last_solution_index").notNull().default(0),
    favoriteSolutionIndex: integer("favorite_solution_index"),
    /** Versioned JSON: `{ v: 1, items: [...] }` — user busy times for schedule solving. */
    blackouts: jsonb("blackouts")
      .notNull()
      .default(sql`'{"v":1,"items":[]}'::jsonb`),
    /** Versioned JSON: `{ v: 1, keys: ["crn1:crn2:..."] }` — fingerprints of "kept" schedules survive recalcs. */
    keptSolutionKeys: jsonb("kept_solution_keys")
      .notNull()
      .default(sql`'{"v":1,"keys":[]}'::jsonb`),
    /** Versioned JSON: `{ v: 1, noFridays?, noBefore?, noAfter?, protectLunch? }` — soft scoring weights. */
    timePrefs: jsonb("time_prefs")
      .notNull()
      .default(sql`'{"v":1}'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.termCode] }),
  ],
);
