import { ImageResponse } from "next/og";
import {
  DAY_LABELS,
  LANDING_PREVIEW_HOUR_AXIS,
} from "@/components/planner/week-calendar/axis-constants";
import { formatHour } from "@/components/planner/week-calendar/block-metrics";
import {
  LANDING_PREVIEW_BLOCKS,
  LANDING_PREVIEW_CREDIT_HOURS,
  LANDING_PREVIEW_SOLUTION_TOTAL,
} from "@/lib/planner/landing-preview-blocks";
import { layoutPreviewBlocksForHourAxis } from "@/lib/planner/landing-preview-og-layout";
import { loadSourceSerif500ForOg, OG_SERIF_FAMILY } from "@/lib/seo/og-fonts";
import { SITE_TAGLINE } from "@/lib/seo/site";

/** Row height tuned for 1200×630 with brand header + planner chrome. */
const ROW = 26;
const HOUR_AXIS = LANDING_PREVIEW_HOUR_AXIS;
const GRID_H = HOUR_AXIS.length * ROW;
const WEEKDAYS = DAY_LABELS.slice(0, 5);

const COLORS = {
  cream50: "#FBF7F0",
  cream100: "#f5efe3",
  border: "#ece2ce",
  fg: "#2B241C",
  fgMuted: "#6b5c44",
  fgSoft: "#8c7a5c",
  colBg: "#fdfcfa",
  card: "#ffffff",
  primary: "#C4733F",
  primaryFg: "#FBF7F0",
  muted: "#f5efe3",
} as const;

function OgWordmark() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: COLORS.primary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: OG_SERIF_FAMILY,
            fontSize: 24,
            fontWeight: 500,
            color: COLORS.primaryFg,
            letterSpacing: "-0.02em",
          }}
        >
          u
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "baseline",
          marginLeft: 4,
          fontFamily: OG_SERIF_FAMILY,
          fontSize: 19,
          fontWeight: 500,
          letterSpacing: "-0.02em",
        }}
      >
        <span style={{ color: COLORS.fg }}>uwyo</span>
        <span style={{ color: COLORS.primary }}>Schedule</span>
      </div>
    </div>
  );
}

function blockSecondaryLine(block: (typeof LANDING_PREVIEW_BLOCKS)[number]): string {
  const inst = block.instructorSublabel?.trim() ?? "";
  const seats = block.seatsAvailable;
  const seatChip =
    typeof seats === "number" && Number.isFinite(seats)
      ? `${Math.max(0, seats)} seat${seats === 1 ? "" : "s"}`
      : "";
  if (inst && seatChip) return `${inst} · ${seatChip}`;
  return inst || seatChip || block.sublabel.trim();
}

function OgCalendarBlock({
  top,
  height,
  label,
  secondary,
  accentColor,
  isLab,
}: {
  top: number;
  height: number;
  label: string;
  secondary: string;
  accentColor: string;
  isLab?: boolean;
}) {
  const showSecondary = height >= 28 && secondary.length > 0;
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 2,
        right: 2,
        height,
        borderRadius: 6,
        paddingTop: 3,
        paddingBottom: 3,
        paddingLeft: 7,
        paddingRight: 5,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        backgroundColor: COLORS.card,
        color: COLORS.fg,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `4px solid ${accentColor}`,
        boxShadow: "0 1px 2px rgba(27, 22, 16, 0.06)",
        overflow: "hidden",
        ...(isLab
          ? {
              borderStyle: "dashed",
              borderLeftStyle: "solid",
            }
          : {}),
      }}
    >
      <div
        style={{
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1.15,
        }}
      >
        {label}
      </div>
      {showSecondary ? (
        <div
          style={{
            marginTop: 2,
            fontSize: 8,
            lineHeight: 1.15,
            color: COLORS.fgMuted,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
          {secondary}
        </div>
      ) : null}
    </div>
  );
}

