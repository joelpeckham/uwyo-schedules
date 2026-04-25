import React from "react";

// ScheduleGrid — weekly calendar grid showing class blocks Mon–Fri.
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function formatHour(h) {
  if (h === 12) return "12 p.m.";
  if (h > 12) return `${h - 12} p.m.`;
  return `${h} a.m.`;
}

function ScheduleGrid({ blocks = [] }) {
  // blocks: [{day: 'Mon', start: 9.5, end: 10.75, code, title, color}]
  const dayIndex = (d) => DAYS.indexOf(d);

  return (
    <div className="schedule-grid">
      <div className="schedule-corner"></div>
      {DAYS.map(d => <div key={d} className="schedule-day-head">{d}</div>)}

      {HOURS.map(h => (
        <React.Fragment key={h}>
          <div className="schedule-hour-label">{formatHour(h)}</div>
          {DAYS.map(d => (
            <div key={d + h} className="schedule-cell"></div>
          ))}
        </React.Fragment>
      ))}

      {/* Class blocks layered absolutely */}
      <div className="schedule-blocks">
        {blocks.map((b, i) => {
          const col = dayIndex(b.day);
          if (col < 0) return null;
          const top = ((b.start - HOURS[0]) / (HOURS.length)) * 100;
          const height = ((b.end - b.start) / (HOURS.length)) * 100;
          const left = (col / DAYS.length) * 100;
          const width = (1 / DAYS.length) * 100;
          return (
            <div
              key={i}
              className="schedule-block"
              style={{
                top: `${top}%`,
                height: `${height}%`,
                left: `${left}%`,
                width: `${width}%`,
                background: b.color || "var(--rust-100)",
                borderLeft: `3px solid ${b.accent || "var(--rust-400)"}`,
              }}
            >
              <div className="block-code">{b.code}</div>
              <div className="block-time">{formatHour(b.start).replace(" ", "")}–{formatHour(b.end).replace(" ", "")}</div>
              <div className="block-room">{b.room}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.ScheduleGrid = ScheduleGrid;
