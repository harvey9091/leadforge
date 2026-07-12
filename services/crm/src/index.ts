/**
 * =============================================================================
 * Leadforge — CRM Service (Phase 2+)
 * =============================================================================
 *
 * Lightweight CRM layer for managing outreach and relationships.
 *
 * Phase 1: not implemented. The architecture doc defers CRM logic to a
 * later phase; Phase 1 only models the entities (Campaign, Outreach).
 *
 * Phase 2 will add:
 *  - Campaign sequencing (multi-step outreach)
 *  - Email template management
 *  - Send scheduling with rate limiting
 *  - Response detection + sentiment
 *  - Meeting booking (via calendar integration)
 *
 * Phase 3+ (per Architecture v1.0 Future Versions):
 *  - Multi-user collaboration
 *  - Plugin ecosystem
 * =============================================================================
 */

export interface CrmLead {
  companyId: string;
  status: "NEW" | "QUALIFIED" | "CONTACTED" | "RESPONDED" | "MEETING_BOOKED" | "CLOSED_WON" | "CLOSED_LOST";
  ownerId?: string;
  lastActivityAt?: string;
  notes: string[];
}

export async function moveLead(
  companyId: string,
  toStatus: CrmLead["status"]
): Promise<void> {
  throw new Error("Not implemented — Phase 2+");
}
