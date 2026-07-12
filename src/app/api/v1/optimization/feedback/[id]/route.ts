/**
 * GET /api/v1/optimization/feedback/:companyId — get feedback for a company
 */
import { getCompanyFeedback } from "@/server/optimization/feedback-loop";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const feedback = await getCompanyFeedback(id);
    return apiSuccess(feedback, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
