"use client";

/**
 * Section — labeled content group with optional action.
 *
 * Used inside pages to break content into clear visual zones without
 * needing a card around everything.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: SectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || actions) && (
        <div className="flex items-end justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-[14px] font-semibold text-foreground tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-[12.5px] text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
