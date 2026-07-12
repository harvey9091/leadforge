/**
 * Brand logo — a minimal, geometric mark.
 *
 * The mark is a stylized "L" formed by two intersecting bars — a vertical
 * spar (representing the lead pipeline) and a horizontal signal bar (the
 * enrichment signal). Drawn as SVG so it scales crisply at any size and
 * adopts `currentColor` for theming.
 */

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Show the wordmark next to the mark. */
  withWordmark?: boolean;
  size?: number;
}

export function Logo({ className, withWordmark = true, size = 24 }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-foreground shrink-0"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="7" className="fill-foreground" fillOpacity="0.04" />
        <rect width="32" height="32" rx="7" className="stroke-foreground" strokeOpacity="0.08" strokeWidth="1" />
        {/* Vertical spar — the pipeline */}
        <rect x="9" y="7" width="3.5" height="18" rx="1.75" className="fill-foreground" />
        {/* Horizontal signal bar — the enrichment */}
        <rect x="9" y="21.5" width="14" height="3.5" rx="1.75" className="fill-foreground" />
        {/* Accent dot — the qualified lead */}
        <circle cx="23" cy="9.5" r="2.5" className="fill-foreground" fillOpacity="0.45" />
      </svg>
      {withWordmark && (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          Leadforge
        </span>
      )}
    </div>
  );
}
