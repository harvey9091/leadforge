/**
 * =============================================================================
 * Discovery Normalizer
 * =============================================================================
 *
 * Converts source-specific `RawCompany` data into the canonical
 * `NormalizedCompany` shape. This is the ONLY place where source-specific
 * field names are mapped to canonical fields — nothing downstream knows
 * or cares which source a company came from.
 * =============================================================================
 */

import { URL } from "node:url";
import type { RawCompany, NormalizedCompany } from "./types";

/** Public suffix list (TLDs that are commonly spam / not real companies) */
const BLOCKED_TLDS = new Set([
  ".tk", ".ml", ".ga", ".cf", ".gq", // free TLDs often abused
  ".bit", // non-standard
  ".onion", // tor
  ".local", ".localhost", ".test", ".example", ".invalid", // non-public
]);

/**
 * Extract a clean domain from a URL string.
 * Handles: missing protocol, trailing paths, www. prefix, ports.
 */
export function extractDomain(url?: string): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  let cleaned = url.trim();
  if (!cleaned) return undefined;

  // Add protocol if missing
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  try {
    const parsed = new URL(cleaned);
    let host = parsed.hostname.toLowerCase();
    // Strip www. prefix
    if (host.startsWith("www.")) host = host.slice(4);
    return host || undefined;
  } catch {
    // Not a valid URL — might be a raw domain
    const match = cleaned.match(/^https?:\/\/([^/]+)/i);
    if (match && match[1]) {
      let host = match[1].toLowerCase();
      if (host.startsWith("www.")) host = host.slice(4);
      return host;
    }
    return undefined;
  }
}

/**
 * Extract the apex (registrable) domain from a full domain.
 * e.g. "app.linear.app" → "linear.app"
 *      "www.example.co.uk" → "example.co.uk"
 *
 * This is a simplified heuristic — for production, use the Public Suffix List.
 */
export function extractApexDomain(domain?: string): string | undefined {
  if (!domain) return undefined;
  const parts = domain.split(".");
  if (parts.length <= 2) return domain;

  // Common two-part TLDs
  const twoPartTlds = new Set([
    "co.uk", "com.au", "co.jp", "com.br", "co.kr", "com.cn",
    "co.in", "com.sg", "co.za", "com.mx", "co.nz", "com.hk",
    "org.uk", "ac.uk", "gov.uk", "net.au", "org.au",
  ]);

  const lastTwo = parts.slice(-2).join(".");
  if (twoPartTlds.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

/**
 * Normalize a company name: trim, collapse whitespace, remove legal suffixes.
 */
export function normalizeName(name?: string): string {
  if (!name || typeof name !== "string") return "";
  let cleaned = name.trim();
  // Collapse internal whitespace
  cleaned = cleaned.replace(/\s+/g, " ");
  // Remove common legal suffixes (only at the very end, preceded by a word boundary)
  cleaned = cleaned.replace(/\s+(Inc|Ltd|LLC|Corp|Corporation|Company|Co|GmbH|SAS|SARL|SA|BV|NV|AG|Oy|Ab)\.?$/i, "");
  // Remove trailing punctuation
  cleaned = cleaned.replace(/[.,;:!?]+$/, "");
  return cleaned.trim();
}

/**
 * Normalize a description: trim, collapse whitespace, cap length.
 */
export function normalizeDescription(desc?: string): string | undefined {
  if (!desc || typeof desc !== "string") return undefined;
  let cleaned = desc.trim();
  cleaned = cleaned.replace(/\s+/g, " ");
  // Decode common HTML entities
  cleaned = cleaned.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // Cap at 2000 chars
  if (cleaned.length > 2000) cleaned = cleaned.slice(0, 1997) + "...";
  return cleaned || undefined;
}

/**
 * Normalize a country: trim, title case.
 */
export function normalizeCountry(country?: string): string | undefined {
  if (!country || typeof country !== "string") return undefined;
  const cleaned = country.trim();
  if (!cleaned) return undefined;
  // Common country code → name mappings
  const countryMap: Record<string, string> = {
    US: "United States", USA: "United States",
    UK: "United Kingdom", GB: "United Kingdom",
    DE: "Germany", FR: "France", NL: "Netherlands",
    CA: "Canada", AU: "Australia", IN: "India",
    SG: "Singapore", DEU: "Germany", FRA: "France",
  };
  const upper = cleaned.toUpperCase();
  if (countryMap[upper]) return countryMap[upper];
  return cleaned;
}

/**
 * Normalize tags: trim, lowercase, dedup.
 */
export function normalizeTags(tags?: string[]): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const cleaned = tag.trim().toLowerCase();
    if (cleaned && !seen.has(cleaned) && cleaned.length <= 50) {
      seen.add(cleaned);
      result.push(cleaned);
    }
  }
  return result;
}

/**
 * Check if a domain has a blocked TLD.
 */
export function hasBlockedTld(domain?: string): boolean {
  if (!domain) return false;
  for (const tld of BLOCKED_TLDS) {
    if (domain.endsWith(tld)) return true;
  }
  return false;
}

/**
 * Build a search vector string for full-text search.
 * Concatenates name, domain, description, and tags — lowercased.
 */
export function buildSearchVector(company: {
  name: string;
  domain?: string;
  description?: string;
  tags: string[];
}): string {
  const parts = [
    company.name,
    company.domain ?? "",
    company.description ?? "",
    company.tags.join(" "),
  ];
  return parts.join(" ").toLowerCase().trim();
}

/**
 * Normalize a raw company into the canonical shape.
 */
export function normalize(raw: RawCompany): NormalizedCompany {
  const name = normalizeName(raw.name);
  const website = raw.website?.trim() || undefined;
  const domain = extractDomain(website);
  const apexDomain = extractApexDomain(domain);
  const description = normalizeDescription(raw.description);
  const country = normalizeCountry(raw.country);
  const tags = normalizeTags(raw.tags);

  return {
    name,
    website,
    domain,
    apexDomain,
    description,
    logoUrl: raw.logoUrl?.trim() || undefined,
    industry: raw.industry?.trim() || undefined,
    country,
    headquarters: raw.headquarters?.trim() || undefined,
    foundedYear: raw.foundedYear && raw.foundedYear > 1800 && raw.foundedYear <= new Date().getFullYear() + 1
      ? raw.foundedYear
      : undefined,
    fundingStage: raw.fundingStage?.trim() || undefined,
    employeeEstimate: raw.employeeEstimate?.trim() || undefined,
    tags,
    source: raw.source,
    sourceExternalId: raw.externalId,
    sourceUrl: raw.sourceUrl?.trim() || undefined,
    publishedAt: raw.publishedAt,
    raw: raw.raw,
  };
}
