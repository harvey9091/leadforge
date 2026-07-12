/**
 * GET /api/v1/companies/filters
 * Returns distinct values for source, country, industry — used to populate
 * the filter dropdowns on the Companies page.
 */

import { companyRepository } from "@/server/repositories/discovery.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const options = await companyRepository.getFilterOptions();
    return apiSuccess(options, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}
