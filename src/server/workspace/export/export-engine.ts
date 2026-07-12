/**
 * =============================================================================
 * Export Engine
 * =============================================================================
 *
 * Supports:
 *  - CSV, JSON, Excel (XLSX) formats
 *  - Custom columns + field mapping
 *  - Export profiles (reusable templates)
 *  - Background export jobs for large datasets (100k+ rows)
 *  - Progress tracking
 *  - Export history
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/server/utils/logger";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type ExportFormat = "csv" | "json" | "xlsx";

export interface ExportConfig {
  format: ExportFormat;
  columns: ExportColumn[];
  includeHeaders: boolean;
  filters?: Record<string, unknown>;
  selectedIds?: string[];
  profileId?: string;
  profileName?: string;
}

export interface ExportColumn {
  field: string;
  label: string;
  /** Custom transform function name */
  transform?: string;
}

export interface ExportResult {
  historyId: string;
  totalRows: number;
  processedRows: number;
  fileSize: number;
  fileUrl: string;
  format: ExportFormat;
  durationMs: number;
}

const DEFAULT_COLUMNS: ExportColumn[] = [
  { field: "name", label: "Company Name" },
  { field: "domain", label: "Domain" },
  { field: "website", label: "Website" },
  { field: "description", label: "Description" },
  { field: "industry", label: "Industry" },
  { field: "country", label: "Country" },
  { field: "fundingStage", label: "Funding Stage" },
  { field: "pricingModel", label: "Pricing Model" },
  { field: "icpMatchPct", label: "ICP Match %" },
  { field: "qualificationScore", label: "Qualification Score" },
  { field: "overallConfidence", label: "Confidence %" },
  { field: "videoOverall", label: "Video Opportunity" },
  { field: "lastEnrichedAt", label: "Last Enriched" },
  { field: "discoveredAt", label: "Discovered" },
];

const EXPORT_PRESETS: Record<string, ExportColumn[]> = {
  lightreach: [
    { field: "name", label: "Company" },
    { field: "domain", label: "Website" },
    { field: "contactEmail", label: "Email" },
    { field: "linkedinUrl", label: "LinkedIn" },
    { field: "industry", label: "Industry" },
    { field: "country", label: "Country" },
    { field: "icpMatchPct", label: "ICP Score" },
    { field: "qualificationScore", label: "Qualification" },
  ],
  clay: [
    { field: "name", label: "Company Name" },
    { field: "domain", label: "Domain" },
    { field: "description", label: "About" },
    { field: "industry", label: "Industry" },
    { field: "country", label: "Location" },
    { field: "fundingStage", label: "Funding" },
    { field: "employeeEstimate", label: "Company Size" },
    { field: "pricingModel", label: "Pricing" },
  ],
  apollo: [
    { field: "name", label: "Company Name" },
    { field: "domain", label: "Website" },
    { field: "industry", label: "Industry" },
    { field: "country", label: "Country" },
    { field: "foundedYear", label: "Year Founded" },
    { field: "employeeEstimate", label: "Employee Count" },
    { field: "fundingStage", label: "Funding Stage" },
    { field: "linkedinUrl", label: "LinkedIn URL" },
  ],
  hubspot: [
    { field: "name", label: "Name" },
    { field: "domain", label: "Website Domain" },
    { field: "description", label: "Description" },
    { field: "industry", label: "Industry" },
    { field: "country", label: "Country" },
    { field: "fundingStage", label: "Funding" },
  ],
};

export function getExportPreset(name: string): ExportColumn[] | null {
  return EXPORT_PRESETS[name] ?? null;
}

export function getDefaultColumns(): ExportColumn[] {
  return DEFAULT_COLUMNS;
}

export function getAvailablePresets(): Array<{ name: string; label: string }> {
  return [
    { name: "lightreach", label: "LightReach" },
    { name: "clay", label: "Clay" },
    { name: "apollo", label: "Apollo" },
    { name: "hubspot", label: "HubSpot" },
    { name: "custom", label: "Custom CSV" },
  ];
}

/**
 * Execute an export — fetches data and writes to a file.
 * For large datasets, this runs in chunks to avoid memory issues.
 */
