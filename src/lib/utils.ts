import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn — Tailwind class merge utility.
 * Combines clsx (conditional classes) with tailwind-merge (dedup conflicting
 * Tailwind classes, last one wins).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * formatNumber — locale-aware number formatting with optional compact notation.
 * 1234 -> "1,234"  |  1234567 -> "1.2M" (compact)
 */
export function formatNumber(
  value: number,
  options: { compact?: boolean; decimals?: number } = {}
): string {
  const { compact = false, decimals } = options;
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: decimals ?? (compact ? 1 : 0),
  }).format(value);
}

/**
 * formatCurrency — USD-formatted currency, compact by default for dashboards.
 */
export function formatCurrency(
  value: number,
  options: { compact?: boolean } = {}
): string {
  const { compact = true } = options;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

/**
 * formatPercent — percentage formatter. Pass a 0–1 fraction or a 0–100 number.
 */
export function formatPercent(
  value: number,
  options: { fraction?: boolean; decimals?: number } = {}
): string {
  const { fraction = true, decimals = 1 } = options;
  const pct = fraction ? value * 100 : value;
  return `${pct.toFixed(decimals)}%`;
}

/**
 * formatDate — ISO/string/Date → human readable.
 */
export function formatDate(
  value: string | Date | number,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(date);
}

/**
 * formatRelativeTime — "2h ago", "just now", "3d ago".
 */
export function formatRelativeTime(value: string | Date | number): string {
  const date = value instanceof Date ? value : new Date(value);
  const now = Date.now();
  const diff = now - date.getTime();
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);

  if (sec < 60) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return formatDate(date);
}

/**
 * sleep — promise-based delay for simulating async in placeholder data.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * initials — extract 1-2 char initials from a name or email.
 */
export function initials(value: string): string {
  if (!value) return "?";
  const parts = value.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

/**
 * truncate — clean string truncation with ellipsis.
 */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1).trimEnd() + "…";
}

/**
 * pluralize — naive pluralization (adds 's' by default, override with third arg).
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${formatNumber(count)} ${word}`;
}
