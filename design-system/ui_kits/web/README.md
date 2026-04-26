# uwyoschedule Web — UI Kit

High-fidelity recreation of the uwyoschedule schedule builder. This is the canonical surface for the brand: a three-column app with search/courses on the left, a weekly calendar in the middle, and preferences/summary on the right.

## What's here

| File | Purpose |
|---|---|
| `index.html` | Interactive prototype. Search the catalog, add/remove classes, page between sample schedules, toggle preferences. |
| `styles.css` | Component CSS — depends on `colors_and_type.css` at the project root. |
| `TopBar.jsx` | Sticky top nav: brand lockup, primary nav, user chip. |
| `CourseCard.jsx` | Added-class card + catalog search row. |
| `ScheduleGrid.jsx` | Weekly Mon–Fri grid with absolutely-positioned class blocks. |
| `FilterPanel.jsx` | Toggles + day-pills for "no Friday", "mornings only", etc. |
| `Misc.jsx` | `ResultPager`, `SummaryStat`, `EmptyState`. |

## Notes

- Everything cosmetic. The "schedule generator" is three hand-built sample schedules; toggling preferences doesn't actually re-rank.
- Class blocks are pre-positioned via top/height/left/width percentages.
- Lucide icons load via CDN; `lucide.createIcons()` runs on every render to catch newly-added `<i data-lucide>` nodes.
- All design tokens come from the root `colors_and_type.css` — change a token there and every component updates.
