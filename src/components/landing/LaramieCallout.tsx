import Link from "next/link";

export function LaramieCallout() {
  return (
    <section
      className="relative overflow-hidden border-b border-border bg-muted px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="laramie-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12] dark:opacity-[0.18]"
        aria-hidden
        style={{
          backgroundImage: "url(/brand/topo-divider.svg)",
          backgroundRepeat: "repeat-x",
          backgroundPosition: "center",
          backgroundSize: "auto 100%",
        }}
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <h2
          id="laramie-heading"
          className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
        >
          Built for UW students in Laramie
        </h2>
        <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          Independent and free. Not affiliated with the University of Wyoming.
          You register through official UW systems when your window opens.
        </p>
        <p className="mt-6">
          <Link
            href="/planner"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open the planner
          </Link>
        </p>
      </div>
    </section>
  );
}