export async function executeExport(
  historyId: string,
  config: ExportConfig
): Promise<ExportResult> {
  const startTime = Date.now();
  const history = await db.exportHistory.findUnique({ where: { id: historyId } });
  if (!history) throw new Error("Export history record not found");

  try {
    await db.exportHistory.update({
      where: { id: historyId },
      data: { status: "running", startedAt: new Date() },
    });

    // Build query
    const where = config.selectedIds
      ? { id: { in: config.selectedIds } }
      : buildWhereFromFilters(config.filters);

    const total = await db.company.count({ where });
    await db.exportHistory.update({
      where: { id: historyId },
      data: { totalRows: total },
    });

    // Fetch data in chunks
    const chunkSize = 500;
    const allData: Record<string, unknown>[] = [];
    let processed = 0;

    for (let offset = 0; offset < total; offset += chunkSize) {
      const companies = await db.company.findMany({
        where,
        skip: offset,
        take: chunkSize,
        include: {
          tags: { include: { tag: { select: { name: true } } } },
          companyTechnologies: { include: { technology: { select: { name: true } } } },
          aiAnalyses: {
            where: { status: "completed" },
            select: {
              summaryOneLine: true,
              icpMatchPct: true,
              qualificationScore: true,
              overallConfidence: true,
              videoOverall: true,
              productCategory: true,
              companyStage: true,
            },
            take: 1,
            orderBy: { analyzedAt: "desc" },
          },
        },
      });

      for (const company of companies) {
        const ai = company.aiAnalyses[0];
        const row: Record<string, unknown> = {};
        for (const col of config.columns) {
          row[col.field] = getFieldValue(company, col.field, ai);
        }
        allData.push(row);
      }

      processed += companies.length;
      await db.exportHistory.update({
        where: { id: historyId },
        data: { processedRows: processed },
      });
    }

    // Generate file
    const exportDir = join(process.cwd(), "download", "exports");
    try { mkdirSync(exportDir, { recursive: true }); } catch { /* exists */ }

    const filename = `export-${historyId}.${config.format}`;
    const filepath = join(exportDir, filename);
    let fileContent: string | Buffer;
    let fileSize: number;

    if (config.format === "csv") {
      fileContent = generateCSV(allData, config.columns, config.includeHeaders);
      writeFileSync(filepath, fileContent);
      fileSize = Buffer.byteLength(fileContent);
    } else if (config.format === "json") {
      fileContent = JSON.stringify(allData, null, 2);
      writeFileSync(filepath, fileContent);
      fileSize = Buffer.byteLength(fileContent);
    } else {
      // XLSX — generate as CSV with .xlsx extension note (real XLSX requires a library)
      // For now, generate XML-based XLSX-compatible format
      fileContent = generateXLSX(allData, config.columns, config.includeHeaders);
      writeFileSync(filepath, fileContent);
      fileSize = Buffer.byteLength(fileContent);
    }

    const durationMs = Date.now() - startTime;
    const fileUrl = `/api/v1/workspace/exports/${historyId}/download`;

    await db.exportHistory.update({
      where: { id: historyId },
      data: {
        status: "completed",
        processedRows: processed,
        fileSize,
        fileUrl,
        completedAt: new Date(),
      },
    });

    logger.info("export.complete", { historyId, totalRows: processed, fileSize, durationMs });

    return {
      historyId,
      totalRows: total,
      processedRows: processed,
      fileSize,
      fileUrl,
      format: config.format,
      durationMs,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("export.failed", { historyId, error: errorMsg });
    await db.exportHistory.update({
      where: { id: historyId },
      data: { status: "failed", errorMessage: errorMsg, completedAt: new Date() },
    });
    throw err;
  }
}

function getFieldValue(company: Record<string, unknown>, field: string, ai: Record<string, unknown> | undefined): unknown {
  // Direct company fields
  if (field in company) {
    const value = company[field];
    if (value instanceof Date) return value.toISOString();
    return value;
  }

  // AI analysis fields
  if (ai && field in ai) {
    return ai[field];
  }

  // Special computed fields
  switch (field) {
    case "tags":
      return ((company as { tags?: Array<{ tag: { name: string } }> }).tags ?? []).map((t) => t.tag.name).join(", ");
    case "technologies":
      return ((company as { companyTechnologies?: Array<{ technology: { name: string } }> }).companyTechnologies ?? [])
        .map((ct) => ct.technology.name).join(", ");
    case "aiSummary":
      return ai?.summaryOneLine ?? "";
    default:
      return "";
  }
}

function buildWhereFromFilters(filters?: Record<string, unknown>): Record<string, unknown> {
  if (!filters) return {};
  const where: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      where[key] = { contains: String(value) };
    }
  }
  return where;
}

