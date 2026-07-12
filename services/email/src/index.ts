/**
 * =============================================================================
 * Leadforge — Email Service (Phase 2)
 * =============================================================================
 *
 * Discovers, verifies, and validates email addresses for people.
 *
 * Pipeline:
 *  1. Discovery — extract emails from company websites (careers, about, contact)
 *  2. Pattern generation — {first}.{last}@domain, {first}@domain, etc.
 *  3. Verification — SMTP MX check + catch-all detection
 *  4. Validation — regex + deliverability check
 *
 * Phase 1 status: interface defined, no implementation.
 * =============================================================================
 */

export interface EmailVerificationResult {
  email: string;
  valid: boolean;
  /** "valid" | "invalid" | "risky" | "unknown" */
  status: "valid" | "invalid" | "risky" | "unknown";
  /** True if the domain has a catch-all policy (accepts any address) */
  catchAll: boolean;
  /** True if MX records exist */
  hasMx: boolean;
  /** Optional reason for invalid/risky */
  reason?: string;
  verifiedAt: string;
}

export async function verifyEmail(email: string): Promise<EmailVerificationResult> {
  throw new Error("Not implemented — Phase 2");
}
