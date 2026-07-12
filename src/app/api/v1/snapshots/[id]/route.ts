/**
 * GET /api/v1/snapshots/:companyId — get historical snapshots for a company
 */
import { getSnapshots, getSnapshotById, compareSnapshots } from "@/server/signals/diff-engine";
import { apiError, apiSuccess, getRequestContext } from "@/server/utils/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const snapshotId = url.searchParams.get("snapshotId");
    const compareId = url.searchParams.get("compareWith");

    if (snapshotId) {
      const snapshot = await getSnapshotById(snapshotId);
      if (!snapshot) return apiError(new Error("Snapshot not found"), ctx.requestId);
      return apiSuccess({ snapshot }, { requestId: ctx.requestId });
    }

    if (compareId) {
      const snapshotA = await getSnapshotById(id);
      const snapshotB = await getSnapshotById(compareId);
      if (!snapshotA || !snapshotB) return apiError(new Error("Snapshot not found"), ctx.requestId);
      const changes = compareSnapshots(snapshotA.data, snapshotB.data);
      return apiSuccess({ changes }, { requestId: ctx.requestId });
    }

    const snapshots = await getSnapshots(id, 20);
    return apiSuccess({ data: snapshots }, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
