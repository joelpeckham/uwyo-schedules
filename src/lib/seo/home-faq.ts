/** FAQ copy shared by the home page body and FAQPage JSON-LD. */
export const HOME_FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "Where does this data come from?",
    answer:
      "Section and meeting data are pulled from the University of Wyoming course catalog. We store a working copy so the planner can search and combine sections quickly.",
  },
  {
    question: "How current is the catalog?",
    answer:
      "We run scheduled ingest jobs to refresh the primary term on a short cadence and archive terms on a slower cadence. Seat counts and meeting details can still change in the UW course catalog after our last sync.",
  },
  {
    question: "Does uwyoschedule register me for classes?",
    answer:
      "No. This is a planning tool only. You still register through the official UW systems when your enrollment window opens.",
  },
  {
    question: "Is uwyoschedule an official University of Wyoming product?",
    answer:
      "No. uwyoschedule is an independent planner built for UW students. Always double-check critical details (CRN, prerequisites, linked labs) in the UW course catalog before you register.",
  },
  {
    question: "How do linked sections work?",
    answer:
      "Some courses require a lecture and lab or discussion that register together. When the catalog marks sections as linked, we treat those combinations as a single choice so you do not accidentally pick incompatible pieces.",
  },
  {
    question: "What are instructor preferences?",
    answer:
      "You can tell the solver which instructors you would prefer for a course when multiple sections exist. Preferences are soft: if no schedule satisfies them, we still show valid alternatives.",
  },
  {
    question: "What are busy-time blackouts?",
    answer:
      "You can block times when you are not available (work, practice, childcare). The planner only returns weekly schedules that avoid those windows across all of your sections.",
  },
  {
    question: "Does the planner work on a phone?",
    answer:
      "Yes. The interface is touch-friendly: you can pick terms, add courses, page through valid schedules, and open section details from the calendar.",
  },
];
