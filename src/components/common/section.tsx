"use client";

/**
 * Section — titled content section wrapper.
 *
 * Premium redesign:
 *  - Better spacing and breathing room
 *  - Cleaner typography
 *  - More refined card wrapper
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function Section({
  title,
  description,
  children,
  actions,
  className,
  contentClassName,
}: SectionProps) {
  return (
    <Card className={cn("border-border/60 bg-card/40 overflow-hidden", className)}>
      <div className="p-5 pb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">
            {title}
          </h3>
          {description && (
            <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            {actions}
          </div>
        )}
      </div>
      <div className={cn("px-5 pb-5", contentClassName)}>
        {children}
      </div>
    </Card>
  );
}
