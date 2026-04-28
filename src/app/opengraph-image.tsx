import { ImageResponse } from "next/og";
import {
  DAY_LABELS,
  LANDING_PREVIEW_HOUR_AXIS,
} from "@/components/planner/week-calendar/axis-constants";
import { formatHour } from "@/components/planner/week-calendar/block-metrics";

/** Matches landing PlannerPreview sample week (scaled ROW). */
const ROW = 32;
const DAY_H = LANDING_PREVIEW_HOUR_AXIS.length * ROW;

/** OG label set drops the trailing 4 p.m. row so the visual rhythm stays even. */
const HOUR_LABELS = LANDING_PREVIEW_HOUR_AXIS.slice(0, -1).map((h) =>
  formatHour(h),
);

const DAYS = DAY_LABELS.slice(0, 5);

const COLORS = {
  cream50: "#FBF7F0",
  cream100: "#f5efe3",
  border: "#ece2ce",
  fg: "#2B241C",
  fgMuted: "#6b5c44",
  fgSoft: "#8c7a5c",
  colBg: "#fdfcfa",
  primary: "#C4733F",
  primaryFg: "#FBF7F0",
  secondary: "#6a7c56",
  secondaryFg: "#FBF7F0",
  ochre100: "#f5e2b0",
  ochre300: "#e5bb58",
  ochre500: "#b8893a",
} as const;

function EventBlock({
  top,
  height,
  backgroundColor,
  color,
  border,
  borderStyle,
  code,
  timeLabel,
}: {
  top: number;
  height: number;
  backgroundColor: string;
  color: string;
  border?: string;
  borderStyle?: "solid" | "dashed";
  code: string;
  timeLabel: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 4,
        right: 4,
        height,
        borderRadius: 6,
        padding: "4px 6px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        backgroundColor,
        color,
        ...(border
          ? { border: `${borderStyle ?? "solid"} 2px ${border}` }
          : {}),
        boxShadow: "0 1px 2px rgba(27, 22, 16, 0.06)",
      }}
    >
      <div
        style={{
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.15,
        }}
      >
        {code}
      </div>
      <div style={{ fontSize: 10, opacity: 0.92, lineHeight: 1.15 }}>
        {timeLabel}
      </div>
    </div>
  );
}