export const alt =
  "uwyoschedule UW class schedule planner with sample conflict-free week (MATH 2200, ENGL 1010, COSC 2030 with discussion and lab)";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const timeColW = 48;
  const dayColW = 196;
  const gridW = timeColW + 5 * dayColW;
  const sourceSerif500 = await loadSourceSerif500ForOg();
  const blocksByDay = layoutPreviewBlocksForHourAxis(
    LANDING_PREVIEW_BLOCKS,
    HOUR_AXIS,
    ROW,
  );

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: COLORS.cream50,
          padding: "28px 36px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            marginBottom: 16,
          }}
        >
          <OgWordmark />
          <div
            style={{
              maxWidth: 360,
              textAlign: "right",
              fontSize: 17,
              lineHeight: 1.3,
              color: COLORS.fgMuted,
              fontFamily: OG_SERIF_FAMILY,
              fontWeight: 500,
            }}
          >
            UW class schedule planner
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            flex: 1,
          }}
        >
          <div
            style={{
              width: gridW,
              display: "flex",
              flexDirection: "column",
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              backgroundColor: COLORS.card,
              boxShadow: "0 1px 3px rgba(27, 22, 16, 0.08)",
              overflow: "hidden",
            }}
          >
            {/* Toolbar — matches WeekCalendarToolbar */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: COLORS.fg,
                    fontFamily: OG_SERIF_FAMILY,
                  }}
                >
                  Weekly schedule
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: 22,
                    padding: "0 8px",
                    borderRadius: 999,
                    border: `1px solid ${COLORS.border}`,
                    backgroundColor: COLORS.muted,
                    fontSize: 10,
                    color: COLORS.fgMuted,
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  }}
                >
                  {LANDING_PREVIEW_CREDIT_HOURS} cr
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: COLORS.fgSoft,
                  fontFamily: "ui-sans-serif, system-ui, sans-serif",
                }}
              >
                Copy / export
              </span>
            </div>

            {/* Solutions pager — matches SolutionsPagerBar */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 14px",
                borderBottom: `1px solid ${COLORS.border}`,
                backgroundColor: "rgba(245, 239, 227, 0.35)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontSize: 11,
                    color: COLORS.fgMuted,
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  }}
                >
                  1 / {LANDING_PREVIEW_SOLUTION_TOTAL}
                </span>
                <span style={{ fontSize: 11, color: COLORS.fgSoft }}>‹ ›</span>
              </div>
              <div style={{ display: "flex", flexDirection: "row", gap: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    padding: "3px 8px",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.fgMuted,
                  }}
                >
                  Keep
                </span>
                <span
                  style={{
                    fontSize: 10,
                    padding: "3px 8px",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.fgMuted,
                  }}
                >
                  Compare (0)
                </span>
              </div>
            </div>

            {/* Day header */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                borderBottom: `1px solid ${COLORS.border}`,
                backgroundColor: "rgba(245, 239, 227, 0.55)",
              }}
            >
              <div
                style={{
                  width: timeColW,
                  minHeight: 28,
                  borderRight: `1px solid ${COLORS.border}`,
                }}
              />
              {WEEKDAYS.map((d, i) => (
                <div
                  key={d}
                  style={{
                    width: dayColW,
                    minHeight: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRight:
                      i < WEEKDAYS.length - 1 ? `1px solid ${COLORS.border}` : "none",
                    fontSize: 11,
                    fontWeight: 600,
                    color: COLORS.fgMuted,
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div style={{ display: "flex", flexDirection: "row" }}>
              <div
                style={{
                  width: timeColW,
                  height: GRID_H,
                  borderRight: `1px solid ${COLORS.border}`,
                  backgroundColor: "rgba(245, 239, 227, 0.35)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {HOUR_AXIS.map((h) => (
                  <div
                    key={h}
                    style={{
                      height: ROW,
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "flex-end",
                      paddingRight: 4,
                      fontSize: 9,
                      color: COLORS.fgSoft,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    }}
                  >
                    {formatHour(h)}
                  </div>
                ))}
              </div>

              {WEEKDAYS.map((d, dayIndex) => (
                <div
                  key={d}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    width: dayColW,
                    height: GRID_H,
                    backgroundColor: COLORS.colBg,
                    borderRight:
                      dayIndex < WEEKDAYS.length - 1
                        ? `1px solid ${COLORS.border}`
                        : "none",
                  }}
                >
                  {HOUR_AXIS.map((h) => (
                    <div
                      key={h}
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: (h - (HOUR_AXIS[0] ?? 0)) * ROW,
                        height: ROW,
                        borderBottom: `1px solid rgba(236, 226, 206, 0.85)`,
                      }}
                    />
                  ))}
                  {(blocksByDay.get(dayIndex) ?? []).map(({ block, topPx, heightPx }) => (
                    <OgCalendarBlock
                      key={block.key}
                      top={topPx}
                      height={heightPx}
                      label={block.label}
                      secondary={blockSecondaryLine(block)}
                      accentColor={block.color}
                      isLab={block.sectionScheduleTypeKey === "lab"}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              fontSize: 14,
              color: COLORS.fgSoft,
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
            }}
          >
            {SITE_TAGLINE}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: OG_SERIF_FAMILY,
          data: sourceSerif500,
          weight: 500,
          style: "normal",
        },
      ],
    },
  );
}
