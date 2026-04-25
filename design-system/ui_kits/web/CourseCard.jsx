// CourseCard — used in the "added courses" sidebar.
function CourseCard({ course, onRemove }) {
  return (
    <article className="course-card">
      <div className="course-card-head">
        <div>
          <div className="course-code">{course.code}</div>
          <div className="course-title">{course.title}</div>
        </div>
        <button className="course-remove" aria-label="Remove" onClick={() => onRemove(course.code)}>
          <i data-lucide="x"></i>
        </button>
      </div>
      <div className="course-card-meta">
        <span className="badge badge-neutral">{course.credits} cr</span>
        <span className="badge badge-success"><span className="dot"></span>{course.openSections} open</span>
        {course.required && <span className="badge badge-primary">Required</span>}
      </div>
    </article>
  );
}

// CourseSearchResult — row in the search dropdown / catalog list.
function CourseSearchResult({ course, onAdd, added }) {
  return (
    <li className="search-row">
      <div>
        <div className="search-row-code">{course.code}</div>
        <div className="search-row-title">{course.title}</div>
        <div className="search-row-sub">{course.credits} credits · {course.sections} sections</div>
      </div>
      <button
        className={`btn ${added ? "btn-ghost" : "btn-secondary"} btn-sm`}
        onClick={() => onAdd(course)}
        disabled={added}
      >
        {added ? <><i data-lucide="check"></i> Added</> : <><i data-lucide="plus"></i> Add</>}
      </button>
    </li>
  );
}

window.CourseCard = CourseCard;
window.CourseSearchResult = CourseSearchResult;
