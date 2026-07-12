/**
 * POST /api/v1/workspace/exports — start an export
 * Body: { format, columns?, filters?, selectedIds?, profileId?, profileName? }
 */
import { z } from "zod";
import { exportHistoryRepository } from "@/server/repositories/workspace.repository";
import { executeExport, getDefaultColumns, getExportPreset, previewExport, type ExportColumn, type ExportFormat } from "@/server/workspace/export/export-engine";
import { apiError, apiSuccess, getRequestContext, readJson, validate } from "@/server/utils/api";

export const runtime = "nodejs";

const exportSchema = z.object({
  format: z.enum(["csv", "json", "xlsx"]),
  columns: z.array(z.object({ field: z.string(), label: z.string() })).optional(),
  preset: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
  selectedIds: z.array(z.string()).optional(),
  profileId: z.string().optional(),
  profileName: z.string().optional(),
  includeHeaders: z.boolean().default(true),
  preview: z.boolean().optional(),
});

export async function POST(req: Request) {
  const ctx = getRequestContext(req);
  try {
    const body = await readJson(req);
    const input = validate(exportSchema, body);

    // Build columns
    let columns: ExportColumn[];
    if (input.preset && input.preset !== "custom") {
      columns = getExportPreset(input.preset) ?? getDefaultColumns();
    } else if (input.columns) {
      columns = input.columns;
    } else {
      columns = getDefaultColumns();
    }

    const config = {
      format: input.format as ExportFormat,
      columns,
      includeHeaders: input.includeHeaders,
      filters: input.filters,
      selectedIds: input.selectedIds,
      profileId: input.profileId,
      profileName: input.profileName,
    };

    // Preview mode — don't actually export
    if (input.preview) {
      const preview = await previewExport(config);
      return apiSuccess({ preview }, { requestId: ctx.requestId });
    }

    // Create history record
    const history = await exportHistoryRepository.create({
      profileId: input.profileId,
      profileName: input.profileName,
      format: input.format,
      filters: input.filters,
    });

    // Execute export (in production, large exports would go to a background queue)
    const result = await executeExport(history.id, config);

    return apiSuccess(result, { requestId: ctx.requestId });
  } catch (err) { return apiError(err, ctx.requestId); }
}
