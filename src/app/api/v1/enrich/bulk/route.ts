/**
 * POST /api/v1/enrich/bulk
 * Enqueue enrichment jobs for ALL companies that have not yet been enriched
 * (i.e. lastEnrichedAt is null).
 *
 * Response: { enqueued: number, total: number, jobs: EnrichmentJob[] }
 */

import { z } from "zod";
import {
  enrichmentJobRepository,
  companyEnrichmentRepository,
} from "@/server/repositories/enrichment.repository";
import { ensureEnrichmentWorkerStarted } from "@/server/enrichment/worker/bootstrap";
import { notifyNewEnrichmentJob } from "@/server/enrichment/worker/worker";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";
import { db } from "@/lib/db";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";

const bulkSchema = z.object({
  schedule: z.string().optional().default("manual"),
});

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  ensureEnrichmentWorkerStarted();
  try {
    const body = await readJson(req);
    const input = validate(bulkSchema, body);

    const total = await enrichmentJobRepository.countUnenriched();

    if (total === 0) {
      return apiSuccess(
        { enqueued: 0, total: 0, jobs: [] },
        { requestId: ctx.requestId }
      );
    }

    const unenrichedCompanies = await db.company.findMany({
      where: { lastEnrichedAt: null },
      select: { id: true },
      take: 500,
    });

    const companyIds = unenrichedCompanies.map((c) => c.id);
    const jobs = await enrichmentJobRepository.createBulk(companyIds, input.schedule);

    logger.info("enrichment.bulk.enqueued", {
      requestId: ctx.requestId,
      enqueued: jobs.length,
      total,
    });

    notifyNewEnrichmentJob();

    return apiSuccess(
      { enqueued: jobs.length, total, jobs },
      { requestId: ctx.requestId }
    );
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
