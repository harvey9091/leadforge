"use client";

/**
 * EmptyState — intentional empty page state with helpful illustration.
 *
 * Premium redesign:
 *  - Better visual hierarchy
 *  - More refined illustration area
 *  - Clearer actions
 *  - Better spacing
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

const emptyVariants = cva(
  "flex flex-col items-center justify-center text-center py-16 px-6",
  {
    variants: {
      size: {
        default: "py-16",
        sm: "py-10",
        lg: "py-24",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = "default",
}: EmptyStateProps) {
  return (
    <div className={cn(emptyVariants({ size }), className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center mb-5 text-muted-foreground/60">
          <Icon className="w-7 h-7" />
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-foreground mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-[13.5px] text-muted-foreground leading-relaxed max-w-sm mb-6">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
