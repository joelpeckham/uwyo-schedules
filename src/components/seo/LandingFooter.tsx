import { AppLink } from "@/components/seo/AppLink";

const featuredSubjects = [
  "MATH",
  "ENGL",
  "COSC",
  "LIFE",
  "CHEM",
  "PHYS",
  "STAT",
  "PSYC",
  "ECON",
  "ACCT",
] as const;

function subjectHref(code: string) {
  return `/courses/${encodeURIComponent(code.toLowerCase())}`;
}

export function LandingFooter({
  latestTerm,
}: {
  latestTerm: { code: string; description: string } | null;
}) {
  return (
    <footer className="border-t border-border bg-muted/15 px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:max-w-[90rem]">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
            Browse by subject
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-sm">
            {featuredSubjects.map((code) => (
              <li key={code}>
                <AppLink
                  href={subjectHref(code)}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {code}
                </AppLink>
              </li>
            ))}
            <li>
              <AppLink
                href="/courses"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                All subjects
              </AppLink>
            </li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <AppLink className="hover:text-primary hover:underline" href="/planner">
            Planner
          </AppLink>
          <AppLink className="hover:text-primary hover:underline" href="/about">
            About
          </AppLink>
          <AppLink className="hover:text-primary hover:underline" href="/faq">
            FAQ
          </AppLink>
          <AppLink className="hover:text-primary hover:underline" href="/terms">
            Terms
          </AppLink>
          {latestTerm ? (
            <AppLink
              className="hover:text-primary hover:underline"
              href={`/terms/${encodeURIComponent(latestTerm.code)}`}
            >
              {latestTerm.description}
            </AppLink>
          ) : null}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Built for UW students. Not affiliated with the University of Wyoming.
          Always confirm CRNs and requirements in the UW course catalog.
        </p>
      </div>
    </footer>
  );
}
