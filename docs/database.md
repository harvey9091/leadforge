# Database Schema

The canonical schema lives at [`prisma/schema.prisma`](../prisma/schema.prisma). This document is a navigable overview.

## Entity-Relationship Diagram

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│   User   │────<│ ApiKey   │     │ Company  │
└──────────┘     └──────────┘     └────┬─────┘
     │                                │
     │                                ├────< Person ──< Email
     │                                │
     │                                ├────< Website
     │                                │
     │                                ├────< Source
     │                                │
     │                                ├────< Score
     │                                │
     │                                └────< CampaignTarget >── Campaign
     │                                                            │
     │                                                            └─< Outreach
     │
     └────< AuditLog
┌──────────┐
│   Job    │  (standalone — mirror of RabbitMQ queue)
└──────────┘
┌──────────────┐
│ RefreshToken │  (>── User)
└──────────────┘
```

## Entities

### User
The authenticated account. First user becomes ADMIN.
- `id` (cuid), `email` (unique), `name`, `passwordHash`, `role`, `avatarUrl`, `emailVerified`, `lastLoginAt`

### RefreshToken
Hashed refresh token for session rotation.
- `id`, `userId`, `tokenHash` (unique), `expiresAt`, `revokedAt`, `userAgent`, `ip`

### ApiKey
Programmatic access tokens (SHA-256 hashed at rest).
- `id`, `userId`, `name`, `keyPrefix`, `keyHash` (unique), `lastUsedAt`, `expiresAt`, `revokedAt`

### Company
The core entity — a discovered business.
- `id`, `name`, `legalName`, `domain` (unique), `description`, `logoUrl`
- `stage` (PRE_SEED → PUBLIC), `size` (1-10 → 1000+), `industry`, `headquarters`, `foundedYear`
- `linkedinUrl`, `twitterUrl`, `crunchbaseUrl`
- `technologies` (JSON array), `tags` (JSON array)
- `score` (0-100), `grade` (A-F), `status` (NEW → CLOSED_LOST)
- `discoveredAt`, `createdAt`, `updatedAt`

### Person
A contact at a company.
- `id`, `companyId`, `fullName`, `firstName`, `lastName`
- `email`, `emailVerified`, `title`, `seniority`, `department`
- `linkedinUrl`, `avatarUrl`, `phone`, `verified`

### Email
Email addresses discovered for a person (one-to-many).
- `id`, `personId`, `address`, `verified`, `verifiedAt`, `source`

### Website
A scraped page belonging to a company.
- `id`, `companyId`, `url`, `pageType` (HOMEPAGE, PRICING, ABOUT, CAREERS, BLOG, CHANGELOG, CONTACT, LEGAL, OTHER)
- `title`, `description`, `scrapedAt`, `contentHash`, `wordCount`

### Source
Provenance — where a company was discovered.
- `id`, `companyId`, `type` (YC, PRODUCT_HUNT, HACKER_NEWS, SEC_EDGAR, GREENHOUSE, LEVER, ASHBY, MANUAL, API)
- `externalId`, `url`, `rawPayload` (JSON), `firstSeenAt`, `lastSeenAt`

### Score
A historical score record for a company (snapshot at scoring time).
- `id`, `companyId`, `overall`, `grade`
- `icpFit`, `maturity`, `pricingAvailability`, `hiring`, `funding`, `launchRecency`, `websiteQuality`, `videoOpportunity`
- `reason` (LLM explanation), `createdAt`

### Campaign
An outreach campaign.
- `id`, `name`, `description`, `status` (DRAFT, SCHEDULED, ACTIVE, PAUSED, COMPLETED, ARCHIVED)
- `startDate`, `endDate`, `createdAt`, `updatedAt`

### CampaignTarget
Many-to-many join between Campaign and Company.
- `id`, `campaignId`, `companyId`, `status`, `addedAt`
- Unique constraint: `(campaignId, companyId)`

### Outreach
An individual outreach action (email, call, etc.).
- `id`, `campaignId` (nullable), `personId` (nullable), `companyId` (nullable)
- `channel`, `subject`, `body`, `status`, `sentAt`, `respondedAt`

### Job
A background job (mirror of RabbitMQ queue for visibility + replay).
- `id`, `type` (DISCOVERY, NORMALIZATION, DEDUPLICATION, ENRICHMENT, SCRAPING, AI_QUALIFICATION, EMAIL_VERIFICATION, CLEANUP, SCHEDULER)
- `status` (QUEUED, RUNNING, COMPLETED, FAILED, RETRYING, CANCELLED)
- `priority` (1-10), `payload` (JSON), `result` (JSON), `error`
- `attempts`, `maxAttempts`, `scheduledFor`, `startedAt`, `completedAt`, `durationMs`

### AuditLog
Compliance trail — append-only.
- `id`, `userId` (nullable), `action` (CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, IMPORT, CONFIGURE)
- `entity`, `entityId`, `before` (JSON), `after` (JSON)
- `ip`, `userAgent`, `requestId`, `createdAt`

## Indexes

Every foreign key has an index. Additionally:

- `Company`: status, stage, grade, industry
- `Person`: companyId, email, seniority
- `Email`: personId, address
- `Website`: companyId, pageType
- `Source`: companyId, type
- `Score`: companyId, grade
- `Job`: (type, status), (status, scheduledFor)
- `AuditLog`: userId, (entity, entityId), createdAt

## Migration strategy

Phase 1 uses `prisma db push` (schema-first, no migration history). Phase 2 will switch to `prisma migrate` so production deployments have an auditable migration trail.

The schema is intentionally written without SQLite-specific types so the migration to PostgreSQL (Phase 2) is mechanical.

## Phase 2 additions

When the discovery + enrichment workers are wired:
- Add `Job.payload` typed schemas (Zod) per `JobType`
- Add a `Webhook` entity for outbound integrations
- Add a `Sequence` + `SequenceStep` entity for multi-step campaigns
- Add `Tag` as a first-class entity (currently stored as JSON array on Company)
