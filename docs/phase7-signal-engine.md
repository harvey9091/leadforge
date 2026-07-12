# Lead Intelligence V2 & Signal Engine (Phase 7)

> Phase 7 transforms Leadforge from a tool that finds companies into a
> continuously learning lead intelligence platform that detects buying signals,
> tracks company evolution, and recommends actions.

## Core Principle

Every company has a continuously evolving intelligence profile. Instead of
being a static record, each company becomes a living entity with a timeline
of events, detected signals, and dynamic priority scores.

## Signal Engine

Detects 20+ signal types from enrichment data, AI analysis, and crawl changes:

- **Product**: product_launch, new_feature, homepage_redesign, changelog_update, docs_growth
- **Pricing**: pricing_change, new_pricing_page, enterprise_feature
- **Hiring**: hiring_increase, hiring_spike, team_growth
- **Funding**: funding_announcement
- **Technology**: technology_change, new_integration, api_release
- **Content**: new_blog_post, customer_story, case_study, press_release
- **Security**: security_cert

Each signal includes: type, timestamp, source, confidence, evidence, importance score.

### API

```
GET /api/v1/signals              — recent signals (intelligence feed)
GET /api/v1/signals?stats=true   — signal statistics
```

## Change Detection / Diff Engine

Compares every crawl against the previous version. Detects:
- Pricing changes
- Homepage copy changes
- Navigation/CTA changes
- New/removed pages
- Technology changes
- Hiring changes

Stores complete change history via `HistoricalSnapshot` records. Nothing is
overwritten — everything becomes historical.

### API

```
GET /api/v1/snapshots/:companyId                  — list snapshots
GET /api/v1/snapshots/:companyId?snapshotId=...   — get specific snapshot
GET /api/v1/snapshots/:companyId?compareWith=...  — compare two snapshots
```

## Timeline Engine

Every company has a chronological timeline of events:
- Discovery (when and from where)
- Enrichment (pages crawled, technologies detected)
- AI analysis (qualification, ICP match, confidence)
- Signals (pricing changes, hiring spikes, product launches)
- User actions (tags, notes, feedback)

### API

```
GET /api/v1/timeline/:companyId
```

## Smart Priority Engine

Replaces the static qualification score with a dynamic, evolving score based on:
- Discovery quality (10%)
- Enrichment quality (10%)
- AI confidence (15%)
- Website changes/activity (10%)
- Hiring velocity (12%)
- Funding stage (10%)
- Technology maturity (8%)
- Pricing maturity (8%)
- Signal freshness (10%)
- Historical trend (7%)

The score is fully explainable — every factor shows its contribution and reasoning.

## Recommendation Engine

Recommends actions with explanations:
- **high_priority** — dynamic priority score >= 75
- **analyze** — needs AI analysis or re-analysis
- **re-enrich** — needs website re-crawl
- **export** — strong lead, ready for outreach
- **needs_review** — low AI confidence
- **watch** — recent signals detected

### API

```
GET  /api/v1/recommendations         — top recommendations
POST /api/v1/recommendations         — generate for a company
```

## Watchlists

User-created tracking lists with auto-updating criteria:
- Name, description, color
- Criteria (industry, technology, funding stage, etc.)
- Auto-updating (re-evaluates periodically)
- Pinned for quick access

### API

```
GET    /api/v1/watchlists
POST   /api/v1/watchlists
GET    /api/v1/watchlists/:id
DELETE /api/v1/watchlists/:id
POST   /api/v1/watchlists/:id       — add/remove company
```

## Similar Company Engine

Finds similar companies using:
- Industry matching (25%)
- Technology overlap — Jaccard similarity (30%)
- Target customer match (15%)
- Pricing model match (10%)
- ICP match proximity (20%)

Results are cached for performance.

### API

```
GET /api/v1/similar/:companyId              — cached results
GET /api/v1/similar/:companyId?refresh=true — recompute
```

## Semantic Search

Natural language search with graceful fallback to structured filters.

Examples:
- "AI startups hiring frontend engineers"
- "Developer tools with pricing under $50"
- "Series A cybersecurity companies"
- "YC companies using Next.js"

The parser detects industries, technologies, funding stages, target customers,
pricing models, hiring roles, regions, and price ranges from natural language.

### API

```
POST /api/v1/semantic-search
Body: { "query": "AI startups hiring frontend engineers", "limit": 20 }
```

## Trend Analysis

Calculates aggregate trends across all companies:
- Fastest-growing industries (current vs previous 30 days)
- Most appearing technologies
- Most common pricing models (with change trends)
- Most active hiring categories
- Highest confidence sectors
- Most valuable discovery source (by avg qualification)

### API

```
GET /api/v1/trends
```

## Intelligence Feed

A live feed page showing the most important events:
- Signals (sorted by importance and recency)
- Recommendations (sorted by priority)
- Auto-refreshes every 15 seconds

### API

```
GET /api/v1/feed
```

## Historical Snapshots

Point-in-time captures of company data. Users can compare:
- Current state
- 1 month ago
- 3 months ago
- 6 months ago
- Last crawl

Changes are highlighted visually via the diff engine.

## Database Schema

Phase 7 adds these models:

- **Signal** — detected events with type, importance, confidence, evidence
- **TimelineEvent** — chronological company history
- **HistoricalSnapshot** — point-in-time data captures with content hash
- **Watchlist** — user-created tracking lists with criteria
- **WatchlistItem** — many-to-many join (watchlist ↔ company)
- **Recommendation** — action suggestions with reasons
- **TrendMetric** — aggregate trend calculations
- **SimilarityResult** — cached company similarity scores
- **SemanticEmbedding** — for semantic search (future FreeLLM embeddings)

## Performance

- All signal calculations run asynchronously (never block user requests)
- Similar company results are cached
- Trend calculations use in-memory aggregation
- Snapshot comparisons are done in JavaScript (not SQL)
- Signal detection is batched after enrichment/AI completion

## Final Engineering Principle

Leadforge has evolved from "a tool that finds companies" into "a continuously
learning lead intelligence platform that tells me who I should contact, when I
should contact them, and why they are a strong opportunity — using only
self-hosted infrastructure and publicly available data."
