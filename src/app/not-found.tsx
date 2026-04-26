import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 bg-background px-4 py-16 text-center">
      <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
        That schedule doesn&apos;t exist.
      </h1>
      <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
        The page you wanted isn&apos;t here. Try the planner, browse courses by
        subject, or pick a term from the catalog.
      </p>
      <nav className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
        <Link className="text-primary underline-offset-4 hover:underline" href="/">
          Home
        </Link>
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href="/planner"
        >
          Planner
        </Link>
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href="/courses"
        >
          Courses by subject
        </Link>
        <Link className="text-primary underline-offset-4 hover:underline" href="/terms">
          Terms
        </Link>
        <Link className="text-primary underline-offset-4 hover:underline" href="/faq">
          FAQ
        </Link>
      </nav>
    </div>
  );
}
