"use client";

/**
 * EmptyState — friendly placeholder for empty data states.
 *
 * Designed to be visually quiet — no big illustrations, just a clean
 * icon + message + optional CTA. The user should never feel like the
 * app is broken when there's no data.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center justify-center text-center p-10 border-dashed border-border/60 bg-card/20",
        className
      )}
    >
      {Icon && (
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted/40 text-muted-foreground mb-3">
          <Icon className="w-4.5 h-4.5" />
        </div>
      )}
      <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-[12.5px] text-muted-foreground max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}
