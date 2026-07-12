/**
 * =============================================================================
 * Change Detection / Diff Engine — Phase 7
 * =============================================================================
 *
 * Compares every crawl against the previous version to detect changes.
 * Stores complete change history. Nothing is overwritten.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { createHash } from "node:crypto";

export interface ChangeDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  pageType: string;
  changeType: "added" | "removed" | "modified";
}

export interface DiffResult {
  companyId: string;
  changes: ChangeDiff[];
  oldHash: string | null;
  newHash: string;
  changed: boolean;
}

/**
 * Capture a snapshot of the current company state.
 */
export async function captureSnapshot(companyId: string): Promise<void> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      name: true, description: true, headline: true, industry: true,
      pricingModel: true, pricingDetected: true, trialDetected: true,
      freemiumDetected: true, enterpriseDetected: true, callToAction: true,
      logoUrl: true, heroImageUrl: true, supportEmail: true, contactEmail: true,
      phone: true, address: true, linkedinUrl: true, twitterUrl: true,
      websiteHttps: true, websiteStatus: true, websiteSpeedMs: true,
      lastEnrichedAt: true, enrichmentPages: true,
      companyTechnologies: { include: { technology: { select: { name: true } } } },
    },
  });

  if (!company) return;

  const data = JSON.stringify({
    ...company,
    technologies: company.companyTechnologies.map((ct) => ct.technology.name),
    capturedAt: new Date().toISOString(),
  });

  const contentHash = createHash("sha256").update(data).digest("hex").slice(0, 32);

  await db.historicalSnapshot.create({
    data: {
      companyId,
      snapshotType: "enrichment",
      data,
      contentHash,
    },
  });
}

/**
 * Compare the current company state against the previous snapshot.
 */
export async function diffAgainstPrevious(companyId: string): Promise<DiffResult> {
  const snapshots = await db.historicalSnapshot.findMany({
    where: { companyId, snapshotType: "enrichment" },
    orderBy: { capturedAt: "desc" },
    take: 2,
  });

  if (snapshots.length === 0) {
    return { companyId, changes: [], oldHash: null, newHash: "", changed: false };
  }

  const latest = snapshots[0]!;
  const previous = snapshots[1];

  if (!previous) {
    return { companyId, changes: [], oldHash: null, newHash: latest.contentHash ?? "", changed: false };
  }

  const oldData = JSON.parse(previous.data) as Record<string, unknown>;
  const newData = JSON.parse(latest.data) as Record<string, unknown>;
  const changes: ChangeDiff[] = [];

  // Compare each field
  const fieldsToCompare = [
    "description", "headline", "industry", "pricingModel", "pricingDetected",
    "trialDetected", "freemiumDetected", "enterpriseDetected", "callToAction",
    "logoUrl", "heroImageUrl", "supportEmail", "contactEmail", "phone",
    "linkedinUrl", "twitterUrl", "websiteHttps", "websiteStatus",
  ];

  for (const field of fieldsToCompare) {
    const oldVal = oldData[field];
    const newVal = newData[field];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        field,
        oldValue: oldVal,
        newValue: newVal,
        pageType: "HOMEPAGE",
        changeType: oldVal === undefined ? "added" : newVal === undefined ? "removed" : "modified",
      });
    }
  }

  // Compare technologies
  const oldTechs = (oldData.technologies as string[]) ?? [];
  const newTechs = (newData.technologies as string[]) ?? [];
  const added = newTechs.filter((t) => !oldTechs.includes(t));
  const removed = oldTechs.filter((t) => !newTechs.includes(t));
  if (added.length > 0 || removed.length > 0) {
    changes.push({
      field: "technologies",
      oldValue: oldTechs,
      newValue: newTechs,
      pageType: "HOMEPAGE",
      changeType: "modified",
    });
  }

  return {
    companyId,
    changes,
    oldHash: previous.contentHash,
    newHash: latest.contentHash ?? "",
    changed: changes.length > 0,
  };
}

/**
 * Get historical snapshots for a company.
 */
export async function getSnapshots(companyId: string, limit: number = 20) {
  return db.historicalSnapshot.findMany({
    where: { companyId },
    orderBy: { capturedAt: "desc" },
    take: limit,
  });
}

/**
 * Get a specific snapshot by ID.
 */
export async function getSnapshotById(id: string) {
  return db.historicalSnapshot.findUnique({ where: { id } });
}

/**
 * Compare two snapshots and return the differences.
 */
export function compareSnapshots(oldData: string, newData: string): ChangeDiff[] {
  const old = JSON.parse(oldData) as Record<string, unknown>;
  const new_ = JSON.parse(newData) as Record<string, unknown>;
  const changes: ChangeDiff[] = [];

  const allKeys = new Set([...Object.keys(old), ...Object.keys(new_)]);
  for (const key of allKeys) {
    if (key === "capturedAt" || key === "companyTechnologies") continue;
    const oldVal = old[key];
    const newVal = new_[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal,
        pageType: "HOMEPAGE",
        changeType: oldVal === undefined ? "added" : newVal === undefined ? "removed" : "modified",
      });
    }
  }

  return changes;
}
