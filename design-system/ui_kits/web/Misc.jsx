// ResultPager — shows "Schedule 3 of 12" with prev/next.
function ResultPager({ index, total, onPrev, onNext }) {
  return (
    <div className="result-pager">
      <button className="pager-btn" onClick={onPrev} disabled={index === 0}>
        <i data-lucide="chevron-left"></i>
      </button>
      <div className="pager-text">
        <span className="pager-current">Schedule {index + 1}</span>
        <span className="pager-total">of {total}</span>
      </div>
      <button className="pager-btn" onClick={onNext} disabled={index >= total - 1}>
        <i data-lucide="chevron-right"></i>
      </button>
    </div>
  );
}

// SummaryStat — a single number+label tile in the sidebar
function SummaryStat({ label, value, accent }) {
  return (
    <div className="summary-stat">
      <div className="summary-value" style={{ color: accent || "var(--fg)" }}>{value}</div>
      <div className="summary-label">{label}</div>
    </div>
  );
}

// EmptyState — friendly empty state with serif headline.
function EmptyState({ title, body, action }) {
  return (
    <div className="empty-state">
      <i data-lucide="calendar-days" className="empty-icon"></i>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

window.ResultPager = ResultPager;
window.SummaryStat = SummaryStat;
window.EmptyState = EmptyState;
