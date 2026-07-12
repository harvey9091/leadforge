"use client";

/**
 * Stat / KPI card — the workhorse of the dashboard.
 *
 * Variants:
 *  - default: large number, small label, optional delta
 *  - compact: smaller numbers for dense grids
 *
 * Delta is shown as a colored pill — green for positive, red for negative,
 * muted for zero. Always includes the period ("vs last 7 days") in a
 * tooltip to avoid ambiguity.
 */

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, ArrowRight } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui/card";
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
        "relative p-5 border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden",
        "transition-colors hover:border-border/80",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {Icon && (
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-muted/40 text-muted-foreground">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        {loading ? (
          <div className="h-7 w-20 rounded bg-muted/60 animate-pulse" />
        ) : (
          <span className="text-[26px] font-semibold tracking-tight text-foreground tabular-nums">
            {formatted}
          </span>
        )}
      </div>

      {delta !== undefined && !loading && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[11.5px] font-medium px-1.5 py-0.5 rounded-md cursor-default",
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
