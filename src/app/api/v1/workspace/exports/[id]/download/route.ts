/**
 * GET /api/v1/workspace/exports/:id/download — download export file
 */
import { exportHistoryRepository } from "@/server/repositories/workspace.repository";
import { apiError, getRequestContext } from "@/server/utils/api";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const { id } = await params;
    const history = await exportHistoryRepository.findById(id);
    if (!history) return apiError(new Error("Export not found"), ctx.requestId);
    if (history.status !== "completed") return apiError(new Error("Export not ready"), ctx.requestId);

    const filename = `export-${id}.${history.format}`;
    const filepath = join(process.cwd(), "download", "exports", filename);
    if (!existsSync(filepath)) return apiError(new Error("File not found"), ctx.requestId);

    const buffer = readFileSync(filepath);
    const contentType = history.format === "csv" ? "text/csv" : history.format === "json" ? "application/json" : "application/vnd.ms-excel";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) { return apiError(err, ctx.requestId); }
}
