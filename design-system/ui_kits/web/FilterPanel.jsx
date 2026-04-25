// FilterPanel — sliders/toggles for "no Friday", time-of-day, etc.
function FilterPanel({ filters, setFilters }) {
  return (
    <aside className="filter-panel">
      <div className="filter-head">
        <i data-lucide="sliders-horizontal"></i>
        <span>Preferences</span>
      </div>

      <div className="filter-group">
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={filters.noFriday}
            onChange={e => setFilters({ ...filters, noFriday: e.target.checked })}
          />
          <span className="toggle-track"><span className="toggle-thumb"></span></span>
          <span>No Friday classes</span>
        </label>
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={filters.noEarly}
            onChange={e => setFilters({ ...filters, noEarly: e.target.checked })}
          />
          <span className="toggle-track"><span className="toggle-thumb"></span></span>
          <span>No classes before 9 a.m.</span>
        </label>
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={filters.lunchBreak}
            onChange={e => setFilters({ ...filters, lunchBreak: e.target.checked })}
          />
          <span className="toggle-track"><span className="toggle-thumb"></span></span>
          <span>Lunch break (noon–1 p.m.)</span>
        </label>
      </div>

      <div className="filter-divider"></div>

      <div className="filter-group">
        <div className="filter-label">Preferred days</div>
        <div className="day-pills">
          {["M", "T", "W", "R", "F"].map(d => (
            <button
              key={d}
              className={`day-pill ${filters.days.includes(d) ? "active" : ""}`}
              onClick={() => {
                const days = filters.days.includes(d)
                  ? filters.days.filter(x => x !== d)
                  : [...filters.days, d];
                setFilters({ ...filters, days });
              }}
            >{d}</button>
          ))}
        </div>
      </div>
    </aside>
  );
}

window.FilterPanel = FilterPanel;
