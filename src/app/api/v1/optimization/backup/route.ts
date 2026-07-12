/**
 * POST /api/v1/optimization/backup — trigger a database backup
 * GET /api/v1/optimization/backup — list backup records
 */
import { db } from "@/lib/db";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    // Create backup record
    const record = await db.backupRecord.create({
      data: { type: "full", status: "running", startedAt: new Date() },
    });

    try {
      // Export all tables as JSON (simplified backup for dev)
      const tables = ["User", "Company", "Source", "Tag", "Technology", "AIAnalysis", "AIEvidence", "DiscoveryJob", "EnrichmentJob", "SourceMetric", "CrawlState", "PromptVersion", "CompanyFeedback"];
      const backup: Record<string, unknown> = { timestamp: new Date().toISOString(), version: "6.0.0" };

      for (const table of tables) {
        try {
          const data = await (db as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[table]?.findMany();
          backup[table] = data ?? [];
        } catch { /* table might not exist */ }
      }

      const json = JSON.stringify(backup, null, 2);
      const filename = `backup-${record.id}.json`;
      const filepath = join(process.cwd(), "download", "backups", filename);

      try {
        writeFileSync(filepath, json);
      } catch {
        // Create directory if it doesn't exist
        const { mkdirSync } = await import("node:fs");
        try { mkdirSync(join(process.cwd(), "download", "backups"), { recursive: true }); } catch { /* exists */ }
        writeFileSync(filepath, json);
      }

      const fileSize = Buffer.byteLength(json);
      await db.backupRecord.update({
        where: { id: record.id },
        data: { status: "completed", fileSize, fileUrl: `/api/v1/optimization/backup/${record.id}/download`, completedAt: new Date() },
      });

      return apiSuccess({
        backupId: record.id,
        fileSize,
        tableCount: tables.length,
        recordCount: Object.values(backup).filter(Array.isArray).reduce((sum, arr) => sum + (arr as unknown[]).length, 0),
      }, { requestId: ctx.requestId });
    } catch (err) {
      await db.backupRecord.update({
        where: { id: record.id },
        data: { status: "failed", errorMessage: err instanceof Error ? err.message : String(err), completedAt: new Date() },
      });
      throw err;
    }
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const backups = await db.backupRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return apiSuccess({ data: backups }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