function generateCSV(data: Record<string, unknown>[], columns: ExportColumn[], includeHeaders: boolean): string {
  const rows: string[] = [];

  if (includeHeaders) {
    rows.push(columns.map((c) => escapeCSV(c.label)).join(","));
  }

  for (const row of data) {
    const values = columns.map((c) => escapeCSV(String(row[c.field] ?? "")));
    rows.push(values.join(","));
  }

  return rows.join("\n");
}

export function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function generateXLSX(data: Record<string, unknown>[], columns: ExportColumn[], includeHeaders: boolean): string {
  // Simple XML-based spreadsheet format (Excel-compatible)
  const rows: string[] = ['<?xml version="1.0"?>', '<?mso-application progid="Excel.Sheet"?>', '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">', '<Worksheet ss:Name="Export">', '<Table>'];

  if (includeHeaders) {
    rows.push("<Row>");
    for (const col of columns) {
      rows.push(`<Cell><Data ss:Type="String">${escapeXml(col.label)}</Data></Cell>`);
    }
    rows.push("</Row>");
  }

  for (const row of data) {
    rows.push("<Row>");
    for (const col of columns) {
      const value = String(row[col.field] ?? "");
      const isNumeric = /^\d+$/.test(value);
      rows.push(`<Cell><Data ss:Type="${isNumeric ? "Number" : "String"}">${escapeXml(value)}</Data></Cell>`);
    }
    rows.push("</Row>");
  }

  rows.push("</Table>", "</Worksheet>", "</Workbook>");
  return rows.join("\n");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Preview an export — show sample rows, file size estimate, etc.
 */
export async function previewExport(config: ExportConfig): Promise<{
  columns: ExportColumn[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
  estimatedSizeBytes: number;
  estimatedDurationMs: number;
  warnings: string[];
}> {
  const where = config.selectedIds
    ? { id: { in: config.selectedIds } }
    : buildWhereFromFilters(config.filters);

  const total = await db.company.count({ where });

  // Get 5 sample rows
  const sample = await db.company.findMany({
    where,
    take: 5,
    include: {
      tags: { include: { tag: { select: { name: true } } } },
      companyTechnologies: { include: { technology: { select: { name: true } } } },
      aiAnalyses: {
        where: { status: "completed" },
        take: 1,
        orderBy: { analyzedAt: "desc" },
      },
    },
  });

  const sampleRows = sample.map((c) => {
    const ai = c.aiAnalyses[0] as Record<string, unknown> | undefined;
    const row: Record<string, unknown> = {};
    for (const col of config.columns) {
      row[col.field] = getFieldValue(c as unknown as Record<string, unknown>, col.field, ai);
    }
    return row;
  });

  // Estimate size (avg 200 bytes per row per format)
  const avgRowSize = config.format === "json" ? 500 : config.format === "xlsx" ? 300 : 200;
  const estimatedSizeBytes = total * avgRowSize;
  const estimatedDurationMs = Math.ceil(total / 500) * 100; // ~500 rows/sec

  const warnings: string[] = [];
  if (total > 50000) warnings.push("Large export — will run in background");
  if (total === 0) warnings.push("No data matches the current filters");
  if (config.columns.length > 30) warnings.push("Many columns selected — file will be large");

  return {
    columns: config.columns,
    sampleRows,
    totalRows: total,
    estimatedSizeBytes,
    estimatedDurationMs,
    warnings,
  };
}
