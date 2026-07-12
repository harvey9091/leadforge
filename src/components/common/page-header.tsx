"use client";

/**
 * PageHeader — consistent page-level title + description + actions.
 *
 * Every dashboard page starts with one of these to anchor the user.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[13.5px] text-muted-foreground leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
