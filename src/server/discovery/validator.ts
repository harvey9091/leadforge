/**
 * =============================================================================
 * Discovery Validator
 * =============================================================================
 *
 * Validates normalized companies before storage. Rejects:
 *  - Missing names
 *  - Missing domains (no website to track)
 *  - Malformed websites
 *  - Spam patterns (excessive capitalization, link-stuffed descriptions)
 *  - Blocked TLDs
 *  - Empty companies (no usable data)
 * =============================================================================
 */

import { hasBlockedTld } from "./normalizer";
import type { NormalizedCompany, ValidationResult } from "./types";

/** Minimum company name length */
const MIN_NAME_LENGTH = 2;
/** Maximum company name length */
const MAX_NAME_LENGTH = 200;
/** Minimum description length to be useful */
const MIN_DESCRIPTION_LENGTH = 10;

/**
 * Validate a normalized company.
 */
export function validate(company: NormalizedCompany): ValidationResult {
  // 1. Name must exist and be reasonable
  if (!company.name || company.name.length < MIN_NAME_LENGTH) {
    return { valid: false, reason: "Name too short", reasonCode: "incomplete" };
  }
  if (company.name.length > MAX_NAME_LENGTH) {
    return { valid: false, reason: "Name too long", reasonCode: "malformed" };
  }

  // 2. Domain is required — we can't track a company without a website
  if (!company.domain) {
    return { valid: false, reason: "Missing domain", reasonCode: "incomplete" };
  }

  // 3. Domain must not be a blocked TLD
  if (hasBlockedTld(company.domain)) {
    return { valid: false, reason: `Blocked TLD: ${company.domain}`, reasonCode: "blocked_tld" };
  }

  // 4. Domain must look valid (at least one dot, valid chars)
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(company.domain)) {
    return { valid: false, reason: `Malformed domain: ${company.domain}`, reasonCode: "malformed" };
  }

  // 5. Spam detection — excessive capitalization in name
  if (isSpammyName(company.name)) {
    return { valid: false, reason: "Spam-like name pattern", reasonCode: "spam" };
  }

  // 6. Spam detection — link-stuffed description
  if (company.description && isSpammyDescription(company.description)) {
    return { valid: false, reason: "Spam-like description", reasonCode: "spam" };
  }

  // 7. Must have at least one useful piece of data beyond name+domain
  const hasUsefulData =
    (company.description && company.description.length >= MIN_DESCRIPTION_LENGTH) ||
    company.industry ||
    company.country ||
    company.foundedYear ||
    company.tags.length > 0;
  if (!hasUsefulData) {
    return { valid: false, reason: "Empty company — no useful data", reasonCode: "incomplete" };
  }

  return { valid: true };
}

/**
 * Detect spam-like company names.
 * Patterns: ALL CAPS, excessive punctuation, repeated characters.
 */
function isSpammyName(name: string): boolean {
  // All caps (if longer than 5 chars)
  if (name.length > 5 && name === name.toUpperCase() && /[A-Z]/.test(name)) {
    // Allow acronyms like "API" — only flag if it's a long all-caps string
    if (name.length > 15) return true;
  }
  // Excessive exclamation marks
  if ((name.match(/!/g) ?? []).length > 2) return true;
  // Repeated single character (e.g. "aaaaaa")
  if (/^(.)\1{4,}$/.test(name)) return true;
  // Contains "click here" or "buy now"
  if (/click here|buy now|free money|make money/i.test(name)) return true;
  return false;
}

/**
 * Detect spam-like descriptions.
 * Patterns: excessive links, keyword stuffing.
 */
function isSpammyDescription(desc: string): boolean {
  // More than 3 URLs in description
  const urlCount = (desc.match(/https?:\/\/[^\s]+/g) ?? []).length;
  if (urlCount > 3) return true;
  // Excessive repetition of the same word
  const words = desc.toLowerCase().split(/\s+/);
  const wordCounts = new Map<string, number>();
  for (const w of words) {
    if (w.length < 4) continue;
    wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
    if ((wordCounts.get(w) ?? 0) > 8) return true;
  }
  return false;
}
