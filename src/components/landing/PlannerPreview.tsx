const ROW = 40;
const DAY_H = 9 * ROW;

const HOURS = [
  "8 a.m.",
  "9 a.m.",
  "10 a.m.",
  "11 a.m.",
  "12 p.m.",
  "1 p.m.",
  "2 p.m.",
  "3 p.m.",
  "4 p.m.",
] as const;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

function PreviewBlock({
  topPx,
  heightPx,
  className,
  code,
  timeLabel,
}: {
  topPx: number;
  heightPx: number;
  className: string;
  code: string;
  timeLabel: string;
}) {
  return (
    <div
      className={`absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1 py-0.5 text-[10px] leading-tight shadow-sm ring-1 ring-black/5 sm:left-1 sm:right-1 sm:px-1.5 sm:text-xs ${className}`}
      style={{ top: topPx, height: heightPx }}
    >
      <div className="truncate font-mono font-semibold tabular-nums">{code}</div>
      <div className="truncate opacity-90">{timeLabel}</div>
    </div>
  );
}

export function PlannerPreview() {
  return (
    <section
      className="border-b border-border bg-muted/20 px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="preview-heading"
    >
      <div className="mx-auto max-w-6xl lg:max-w-[90rem]">
        <h2
          id="preview-heading"
          className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
        >
          What a solved week can look like
        </h2>
        <p className="sr-only">
          Sample week preview: MATH 2200 meets Monday, Wednesday, and Friday
          9–10 a.m.; ENGL 1010 meets Tuesday and Thursday 11 a.m.–12:15 p.m.;
          COSC 2030 meets Monday and Wednesday 2–3:15 p.m. with a linked lab
          Thursday 3–4 p.m. Three courses, no overlaps, lab linked automatically.
        </p>
        <figure className="mt-8" aria-hidden>
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <div
              className="grid min-w-[520px] grid-cols-[3.25rem_repeat(5,minmax(0,1fr))] text-left"
              style={{ gridTemplateRows: `auto ${DAY_H}px` }}
            >
              <div className="border-b border-r bg-muted/40 p-2" />
              {DAYS.map((d, i) => (
                <div
                  key={d}
                  className={`border-b border-r bg-muted/40 p-2 text-center text-xs font-medium text-foreground ${i === DAYS.length - 1 ? "border-r-0" : ""}`}
                >
                  {d}
                </div>
              ))}

              <div
                className="border-r bg-muted/20 py-1 text-[10px] text-muted-foreground"
                style={{ height: DAY_H }}
              >
                {HOURS.slice(0, -1).map((h, i) => (
                  <div
                    key={h}
                    className="flex items-start justify-end pr-1 font-mono tabular-nums"
                    style={{ height: ROW }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {/* Mon */}
              <div
                className="relative border-r border-border bg-background/80"
                style={{ height: DAY_H }}
              >
                <PreviewBlock
                  topPx={ROW}
                  heightPx={ROW}
                  className="bg-primary text-primary-foreground"
                  code="MATH 2200"
                  timeLabel="9–10 a.m."
                />
                <PreviewBlock
                  topPx={6 * ROW}
                  heightPx={Math.round(1.25 * ROW)}
                  className="border border-[var(--ochre-300)] bg-[var(--ochre-100)] text-[var(--ochre-500)]"
                  code="COSC 2030"
                  timeLabel="2–3:15 p.m."
                />
              </div>
              {/* Tue */}
              <div
                className="relative border-r border-border bg-background/80"
                style={{ height: DAY_H }}
              >
                <PreviewBlock
                  topPx={3 * ROW}
                  heightPx={Math.round(1.25 * ROW)}
                  className="bg-secondary text-secondary-foreground"
                  code="ENGL 1010"
                  timeLabel="11 a.m.–12:15 p.m."
                />
              </div>
              {/* Wed */}
              <div
                className="relative border-r border-border bg-background/80"
                style={{ height: DAY_H }}
              >
                <PreviewBlock
                  topPx={ROW}
                  heightPx={ROW}
                  className="bg-primary text-primary-foreground"
                  code="MATH 2200"
                  timeLabel="9–10 a.m."
                />
                <PreviewBlock
                  topPx={6 * ROW}
                  heightPx={Math.round(1.25 * ROW)}
                  className="border border-[var(--ochre-300)] bg-[var(--ochre-100)] text-[var(--ochre-500)]"
                  code="COSC 2030"
                  timeLabel="2–3:15 p.m."
                />
              </div>
              {/* Thu */}
              <div
                className="relative border-r border-border bg-background/80"
                style={{ height: DAY_H }}
              >
                <PreviewBlock
                  topPx={3 * ROW}
                  heightPx={Math.round(1.25 * ROW)}
                  className="bg-secondary text-secondary-foreground"
                  code="ENGL 1010"
                  timeLabel="11 a.m.–12:15 p.m."
                />
                <PreviewBlock
                  topPx={7 * ROW}
                  heightPx={ROW}
                  className="border border-dashed border-[var(--ochre-500)] bg-[var(--ochre-100)]/90 text-[var(--ochre-500)]"
                  code="Lab"
                  timeLabel="3–4 p.m."
                />
              </div>
              {/* Fri */}
              <div
                className="relative border-r border-border bg-background/80 last:border-r-0"
                style={{ height: DAY_H }}
              >
                <PreviewBlock
                  topPx={ROW}
                  heightPx={ROW}
                  className="bg-primary text-primary-foreground"
                  code="MATH 2200"
                  timeLabel="9–10 a.m."
                />
              </div>
            </div>
          </div>
          <figcaption className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Illustrative week — not your real schedule. Three courses, no
            overlaps, lab linked automatically.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
