import { ImageResponse } from "next/og";
import { getCourseSeoDetailForSeo, pathSegmentToSubject } from "@/lib/seo/queries";

export const alt = "Course on uwyoschedule";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ subject: string; number: string }> };

export default async function Image({ params }: Props) {
  // `getCourseSeoDetailForSeo` already wraps its query in `'use cache'` with a
  // per-course tag, so the actual DB read is cached and freshness is tied to
  // ingest's `revalidateTag`. Cache Components rejects the previous
  // `revalidate` segment config in this file.

  const { subject: seg, number } = await params;
  const subject = pathSegmentToSubject(seg);
  const detail = await getCourseSeoDetailForSeo(subject, number.trim());
  const line1 = detail
    ? `${detail.subject} ${detail.courseNumber}`
    : "Course";
  const line2 = detail?.title ?? "University of Wyoming";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#FBF7F0",
          padding: 72,
        }}
      >
        <div
          style={{
            fontSize: 64,
            color: "#2B241C",
            fontWeight: 600,
            fontFamily: "Georgia, serif",
          }}
        >
          {line1}
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 32,
            color: "#5C4F42",
            maxWidth: 980,
            lineHeight: 1.25,
            fontFamily: "Georgia, serif",
          }}
        >
          {line2}
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 22,
            color: "#8A7B6E",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          uwyoschedule · University of Wyoming
        </div>
      </div>
    ),
    { ...size },
  );
}
