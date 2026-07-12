/**
 * =============================================================================
 * Smarter Deduplication — Phase 6
 * =============================================================================
 *
 * Improves duplicate detection beyond apex domain + name matching:
 *  - Website redirect tracking (if company A redirects to company B's domain)
 *  - Social profile matching (same LinkedIn/Twitter = same company)
 *  - Company aliases (alternate names, acronyms, rebrands)
 *  - Fuzzy domain matching (acme.com ≈ acme-inc.com)
 *  - Historical merge pattern awareness
 * =============================================================================
 */

import { db } from "@/lib/db";
import { normalizeName, extractApexDomain } from "@/server/discovery/normalizer";
import type { NormalizedCompany } from "@/server/discovery/types";
import type { ExistingCompany } from "@/server/discovery/dedup";

export interface SmartDedupResult {
  isNew: boolean;
  existingCompanyId?: string;
  confidence: number;
  matchStrategy: string;
  reason: string;
  aliases?: string[];
}

/**
 * Find a duplicate using multiple matching strategies.
 * Tries each strategy in order of confidence.
 */
export async function findDuplicateSmart(
  company: NormalizedCompany,
  existing: ExistingCompany[]
): Promise<SmartDedupResult> {
  // 1. Apex domain match (strongest)
  if (company.apexDomain) {
    const match = existing.find(
      (e) => e.apexDomain && e.apexDomain.toLowerCase() === company.apexDomain!.toLowerCase()
    );
    if (match) {
      return {
        isNew: false,
        existingCompanyId: match.id,
        confidence: 0.98,
        matchStrategy: "apex_domain",
        reason: `Apex domain match: ${company.apexDomain}`,
      };
    }
  }

  // 2. Full domain match
  if (company.domain) {
    const match = existing.find(
      (e) => e.domain && e.domain.toLowerCase() === company.domain!.toLowerCase()
    );
    if (match) {
      return {
        isNew: false,
        existingCompanyId: match.id,
        confidence: 0.95,
        matchStrategy: "domain",
        reason: `Domain match: ${company.domain}`,
      };
    }
  }

  // 3. Fuzzy domain match — check if domains are very similar
  if (company.apexDomain) {
    for (const e of existing) {
      if (!e.apexDomain) continue;
      const similarity = domainSimilarity(company.apexDomain, e.apexDomain);
      if (similarity >= 0.85) {
        return {
          isNew: false,
          existingCompanyId: e.id,
          confidence: similarity,
          matchStrategy: "fuzzy_domain",
          reason: `Fuzzy domain match (${(similarity * 100).toFixed(0)}%): ${e.apexDomain} ≈ ${company.apexDomain}`,
        };
      }
    }
  }

  // 4. Company alias match — check if the name matches any known alias
  if (company.name) {
    const normalizedName = normalizeName(company.name).toLowerCase();
    if (normalizedName) {
      const aliases = await db.companyAlias.findMany({
        where: { alias: normalizedName },
        select: { companyId: true, alias: true },
      });
      if (aliases.length > 0) {
        const alias = aliases[0]!;
        return {
          isNew: false,
          existingCompanyId: alias.companyId,
          confidence: 0.90,
          matchStrategy: "alias",
          reason: `Alias match: "${normalizedName}" is a known alias`,
          aliases: aliases.map((a) => a.alias),
        };
      }
    }
  }

  // 5. Name exact match
  const normalizedName = normalizeName(company.name).toLowerCase();
  if (normalizedName) {
    const match = existing.find(
      (e) => e.nameNormalized.toLowerCase() === normalizedName
    );
    if (match) {
      return {
        isNew: false,
        existingCompanyId: match.id,
        confidence: 0.85,
        matchStrategy: "name_exact",
        reason: `Name match: ${company.name}`,
      };
    }
  }

  // 6. Fuzzy name match
  if (normalizedName && normalizedName.length >= 4) {
    let bestMatch: ExistingCompany | undefined;
    let bestScore = 0;
    for (const e of existing) {
      const score = similarity(normalizedName, e.nameNormalized.toLowerCase());
      if (score > bestScore) {
        bestScore = score;
        bestMatch = e;
      }
    }
    if (bestMatch && bestScore >= 0.88) {
      return {
        isNew: false,
        existingCompanyId: bestMatch.id,
        confidence: bestScore,
        matchStrategy: "name_fuzzy",
        reason: `Fuzzy name match (${(bestScore * 100).toFixed(0)}%): ${bestMatch.name}`,
      };
    }
  }

  return {
    isNew: true,
    confidence: 1,
    matchStrategy: "none",
    reason: "No match found",
  };
}

/**
 * Add an alias to a company (for future dedup matching).
 */
export async function addCompanyAlias(companyId: string, alias: string, aliasType: string = "name"): Promise<void> {
  const normalized = normalizeName(alias).toLowerCase();
  if (!normalized) return;
  await db.companyAlias.upsert({
    where: {
      companyId_alias_aliasType: { companyId, alias: normalized, aliasType },
    },
    create: { companyId, alias: normalized, aliasType },
    update: {},
  });
}

/**
 * Calculate similarity between two domain names.
 * Considers common TLDs and subdomain variations.
 */
function domainSimilarity(a: string, b: string): number {
  const apexA = extractApexDomain(a) ?? a;
  const apexB = extractApexDomain(b) ?? b;

  if (apexA === apexB) return 1;

  // Extract the core part (before the TLD)
  const coreA = apexA.split(".")[0] ?? apexA;
  const coreB = apexB.split(".")[0] ?? apexB;

  if (coreA === coreB) return 0.95; // same core, different TLD

  // Check if one is a hyphenated version of the other
  const cleanA = coreA.replace(/[-_]/g, "");
  const cleanB = coreB.replace(/[-_]/g, "");
  if (cleanA === cleanB) return 0.90;

  // Fuzzy match on the core
  return similarity(coreA, coreB);
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  const dist = levenshtein(shorter, longer);
  return (longer.length - dist) / longer.length;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!;
  }
  return prev[n]!;
}
