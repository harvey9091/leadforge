"use client";

/**
 * PageHeader — consistent page title, description, and actions bar.
 *
 * Premium redesign:
 *  - Better typography hierarchy
 *  - More breathing room
 *  - Subtle separator
 *  - Cleaner action buttons
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold text-foreground tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-[13.5px] text-muted-foreground leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 pt-1">
            {actions}
          </div>
        )}
      </div>
      <Separator className="mt-6 bg-border/60" />
    </div>
  );
}
