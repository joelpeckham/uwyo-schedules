"use client";

export function SkipToMain() {
  return (
    <a
      href="#main-content"
      className="fixed top-0 left-4 z-[100] -translate-y-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition focus:translate-y-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById("main-content");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
        queueMicrotask(() => el?.focus());
      }}
    >
      Skip to main content
    </a>
  );
}
