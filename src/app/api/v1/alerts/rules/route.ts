/**
 * GET /api/v1/alerts/rules — list alert rules
 * POST /api/v1/alerts/rules — create alert rule
 * POST /api/v1/alerts/rules?init=true — initialize default rules
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { initializeDefaultAlerts } from "@/server/reliability/alert-system";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1),
  metric: z.string().min(1),
  condition: z.enum(["gt", "gte", "lt", "lte", "eq"]).default("gt"),
  threshold: z.number(),
  windowMinutes: z.number().int().min(1).default(5),
  webhookUrl: z.string().url().nullable().optional(),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
});

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("init") === "true") {
      await initializeDefaultAlerts();
    }
    const rules = await db.alertRule.findMany({ orderBy: { createdAt: "asc" } });
    return apiSuccess({ data: rules }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(createSchema, body);
    const rule = await db.alertRule.create({ data: input });
    return apiSuccess({ rule }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
