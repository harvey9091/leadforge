"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

interface AnimatedCounterProps {
  value: number;
  format?: "compact" | "raw" | "percent" | "duration";
  className?: string;
  decimals?: number;
}

export function AnimatedCounter({ value, format = "compact", className, decimals = 0 }: AnimatedCounterProps) {
  const spring = useSpring(value, {
    damping: 25,
    stiffness: 120,
    mass: 0.8,
  });

  const display = useTransform(spring, (latest) => {
    if (format === "compact") return formatCompact(latest);
    if (format === "percent") return `${Math.round(latest)}%`;
    if (format === "duration") return formatDuration(latest);
    return latest.toFixed(decimals);
  });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return (
    <motion.span className={cn("tabular-nums", className)}>
      {display}
    </motion.span>
  );
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return Math.round(value).toString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}
