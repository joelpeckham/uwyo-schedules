import { cn } from "@/lib/utils";

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 96"
      fill="none"
      className={cn("h-8 w-40 text-foreground", className)}
      width={160}
      height={32}
      aria-hidden
    >
      <circle cx="48" cy="48" r="36" fill="#C4733F" />
      <text
        x="48"
        y="64"
        fontFamily="'Source Serif 4', 'Tiempos Headline', Georgia, serif"
        fontSize="48"
        fontWeight={500}
        fill="#FBF7F0"
        textAnchor="middle"
        letterSpacing="-0.02em"
      >
        u
      </text>
      <text
        x="100"
        y="62"
        fontFamily="'Source Serif 4', 'Tiempos Headline', Georgia, serif"
        fontSize="38"
        fontWeight={500}
        fill="currentColor"
        letterSpacing="-0.02em"
      >
        uwyo
        <tspan fill="#C4733F">Schedule</tspan>
      </text>
    </svg>
  );
}
