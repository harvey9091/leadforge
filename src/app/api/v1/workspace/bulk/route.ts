/**
 * POST /api/v1/workspace/bulk
 * Bulk operations on multiple companies.
 * Body: { action: string, companyIds: string[], data?: unknown }
 */

import { z } from "zod";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";
import { db } from "@/lib/db";
import { ensureEnrichmentWorkerStarted } from "@/server/enrichment/worker/bootstrap";
import { notifyNewEnrichmentJob } from "@/server/enrichment/worker/worker";
import { ensureAIWorkerStarted } from "@/server/ai/worker/bootstrap";
import { notifyNewAIJob } from "@/server/ai/worker/worker";
import { aiJobRepository } from "@/server/repositories/ai.repository";
import { enrichmentJobRepository } from "@/server/repositories/enrichment.repository";

export const runtime = "nodejs";

const bulkSchema = z.object({
  action: z.enum(["tag", "untag", "reanalyze", "reenrich", "archive", "delete", "pin", "unpin"]),
  companyIds: z.array(z.string()).min(1).max(1000),
  data: z.unknown().optional(),
});

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(bulkSchema, body);

    let affected = 0;
    const message: string[] = [];

    switch (input.action) {
      case "tag": {
        const tagName = String(input.data ?? "");
        if (!tagName) return apiError(new Error("Tag name required"), ctx.requestId);
        const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const tag = await db.tag.upsert({ where: { slug }, create: { name: tagName, slug }, update: {} });
        for (const companyId of input.companyIds) {
          await db.companyTag.upsert({
            where: { companyId_tagId: { companyId, tagId: tag.id } },
            create: { companyId, tagId: tag.id },
            update: {},
          });
        }
        affected = input.companyIds.length;
        message.push(`Tagged ${affected} companies with "${tagName}"`);
        break;
      }

      case "untag": {
        const tagName = String(input.data ?? "");
        const tag = await db.tag.findFirst({ where: { name: { equals: tagName } } });
        if (tag) {
          await db.companyTag.deleteMany({
            where: { tagId: tag.id, companyId: { in: input.companyIds } },
          });
        }
        affected = input.companyIds.length;
        message.push(`Removed tag "${tagName}" from ${affected} companies`);
        break;
      }

      case "reanalyze": {
        ensureAIWorkerStarted();
        for (const companyId of input.companyIds) {
          await aiJobRepository.create(companyId, null, "single", 1);
        }
        notifyNewAIJob();
        affected = input.companyIds.length;
        message.push(`Queued ${affected} companies for AI re-analysis`);
        break;
      }

      case "reenrich": {
        ensureEnrichmentWorkerStarted();
        for (const companyId of input.companyIds) {
          await enrichmentJobRepository.create(companyId);
        }
        notifyNewEnrichmentJob();
        affected = input.companyIds.length;
        message.push(`Queued ${affected} companies for re-enrichment`);
        break;
      }

      case "archive": {
        await db.company.updateMany({
          where: { id: { in: input.companyIds } },
          data: { status: "DISQUALIFIED" },
        });
        affected = input.companyIds.length;
        message.push(`Archived ${affected} companies`);
        break;
      }

      case "delete": {
        await db.company.deleteMany({ where: { id: { in: input.companyIds } } });
        affected = input.companyIds.length;
        message.push(`Deleted ${affected} companies`);
        break;
      }

      case "pin": {
        for (const companyId of input.companyIds) {
          await db.pinnedCompany.upsert({
            where: { companyId },
            create: { companyId },
            update: {},
          });
        }
        affected = input.companyIds.length;
        message.push(`Pinned ${affected} companies`);
        break;
      }

      case "unpin": {
        await db.pinnedCompany.deleteMany({
          where: { companyId: { in: input.companyIds } },
        });
        affected = input.companyIds.length;
        message.push(`Unpinned ${affected} companies`);
        break;
      }
    }

    return apiSuccess({ affected, action: input.action, message: message.join("; ") }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
