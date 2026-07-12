/**
 * Leadforge — AI Worker (Phase 2)
 *
 * Consumes AI qualification jobs and runs FreeLLM inference.
 * Queue: leadforge.jobs.ai_qualification
 *
 * Per Architecture v1.0: uses ONLY the FreeLLM API endpoint.
 * Never writes directly to the database — returns results to the
 * enrichment service which persists them.
 */
export interface AiJob {
  companyId: string;
  /** Type of inference to run */
  task: "classify" | "summarize" | "icp_match" | "score";
}

export async function startAiWorker(): Promise<void> {
  throw new Error("Not implemented — Phase 2");
}
