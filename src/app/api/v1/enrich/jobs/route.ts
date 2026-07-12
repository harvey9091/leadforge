/**
 * POST /api/v1/enrich/jobs
 * Create an enrichment job for a company.
 * Body: { companyId: string, schedule?: string }
 *
 * GET /api/v1/enrich/jobs
 * List enrichment jobs.
 */

import { z } from "zod";
import { enrichmentJobRepository } from "@/server/repositories/enrichment.repository";
import { ensureEnrichmentWorkerStarted } from "@/server/enrichment/worker/bootstrap";
import { notifyNewEnrichmentJob } from "@/server/enrichment/worker/worker";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const createSchema = z.object({
  companyId: z.string().min(1),
  schedule: z.string().optional().default("manual"),
});

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  ensureEnrichmentWorkerStarted();
  try {
    const body = await readJson(req);
    const input = validate(createSchema, body);

    const company = await db.company.findUnique({ where: { id: input.companyId } });
    if (!company) return apiError(new Error("Company not found"), ctx.requestId);

    const job = await enrichmentJobRepository.create(company.id, input.schedule);
    notifyNewEnrichmentJob();

    return apiSuccess({ job }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  ensureEnrichmentWorkerStarted();
  try {
    const url = new URL(req.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const status = url.searchParams.get("status");

    const jobs = await db.enrichmentJob.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        company: { select: { id: true, name: true, domain: true } },
        _count: { select: { logs: true } },
      },
    });

    return apiSuccess({ data: jobs }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