export const alt =
  "uwyoschedule logo and sample conflict-free week calendar (MATH 2200, ENGL 1010, COSC 2030 with lab)";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const timeColW = 56;
  const dayColW = 210;
  const gridW = timeColW + 5 * dayColW;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: COLORS.cream50,
          padding: 44,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: COLORS.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: COLORS.primaryFg,
                fontSize: 40,
                fontFamily: "Georgia, serif",
                fontWeight: 500,
                letterSpacing: "-0.02em",
              }}
            >
              u
            </div>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline" }}>
              <span
                style={{
                  fontSize: 34,
                  color: COLORS.fg,
                  fontFamily: "Georgia, serif",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                }}
              >
                uwyo
              </span>
              <span
                style={{
                  fontSize: 34,
                  color: COLORS.primary,
                  fontFamily: "Georgia, serif",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                }}
              >
                Schedule
              </span>
            </div>
          </div>
          <div
            style={{
              maxWidth: 420,
              textAlign: "right",
              fontSize: 20,
              lineHeight: 1.35,
              color: COLORS.fgMuted,
              fontFamily: "Georgia, serif",
            }}
          >
            University of Wyoming class schedule planner
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            flex: 1,
            justifyContent: "flex-start",
          }}
        >
          <div
            style={{
              width: gridW,
              display: "flex",
              flexDirection: "column",
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 3px rgba(27, 22, 16, 0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <div
                style={{
                  width: timeColW,
                  minHeight: 36,
                  borderRight: `1px solid ${COLORS.border}`,
                  backgroundColor: COLORS.cream100,
                }}
              />
              {DAYS.map((d, i) => (
                <div
                  key={d}
                  style={{
                    width: dayColW,
                    minHeight: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRight:
                      i < DAYS.length - 1 ? `1px solid ${COLORS.border}` : "none",
                    backgroundColor: COLORS.cream100,
                    fontSize: 13,
                    fontWeight: 600,
                    color: COLORS.fg,
                    fontFamily: "ui-sans-serif, system-ui, sans-serif",
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "row" }}>
              <div
                style={{
                  width: timeColW,
                  height: DAY_H,
                  borderRight: `1px solid ${COLORS.border}`,
                  backgroundColor: COLORS.cream100,
                  display: "flex",
                  flexDirection: "column",
                  paddingTop: 2,
                }}
              >
                {HOUR_LABELS.map((h) => (
                  <div
                    key={h}
                    style={{
                      height: ROW,
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "flex-end",
                      paddingRight: 6,
                      fontSize: 10,
                      color: COLORS.fgSoft,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {/* Mon */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  width: dayColW,
                  height: DAY_H,
                  backgroundColor: COLORS.colBg,
                  borderRight: `1px solid ${COLORS.border}`,
                }}
              >
                <EventBlock
                  top={ROW}
                  height={ROW}
                  backgroundColor={COLORS.primary}
                  color={COLORS.primaryFg}
                  code="MATH 2200"
                  timeLabel="9–10 a.m."
                />
                <EventBlock
                  top={6 * ROW}
                  height={Math.round(1.25 * ROW)}
                  backgroundColor={COLORS.ochre100}
                  color={COLORS.ochre500}
                  border={COLORS.ochre300}
                  code="COSC 2030"
                  timeLabel="2–3:15 p.m."
                />
              </div>
              {/* Tue */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  width: dayColW,
                  height: DAY_H,
                  backgroundColor: COLORS.colBg,
                  borderRight: `1px solid ${COLORS.border}`,
                }}
              >
                <EventBlock
                  top={3 * ROW}
                  height={Math.round(1.25 * ROW)}
                  backgroundColor={COLORS.secondary}
                  color={COLORS.secondaryFg}
                  code="ENGL 1010"
                  timeLabel="11 a.m.–12:15 p.m."
                />
              </div>
              {/* Wed */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  width: dayColW,
                  height: DAY_H,
                  backgroundColor: COLORS.colBg,
                  borderRight: `1px solid ${COLORS.border}`,
                }}
              >
                <EventBlock
                  top={ROW}
                  height={ROW}
                  backgroundColor={COLORS.primary}
                  color={COLORS.primaryFg}
                  code="MATH 2200"
                  timeLabel="9–10 a.m."
                />
                <EventBlock
                  top={6 * ROW}
                  height={Math.round(1.25 * ROW)}
                  backgroundColor={COLORS.ochre100}
                  color={COLORS.ochre500}
                  border={COLORS.ochre300}
                  code="COSC 2030"
                  timeLabel="2–3:15 p.m."
                />
              </div>
              {/* Thu */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  width: dayColW,
                  height: DAY_H,
                  backgroundColor: COLORS.colBg,
                  borderRight: `1px solid ${COLORS.border}`,
                }}
              >
                <EventBlock
                  top={3 * ROW}
                  height={Math.round(1.25 * ROW)}
                  backgroundColor={COLORS.secondary}
                  color={COLORS.secondaryFg}
                  code="ENGL 1010"
                  timeLabel="11 a.m.–12:15 p.m."
                />
                <EventBlock
                  top={7 * ROW}
                  height={ROW}
                  backgroundColor={COLORS.ochre100}
                  color={COLORS.ochre500}
                  border={COLORS.ochre500}
                  borderStyle="dashed"
                  code="Lab"
                  timeLabel="3–4 p.m."
                />
              </div>
              {/* Fri */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  width: dayColW,
                  height: DAY_H,
                  backgroundColor: COLORS.colBg,
                }}
              >
                <EventBlock
                  top={ROW}
                  height={ROW}
                  backgroundColor={COLORS.primary}
                  color={COLORS.primaryFg}
                  code="MATH 2200"
                  timeLabel="9–10 a.m."
                />
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              fontSize: 16,
              color: COLORS.fgSoft,
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
            }}
          >
            From course list to class schedule.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
