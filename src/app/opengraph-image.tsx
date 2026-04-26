import { ImageResponse } from "next/og";

export const alt = "uwyoschedule — University of Wyoming class schedule planner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "#FBF7F0",
          padding: 72,
        }}
      >
        <div
          style={{
            fontSize: 76,
            color: "#2B241C",
            fontWeight: 600,
            fontFamily: "Georgia, 'Source Serif 4', serif",
            letterSpacing: "-0.02em",
          }}
        >
          uwyoschedule
        </div>
        <div
          style={{
            fontSize: 34,
            color: "#5C4F42",
            marginTop: 20,
            maxWidth: 920,
            lineHeight: 1.25,
            fontFamily: "Georgia, 'Source Serif 4', serif",
          }}
        >
          University of Wyoming class schedule planner
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 22,
            color: "#8A7B6E",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          From course list to class schedule, in minutes.
        </div>
      </div>
    ),
    { ...size },
  );
}
