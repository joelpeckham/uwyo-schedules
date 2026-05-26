/** FAQ copy shared by the home page body and FAQPage JSON-LD. */
export const HOME_FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "How does the planner build my week?",
    answer:
      "You add courses from the UW catalog for a term. The planner scores conflict-free weeks that fit your list, busy-time blackouts, instructor preferences, and filters like no Fridays or open seats only. As you change anything, the week view updates. Pin a section to keep it, or drag a block to try a same-type alternative.",
  },
  {
    question: "What are busy-time blackouts?",
    answer:
      "You block times when you are not available (work, practice, childcare). The planner avoids those windows across all sections while your week stays conflict-free.",
  },
  {
    question: "What are instructor preferences?",
    answer:
      "When a course has multiple sections, you can rank instructors you prefer. Preferences are soft: if no week satisfies them, you still get valid alternatives.",
  },
  {
    question: "Can I try different section times or compare schedules?",
    answer:
      "Yes. Page through alternate conflict-free weeks, keep favorites, and open compare to see two weeks side by side. You can also copy a share link that restores your course list, blackouts, and time preferences for someone else to open in the planner.",
  },
  {
    question: "How do linked sections work?",
    answer:
      "Some courses require a lecture and lab or discussion that register together. When the catalog marks sections as linked, we treat those combinations as a single choice so you do not pick incompatible pieces.",
  },
  {
    question: "Does the planner work on a phone?",
    answer:
      "Yes. The interface is touch-friendly: pick a term, add courses, watch the week view update, pin sections or try same-type alternatives, and open section details from the calendar.",
  },
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
];
