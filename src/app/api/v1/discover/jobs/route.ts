/**
 * POST /api/v1/discover/jobs
 *
 * Create a new discovery job. The job is queued and picked up by the
 * worker on the next poll cycle (within 5 seconds).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { discoveryJobRepository } from "@/server/repositories/discovery.repository";
import { SOURCE_METADATA } from "@/server/discovery/registry";
import { notifyNewJob } from "@/server/discovery/worker/worker";
import { ensureWorkerStarted } from "@/server/discovery/worker/bootstrap";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";
import { env } from "@/server/config/env";
import { AuthError } from "@/server/utils/errors";

export const runtime = "nodejs";

const createJobSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  sources: z.array(z.string()).default([]),
  maxCompanies: z.number().int().min(1).max(1000).default(100),
  keywords: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  fundingStages: z.array(z.string()).default([]),
  hiringOnly: z.boolean().default(false),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  ensureWorkerStarted();
  try {
    // Auth required
    const token = getAccessTokenFromReq(req);
    if (!token) throw new AuthError("Authentication required");

    const body = await readJson(req);
    const input = validate(createJobSchema, body);

    // Validate source IDs
    const validSourceIds = new Set(SOURCE_METADATA.map((s) => s.id));
    const invalidSources = input.sources.filter((s) => !validSourceIds.has(s as never));
    if (invalidSources.length > 0) {
      throw new Error(`Invalid source IDs: ${invalidSources.join(", ")}`);
    }

    const job = await discoveryJobRepository.create({
      name: input.name,
      sources: input.sources,
      maxCompanies: input.maxCompanies,
      keywords: input.keywords,
      categories: input.categories,
      regions: input.regions,
      fundingStages: input.fundingStages,
      hiringOnly: input.hiringOnly,
      dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
      dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
      createdBy: undefined, // Extracted from JWT in future multi-user mode
    });

    // Notify the worker to poll immediately
    notifyNewJob();

    return apiSuccess({ job: serializeJob(job) }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}

/**
 * GET /api/v1/discover/jobs
 * List discovery jobs with pagination.
 */
export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  ensureWorkerStarted();
  try {
    const url = new URL(req.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const status = url.searchParams.get("status") ?? undefined;

    const [jobs, total] = await Promise.all([
      discoveryJobRepository.list({ limit, offset, status }),
      discoveryJobRepository.count({ status }),
    ]);

    return apiSuccess(
      {
        data: jobs.map(serializeJob),
        pagination: { limit, offset, total },
      },
      { requestId: ctx.requestId }
    );
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}

function serializeJob(job: Record<string, unknown>) {
  return {
    id: job.id,
    name: job.name,
    status: job.status,
    sources: safeJsonArray(job.sources as string),
    maxCompanies: job.maxCompanies,
    keywords: safeJsonArray(job.keywords as string),
    categories: safeJsonArray(job.categories as string),
    regions: safeJsonArray(job.regions as string),
    fundingStages: safeJsonArray(job.fundingStages as string),
    hiringOnly: job.hiringOnly,
    dateFrom: job.dateFrom,
    dateTo: job.dateTo,
    companiesFound: job.companiesFound,
    companiesStored: job.companiesStored,
    duplicatesFound: job.duplicatesFound,
    errorsCount: job.errorsCount,
    retriesCount: job.retriesCount,
    currentSource: job.currentSource,
    currentPage: job.currentPage,
    totalPages: job.totalPages,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    pausedAt: job.pausedAt,
    cancelledAt: job.cancelledAt,
    lastHeartbeat: job.lastHeartbeat,
    estimatedCompletion: job.estimatedCompletion,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    _count: (job as { _count?: { logs: number; jobSources: number } })._count,
  };
}

function safeJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getAccessTokenFromReq(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme === "Bearer" && token) return token;
  // Also accept cookie
  const cookieHeader = req.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === env.cookie.name && v) return decodeURIComponent(v);
  }
  return null;
}
