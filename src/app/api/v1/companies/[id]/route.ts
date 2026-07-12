/**
 * GET /api/v1/companies/:id
 * Get a single company with all details (sources, tags, websites).
 */

import { companyRepository } from "@/server/repositories/discovery.repository";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const company = await companyRepository.findById(id);
    if (!company) {
      return apiError(new Error("Company not found"), ctx.requestId);
    }
    return apiSuccess({ company: serializeCompany(company) }, { requestId: ctx.requestId });
  } catch (err) {
    return apiError(err, ctx.requestId);
  }
}

function serializeCompany(c: Record<string, unknown>) {
  return {
    id: c.id,
    name: c.name,
    domain: c.domain,
    apexDomain: c.apexDomain,
    website: c.website,
    description: c.description,
    logoUrl: c.logoUrl,
    industry: c.industry,
    country: c.country,
    headquarters: c.headquarters,
    foundedYear: c.foundedYear,
    fundingStage: c.fundingStage,
    employeeEstimate: c.employeeEstimate,
    status: c.status,
    discoveredAt: c.discoveredAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    sources: c.sources,
    tags: c.tags,
    websites: c.websites,
  };
}
