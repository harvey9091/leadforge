"use client";

/**
 * Stat / KPI card — premium redesign for dashboard metrics.
 *
 * Features:
 *  - Larger, more refined typography
 *  - Better spacing and breathing room
 *  - Subtle gradient icon backgrounds
 *  - Smooth hover elevation
 *  - Animated counter with better timing
 */

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, ArrowRight } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { AnimatedCounter } from "@/components/animations/animated-counter";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StatCardProps {
  label: string;
  value: number | string;
  /** When a number is provided, formatNumber is applied. */
  format?: "number" | "compact" | "percent" | "currency" | "raw";
  delta?: number;
  /** Period label for the delta — e.g. "vs last 7 days". */
  deltaPeriod?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  format = "number",
  delta,
  deltaPeriod = "vs last 7 days",
  icon: Icon,
  className,
  loading,
}: StatCardProps) {
  const formatted = React.useMemo(() => {
    if (typeof value === "string") return value;
    switch (format) {
      case "compact":
        return formatNumber(value, { compact: true });
      case "percent":
        return `${value.toFixed(1)}%`;
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(value);
      case "raw":
        return String(value);
      default:
        return formatNumber(value);
    }
  }, [value, format]);

  const deltaState =
    delta === undefined || delta === 0
      ? "flat"
      : delta > 0
        ? "up"
        : "down";

  return (
    <Card
      className={cn(
        "relative p-5 border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden group transition-all duration-300 hover:border-border/80 hover:bg-card/60 hover:shadow-premium",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted/40 text-muted-foreground group-hover:scale-110 transition-transform duration-200">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        {loading ? (
          <div className="h-8 w-24 rounded-lg bg-muted/60 animate-pulse" />
        ) : (
          <span className="text-[28px] font-bold tracking-tight text-foreground tabular-nums">
            {typeof value === "string" ? (
              value
            ) : (
              <AnimatedCounter
                value={value}
                format={format === "number" || format === "currency" ? "compact" : format}
              />
            )}
          </span>
        )}
      </div>

      {delta !== undefined && !loading && (
        <div className="mt-3 flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md cursor-default",
                  deltaState === "up" && "bg-success/10 text-success",
                  deltaState === "down" && "bg-destructive/10 text-destructive",
                  deltaState === "flat" && "bg-muted text-muted-foreground"
                )}
              >
                {deltaState === "up" && <ArrowUpRight className="w-3 h-3" />}
                {deltaState === "down" && <ArrowDownRight className="w-3 h-3" />}
                {deltaState === "flat" && <ArrowRight className="w-3 h-3" />}
                {Math.abs(delta).toFixed(1)}%
              </span>
            </TooltipTrigger>
            <TooltipContent>{deltaPeriod}</TooltipContent>
          </Tooltip>
        </div>
      )}
    </Card>
  );
}
