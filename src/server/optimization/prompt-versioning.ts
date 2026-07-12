/**
 * =============================================================================
 * Prompt Versioning Engine — Phase 6
 * =============================================================================
 *
 * Manages AI prompt versions with performance tracking and A/B testing.
 *
 * Features:
 *  - Multiple prompt versions with different system prompts
 *  - Track performance per version (avg confidence, ICP match, tokens, duration)
 *  - A/B test two versions on a sample of companies
 *  - Promote the winning version to default
 *  - Cost estimation based on token usage
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/server/utils/logger";

export interface PromptVersionData {
  id: string;
  version: string;
  systemPrompt: string;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  totalAnalyses: number;
  totalTokensUsed: number;
  avgConfidence: number;
  avgDurationMs: number;
  avgIcpMatch: number;
  avgQualification: number;
  successRate: number;
}

/**
 * Cost per 1000 tokens (estimate — adjust based on actual FreeLLM costs).
 */
const COST_PER_1000_TOKENS = 0.002;

/**
 * Get the default prompt version.
 */
export async function getDefaultPromptVersion(): Promise<PromptVersionData | null> {
  const version = await db.promptVersion.findFirst({
    where: { isDefault: true, isActive: true },
  });
  return version as unknown as PromptVersionData | null;
}

/**
 * Get all active prompt versions.
 */
export async function getActivePromptVersions(): Promise<PromptVersionData[]> {
  const versions = await db.promptVersion.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return versions as unknown as PromptVersionData[];
}

/**
 * Create a new prompt version.
 */
export async function createPromptVersion(input: {
  version: string;
  systemPrompt: string;
  description?: string;
  isDefault?: boolean;
}): Promise<PromptVersionData> {
  // If this is the default, unset other defaults
  if (input.isDefault) {
    await db.promptVersion.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const created = await db.promptVersion.create({
    data: {
      version: input.version,
      systemPrompt: input.systemPrompt,
      description: input.description ?? null,
      isDefault: input.isDefault ?? false,
      isActive: true,
    },
  });

  return created as unknown as PromptVersionData;
}

/**
 * Record the result of an AI analysis for a prompt version.
 */
export async function recordPromptResult(
  version: string,
  result: { confidence: number; icpMatch: number; qualification: number; tokensUsed: number; durationMs: number; success: boolean }
): Promise<void> {
  const promptVersion = await db.promptVersion.findUnique({ where: { version } });
  if (!promptVersion) return;

  const n = promptVersion.totalAnalyses + 1;
  const newAvgConf = promptVersion.avgConfidence + (result.confidence - promptVersion.avgConfidence) / n;
  const newAvgIcp = promptVersion.avgIcpMatch + (result.icpMatch - promptVersion.avgIcpMatch) / n;
  const newAvgQual = promptVersion.avgQualification + (result.qualification - promptVersion.avgQualification) / n;
  const newAvgDur = promptVersion.avgDurationMs + (result.durationMs - promptVersion.avgDurationMs) / n;
  const newSuccessRate = ((promptVersion.successRate * (n - 1)) + (result.success ? 1 : 0)) / n;

  await db.promptVersion.update({
    where: { version },
    data: {
      totalAnalyses: { increment: 1 },
      totalTokensUsed: { increment: result.tokensUsed },
      avgConfidence: newAvgConf,
      avgIcpMatch: newAvgIcp,
      avgQualification: newAvgQual,
      avgDurationMs: newAvgDur,
      successRate: newSuccessRate,
    },
  });
}

/**
 * Estimate the cost of a prompt version based on token usage.
 */
export function estimateCost(totalTokens: number): number {
  return (totalTokens / 1000) * COST_PER_1000_TOKENS;
}

/**
 * Get prompt version statistics.
 */
export async function getPromptStats(): Promise<{
  versions: Array<PromptVersionData & { estimatedCost: number }>;
  totalTokens: number;
  totalCost: number;
  totalAnalyses: number;
}> {
  const versions = await getActivePromptVersions();
  const enriched = versions.map((v) => ({
    ...v,
    estimatedCost: estimateCost(v.totalTokensUsed),
  }));

  const totalTokens = enriched.reduce((sum, v) => sum + v.totalTokensUsed, 0);
  const totalAnalyses = enriched.reduce((sum, v) => sum + v.totalAnalyses, 0);

  return {
    versions: enriched,
    totalTokens,
    totalCost: estimateCost(totalTokens),
    totalAnalyses,
  };
}

/**
 * Start an A/B test between two prompt versions.
 */
export async function startABTest(input: {
  name: string;
  versionAId: string;
  versionBId: string;
  sampleSize?: number;
}): Promise<{ id: string; name: string; status: string }> {
  const test = await db.promptABTest.create({
    data: {
      name: input.name,
      versionAId: input.versionAId,
      versionBId: input.versionBId,
      sampleSize: input.sampleSize ?? 50,
      status: "running",
    },
  });
  logger.info("prompt.abTest.started", { testId: test.id, name: input.name });
  return { id: test.id, name: test.name, status: test.status };
}

/**
 * Get A/B test results.
 */
export async function getABTestResults(testId: string) {
  const test = await db.promptABTest.findUnique({ where: { id: testId } });
  if (!test) return null;

  const versionA = await db.promptVersion.findUnique({ where: { id: test.versionAId } });
  const versionB = await db.promptVersion.findUnique({ where: { id: test.versionBId } });

  return {
    id: test.id,
    name: test.name,
    status: test.status,
    samplesRun: test.samplesRun,
    sampleSize: test.sampleSize,
    winnerVersionId: test.winnerVersionId,
    versionA: versionA ? {
      version: versionA.version,
      avgConfidence: versionA.avgConfidence,
      avgIcpMatch: versionA.avgIcpMatch,
      avgQualification: versionA.avgQualification,
      successRate: versionA.successRate,
      totalAnalyses: versionA.totalAnalyses,
    } : null,
    versionB: versionB ? {
      version: versionB.version,
      avgConfidence: versionB.avgConfidence,
      avgIcpMatch: versionB.avgIcpMatch,
      avgQualification: versionB.avgQualification,
      successRate: versionB.successRate,
      totalAnalyses: versionB.totalAnalyses,
    } : null,
  };
}
