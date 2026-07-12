/**
 * Application-wide type definitions.
 *
 * These mirror the Prisma model shapes for use on the client (where Prisma
 * types cannot be imported directly). The canonical definitions live in
 * `/prisma/schema.prisma`; this file is the manually-synced client mirror.
 *
 * When Phase 2+ introduces the Fastify API service, the shared package
 * `packages/shared` will become the single source of truth for these types
 * and this file will re-export from there.
 */

export type ID = string;
export type ISODateString = string;

/* -------------------------------------------------------------------------- */
/*  Users & Auth                                                              */
/* -------------------------------------------------------------------------- */

export type UserRole = "ADMIN" | "USER";

export interface User {
  id: ID;
  email: string;
  name: string | null;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AuthSession {
  user: User;
  /** JWT access token — short-lived (15min) */
  accessToken: string;
  /** Refresh token — long-lived (30d), rotated on use */
  refreshToken: string;
  expiresAt: ISODateString;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/* -------------------------------------------------------------------------- */
/*  Companies & Leads                                                         */
/* -------------------------------------------------------------------------- */

export type CompanyStage =
  | "PRE_SEED"
  | "SEED"
  | "SERIES_A"
  | "SERIES_B"
  | "SERIES_C_PLUS"
  | "BOOTSTRAPPED"
  | "ACQUIRED"
  | "PUBLIC";

export type CompanySize = "1_10" | "11_50" | "51_200" | "201_500" | "501_1000" | "1000_PLUS";

export type LeadStatus =
  | "NEW"
  | "QUALIFIED"
  | "DISQUALIFIED"
  | "CONTACTED"
  | "RESPONDED"
  | "MEETING_BOOKED"
  | "CLOSED_WON"
  | "CLOSED_LOST";

export type LeadScoreGrade = "A" | "B" | "C" | "D" | "F";

export interface Company {
  id: ID;
  name: string;
  legalName: string | null;
  domain: string | null;
  description: string | null;
  logoUrl: string | null;
  stage: CompanyStage | null;
  size: CompanySize | null;
  industry: string | null;
  headquarters: string | null;
  foundedYear: number | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  crunchbaseUrl: string | null;
  technologies: string[];
  score: number | null;
  grade: LeadScoreGrade | null;
  status: LeadStatus;
  tags: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Person {
  id: ID;
  companyId: ID;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  emailVerified: boolean;
  title: string | null;
  seniority: string | null;
  department: string | null;
  linkedinUrl: string | null;
  avatarUrl: string | null;
  phone: string | null;
  verified: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Website {
  id: ID;
  companyId: ID;
  url: string;
  pageType:
    | "HOMEPAGE"
    | "PRICING"
    | "ABOUT"
    | "CAREERS"
    | "BLOG"
    | "CHANGELOG"
    | "CONTACT"
    | "LEGAL"
    | "OTHER";
  title: string | null;
  description: string | null;
  scrapedAt: ISODateString | null;
  contentHash: string | null;
  wordCount: number | null;
}

/* -------------------------------------------------------------------------- */
/*  Campaigns                                                                 */
/* -------------------------------------------------------------------------- */

export type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "ARCHIVED";

export interface Campaign {
  id: ID;
  name: string;
  description: string | null;
  status: CampaignStatus;
  audienceSize: number;
  contactedCount: number;
  responseCount: number;
  meetingCount: number;
  conversionRate: number;
  startDate: ISODateString | null;
  endDate: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/* -------------------------------------------------------------------------- */
/*  Scoring & Sources                                                         */
/* -------------------------------------------------------------------------- */

export interface Score {
  id: ID;
  companyId: ID;
  overall: number;
  grade: LeadScoreGrade;
  icpFit: number;
  maturity: number;
  pricingAvailability: number;
  hiring: number;
  funding: number;
  launchRecency: number;
  websiteQuality: number;
  videoOpportunity: number;
  reason: string | null;
  createdAt: ISODateString;
}

export type SourceType =
  | "YC"
  | "PRODUCT_HUNT"
  | "BETALIST"
  | "UNEED"
  | "DEVHUNT"
  | "HACKER_NEWS"
  | "SEC_EDGAR"
  | "GREENHOUSE"
  | "LEVER"
  | "ASHBY"
  | "MANUAL"
  | "API";

export interface Source {
  id: ID;
  companyId: ID;
  type: SourceType;
  externalId: string | null;
  url: string | null;
  rawPayload: unknown;
  firstSeenAt: ISODateString;
  lastSeenAt: ISODateString;
}

/* -------------------------------------------------------------------------- */
/*  Jobs & Audit                                                              */
/* -------------------------------------------------------------------------- */

export type JobType =
  | "DISCOVERY"
  | "NORMALIZATION"
  | "DEDUPLICATION"
  | "ENRICHMENT"
  | "SCRAPING"
  | "AI_QUALIFICATION"
  | "EMAIL_VERIFICATION"
  | "CLEANUP"
  | "SCHEDULER";

export type JobStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "RETRYING"
  | "CANCELLED";

export interface Job {
  id: ID;
  type: JobType;
  status: JobStatus;
  priority: number;
  payload: unknown;
  result: unknown;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  scheduledFor: ISODateString;
  startedAt: ISODateString | null;
  completedAt: ISODateString | null;
  durationMs: number | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT"
  | "IMPORT"
  | "CONFIGURE";

export interface AuditLog {
  id: ID;
  userId: ID | null;
  action: AuditAction;
  entity: string;
  entityId: ID | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: ISODateString;
}

/* -------------------------------------------------------------------------- */
/*  API helpers                                                               */
/* -------------------------------------------------------------------------- */

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  timestamp: ISODateString;
  services: Record<
    string,
    {
      status: "up" | "down" | "degraded";
      latencyMs?: number;
      details?: string;
    }
  >;
}
