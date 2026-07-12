/**
 * =============================================================================
 * Data Integrity Checker — Phase 8
 * =============================================================================
 *
 * Detects and repairs data consistency issues:
 *  - Missing relationships (orphaned sources, people, technologies)
 *  - Broken references (company IDs that don't exist)
 *  - Duplicate records (same apex domain, same name)
 *  - Invalid snapshots (corrupted JSON)
 *  - Incomplete AI analyses (status=processing but never completed)
 *  - Stuck jobs (RUNNING with no heartbeat for too long)
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/server/utils/logger";

export interface IntegrityResult {
  checkName: string;
  status: "ok" | "warning" | "error";
  issuesFound: number;
  issuesRepaired: number;
  details: Record<string, unknown>;
}

/**
 * Run all data integrity checks.
 */
export async function runAllChecks(repair: boolean = false): Promise<{
  results: IntegrityResult[];
  totalIssues: number;
  totalRepaired: number;
}> {
  const checks = [
    checkOrphanedSources,
    checkOrphanedPeople,
    checkOrphanedTechnologies,
    checkDuplicateCompanies,
    checkInvalidSnapshots,
    checkIncompleteAIAnalyses,
    checkStuckDiscoveryJobs,
    checkStuckEnrichmentJobs,
    checkStuckAIJobs,
  ];

  const results: IntegrityResult[] = [];

  for (const check of checks) {
    try {
      const result = await check(repair);
      results.push(result);

      // Store the result
      await db.dataIntegrityCheck.create({
        data: {
          checkName: result.checkName,
          status: result.status,
          issuesFound: result.issuesFound,
          issuesRepaired: result.issuesRepaired,
          details: JSON.stringify(result.details),
        },
      });
    } catch (err) {
      logger.error("integrity.checkFailed", {
        check: check.name,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({
        checkName: check.name,
        status: "error",
        issuesFound: 0,
        issuesRepaired: 0,
        details: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  const totalIssues = results.reduce((sum, r) => sum + r.issuesFound, 0);
  const totalRepaired = results.reduce((sum, r) => sum + r.issuesRepaired, 0);

  logger.info("integrity.checkComplete", { totalIssues, totalRepaired, repair });

  return { results, totalIssues, totalRepaired };
}

/**
 * Check for sources pointing to non-existent companies.
 */
async function checkOrphanedSources(repair: boolean): Promise<IntegrityResult> {
  const orphaned = await db.source.findMany({
    where: { company: null },
    select: { id: true },
  });

  let repaired = 0;
  if (repair && orphaned.length > 0) {
    await db.source.deleteMany({ where: { id: { in: orphaned.map((s) => s.id) } } });
    repaired = orphaned.length;
  }

  return {
    checkName: "Orphaned Sources",
    status: orphaned.length === 0 ? "ok" : "warning",
    issuesFound: orphaned.length,
    issuesRepaired: repaired,
    details: { orphanedIds: orphaned.slice(0, 10).map((s) => s.id) },
  };
}

/**
 * Check for people pointing to non-existent companies.
 */
async function checkOrphanedPeople(repair: boolean): Promise<IntegrityResult> {
  const orphaned = await db.person.findMany({
    where: { company: null },
    select: { id: true },
  });

  let repaired = 0;
  if (repair && orphaned.length > 0) {
    await db.person.deleteMany({ where: { id: { in: orphaned.map((p) => p.id) } } });
    repaired = orphaned.length;
  }

  return {
    checkName: "Orphaned People",
    status: orphaned.length === 0 ? "ok" : "warning",
    issuesFound: orphaned.length,
    issuesRepaired: repaired,
    details: {},
  };
}

/**
 * Check for company technologies pointing to non-existent companies or technologies.
 */
async function checkOrphanedTechnologies(repair: boolean): Promise<IntegrityResult> {
  const orphaned = await db.companyTechnology.findMany({
    where: { OR: [{ company: null }, { technology: null }] },
    select: { companyId: true, technologyId: true },
  });

  let repaired = 0;
  if (repair && orphaned.length > 0) {
    for (const ct of orphaned) {
      await db.companyTechnology.deleteMany({
        where: { companyId: ct.companyId, technologyId: ct.technologyId },
      }).catch(() => {});
    }
    repaired = orphaned.length;
  }

  return {
    checkName: "Orphaned Technology Links",
    status: orphaned.length === 0 ? "ok" : "warning",
    issuesFound: orphaned.length,
    issuesRepaired: repaired,
    details: {},
  };
}

/**
 * Check for duplicate companies (same apex domain).
 */
async function checkDuplicateCompanies(_repair: boolean): Promise<IntegrityResult> {
  const duplicates = await db.company.findMany({
    where: { apexDomain: { not: null } },
    select: { id: true, name: true, apexDomain: true },
  });

  const byDomain = new Map<string, number>();
  for (const c of duplicates) {
    if (c.apexDomain) {
      byDomain.set(c.apexDomain, (byDomain.get(c.apexDomain) ?? 0) + 1);
    }
  }

  const duplicateDomains = Array.from(byDomain.entries()).filter(([, count]) => count > 1);

  return {
    checkName: "Duplicate Companies",
    status: duplicateDomains.length === 0 ? "ok" : "warning",
    issuesFound: duplicateDomains.length,
    issuesRepaired: 0, // Don't auto-repair duplicates — require manual review
    details: { duplicateDomains: duplicateDomains.slice(0, 10) },
  };
}

/**
 * Check for invalid/corrupted snapshots.
 */
async function checkInvalidSnapshots(_repair: boolean): Promise<IntegrityResult> {
  const snapshots = await db.historicalSnapshot.findMany({
    select: { id: true, data: true },
    take: 1000,
  });

  let invalid = 0;
  for (const s of snapshots) {
    try {
      JSON.parse(s.data);
    } catch {
      invalid++;
    }
  }

  return {
    checkName: "Invalid Snapshots",
    status: invalid === 0 ? "ok" : "error",
    issuesFound: invalid,
    issuesRepaired: 0,
    details: { checked: snapshots.length },
  };
}

/**
 * Check for AI analyses stuck in "processing" status.
 */
async function checkIncompleteAIAnalyses(repair: boolean): Promise<IntegrityResult> {
  const stuck = await db.aIAnalysis.findMany({
    where: { status: "processing" },
    select: { id: true, createdAt: true },
  });

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const trulyStuck = stuck.filter((s) => s.createdAt < oneHourAgo);

  let repaired = 0;
  if (repair && trulyStuck.length > 0) {
    await db.aIAnalysis.updateMany({
      where: { id: { in: trulyStuck.map((s) => s.id) } },
      data: { status: "failed", errorMessage: "Stuck in processing — timed out" },
    });
    repaired = trulyStuck.length;
  }

  return {
    checkName: "Incomplete AI Analyses",
    status: trulyStuck.length === 0 ? "ok" : "warning",
    issuesFound: trulyStuck.length,
    issuesRepaired: repaired,
    details: { stuckIds: trulyStuck.slice(0, 10).map((s) => s.id) },
  };
}

/**
 * Check for stuck discovery jobs.
 */
async function checkStuckDiscoveryJobs(repair: boolean): Promise<IntegrityResult> {
  const staleBefore = new Date(Date.now() - 60 * 60 * 1000); // 1 hour
  const stuck = await db.discoveryJob.findMany({
    where: { status: "RUNNING", lastHeartbeat: { lt: staleBefore } },
    select: { id: true },
  });

  let repaired = 0;
  if (repair && stuck.length > 0) {
    await db.discoveryJob.updateMany({
      where: { id: { in: stuck.map((s) => s.id) } },
      data: { status: "RETRYING" },
    });
    repaired = stuck.length;
  }

  return {
    checkName: "Stuck Discovery Jobs",
    status: stuck.length === 0 ? "ok" : "warning",
    issuesFound: stuck.length,
    issuesRepaired: repaired,
    details: {},
  };
}

/**
 * Check for stuck enrichment jobs.
 */
async function checkStuckEnrichmentJobs(repair: boolean): Promise<IntegrityResult> {
  const staleBefore = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours
  const stuck = await db.enrichmentJob.findMany({
    where: { status: "RUNNING", lastHeartbeat: { lt: staleBefore } },
    select: { id: true },
  });

  let repaired = 0;
  if (repair && stuck.length > 0) {
    await db.enrichmentJob.updateMany({
      where: { id: { in: stuck.map((s) => s.id) } },
      data: { status: "RETRYING" },
    });
    repaired = stuck.length;
  }

  return {
    checkName: "Stuck Enrichment Jobs",
    status: stuck.length === 0 ? "ok" : "warning",
    issuesFound: stuck.length,
    issuesRepaired: repaired,
    details: {},
  };
}

/**
 * Check for stuck AI jobs.
 */
async function checkStuckAIJobs(repair: boolean): Promise<IntegrityResult> {
  const staleBefore = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours
  const stuck = await db.aIJob.findMany({
    where: { status: "RUNNING", lastHeartbeat: { lt: staleBefore } },
    select: { id: true },
  });

  let repaired = 0;
  if (repair && stuck.length > 0) {
    await db.aIJob.updateMany({
      where: { id: { in: stuck.map((s) => s.id) } },
      data: { status: "RETRYING" },
    });
    repaired = stuck.length;
  }

  return {
    checkName: "Stuck AI Jobs",
    status: stuck.length === 0 ? "ok" : "warning",
    issuesFound: stuck.length,
    issuesRepaired: repaired,
    details: {},
  };
}

/**
 * Get recent integrity check results.
 */
export async function getIntegrityHistory(limit: number = 20) {
  return db.dataIntegrityCheck.findMany({
    orderBy: { checkedAt: "desc" },
    take: limit,
  });
}
