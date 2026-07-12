# Architecture

> **Source of truth**: this document mirrors `Lead_Generation_Platform_Architecture_v1.0.md`.
> Any conflict between this document and the original — the original wins.

## Vision

Build a production-grade, fully self-hosted lead generation platform for discovering, enriching, qualifying, managing, and exporting high-quality SaaS and AI startup leads — without relying on Apollo or other paid lead databases.

## System Principles

1. Every component has a single responsibility.
2. Services communicate through REST APIs.
3. No service writes directly to another service's database.
4. PostgreSQL is the canonical datastore.
5. Background work is performed by dedicated workers.
6. Every service is independently replaceable.
7. All deployments target Docker Compose on Oracle Cloud.
8. Configuration is provided through environment variables only.

## Infrastructure

### Server 1 — Application

Runs: Reverse Proxy, Frontend Dashboard, Backend API, Authentication, PostgreSQL, CRM, File Storage, Analytics API.

### Server 2 — Automation

Runs: Firecrawl, FreeLLM API, Discovery Workers, Enrichment Workers, AI Qualification Workers, Email Verification Workers, Redis, RabbitMQ.

## High-Level Data Flow

```
Internet Sources
  → Discovery Workers
  → Normalization Engine
  → Deduplication Engine
  → Enrichment Pipeline
  → Firecrawl
  → AI Qualification (FreeLLM API)
  → Scoring Engine
  → PostgreSQL
  → Backend API
  → Dashboard / CRM / Outreach
```

## Core Services

### Discovery
Discovers companies from YC API, Product Hunt, BetaList, Uneed, DevHunt, Hacker News Show HN, SEC EDGAR, Greenhouse, Lever, Ashby. Produces a normalized Company object.

### Normalization
Converts every source into one canonical schema.

### Deduplication
Deduplicates by apex domain, fuzzy company name, and website normalization.

### Enrichment
Uses Firecrawl to collect homepage, pricing, about, careers, changelog, blog, contact, metadata, social links. Also extracts technologies, team size hints, product category, funding signals.

### AI Layer
Uses only the existing FreeLLM API endpoint. Responsibilities: classify company, summarize business, ICP matching, scoring, JSON structured output, confidence score. Never writes directly to the database.

### Scoring
Weighted scoring includes: ICP fit, company maturity, pricing availability, hiring, funding, launch recency, website quality, video opportunity.

## Database Conceptual Model

**Entities**: Company, Person, Email, Website, Source, Score, Campaign, Outreach, Job, Audit Log.

**Relationships**:
- Company owns People
- Company owns Websites
- Company has many Scores
- Campaign targets Companies

## Worker Architecture

Workers are independent: Discovery, Scraper, Enrichment, AI, Email, Cleanup, Scheduler. Each consumes jobs from RabbitMQ.

## API Rules

REST only. JWT authentication. Every endpoint is versioned, paginated, validated, rate-limited.

## Frontend

Modules: Dashboard, Leads, Companies, People, Campaigns, Analytics, AI Insights, Settings, System Health. Design language: premium SaaS, dark-first, responsive, fast, keyboard shortcuts.

## Security

JWT authentication, RBAC, encrypted secrets, audit logging, request validation, HTTPS everywhere.

## Logging

Every service emits structured JSON logs with request IDs, worker IDs, error codes.

## Deployment

Docker Compose only. Persistent volumes for PostgreSQL, Redis, RabbitMQ, Firecrawl. Secrets stored in `.env` files.

## Phase 1 Implementation Status

| Component            | Phase 1 status                          |
| -------------------- | --------------------------------------- |
| Premium UI           | ✅ Complete (13 pages, full design system) |
| Auth (JWT + refresh) | ✅ Complete                              |
| Database schema      | ✅ Complete (12 entities)                |
| Repository pattern   | ✅ Complete                              |
| API scaffold         | ✅ Complete (auth, health, CRUD stubs)   |
| Docker setup         | ✅ Complete                              |
| Discovery workers    | ⏳ Phase 2 (interface defined)           |
| Enrichment (Firecrawl) | ⏳ Phase 2 (interface defined)         |
| AI (FreeLLM)         | ⏳ Phase 2 (interface defined)           |
| RabbitMQ workers     | ⏳ Phase 2 (interface defined)           |
| Campaign automation  | ⏳ Phase 2+                              |
| Multi-user           | ⏳ Phase 3                               |

## Future Versions

- **Version 1** (Phase 2): End-to-end lead discovery and qualification
- **Version 2** (Phase 3): Campaign automation
- **Version 3** (Phase 4): Multi-user collaboration
- **Version 4** (Phase 5): Plugin ecosystem

## Explicit Non-Goals

- No n8n
- No Odysseus
- No Apollo dependency
- No paid enrichment APIs
- No vendor SDK coupling
- No hardcoded credentials
- No placeholder implementations
