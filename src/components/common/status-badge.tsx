"use client";

/**
 * StatusBadge — semantic status pill with consistent colors.
 *
 * Premium redesign:
 *  - More refined badge styling
 *  - Better spacing and typography
 *  - Subtle dot indicator
 *  - Cleaner borders
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

const statusVariants = cva(
  "inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border",
  {
    variants: {
      tone: {
        neutral: "bg-muted/50 text-muted-foreground border-border/50",
        info: "bg-info/10 text-info border-info/20",
        success: "bg-success/10 text-success border-success/20",
        warning: "bg-warning/10 text-warning-foreground border-warning/30",
        danger: "bg-destructive/10 text-destructive border-destructive/20",
        accent: "bg-foreground/8 text-foreground border-foreground/15",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

type Tone = VariantProps<typeof statusVariants>["tone"];

const TONE_MAP: Record<string, Tone> = {
  NEW: "info",
  QUALIFIED: "success",
  DISQUALIFIED: "danger",
  CONTACTED: "accent",
  RESPONDED: "accent",
  MEETING_BOOKED: "success",
  CLOSED_WON: "success",
  CLOSED_LOST: "danger",
  ACTIVE: "success",
  PAUSED: "warning",
  DRAFT: "neutral",
  SCHEDULED: "info",
  COMPLETED: "neutral",
  ARCHIVED: "neutral",
  QUEUED: "neutral",
  RUNNING: "info",
  COMPLETED_JOB: "success",
  FAILED: "danger",
  RETRYING: "warning",
  CANCELLED: "neutral",
  healthy: "success",
  degraded: "warning",
  unhealthy: "danger",
  up: "success",
  down: "danger",
  pending: "neutral",
};

export function StatusBadge({
  status,
  label,
  tone,
  className,
}: {
  status?: string;
  label?: string;
  tone?: Tone;
  className?: string;
}) {
  const resolvedTone = tone ?? TONE_MAP[status ?? ""] ?? "neutral";
  const display = label ?? status ?? "—";
  // Normalize "MEETING_BOOKED" → "Meeting booked"
  const text = display
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className={cn(statusVariants({ tone: resolvedTone }), className)}>
      <span className="w-1 h-1 rounded-full bg-current" />
      {text}
    </span>
  );
}

/**
 * GradeBadge — for A/B/C/D/F lead grades.
 */
export function GradeBadge({ grade, className }: { grade: string; className?: string }) {
  const tone: Tone =
    grade === "A"
      ? "success"
      : grade === "B"
        ? "info"
        : grade === "C"
          ? "warning"
          : "danger";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-7 h-7 rounded-lg text-[12px] font-bold border",
        tone === "success" && "bg-success/10 text-success border-success/20",
        tone === "info" && "bg-info/10 text-info border-info/20",
        tone === "warning" && "bg-warning/10 text-warning-foreground border-warning/30",
        tone === "danger" && "bg-destructive/10 text-destructive border-destructive/20",
        className
      )}
    >
      {grade}
    </span>
  );
}
