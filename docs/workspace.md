# Lead Intelligence Workspace (Phase 5)

> Transform Leadforge from a data pipeline into a professional research workspace
> where users can explore, filter, compare, organize, prioritize, and export
> high-quality companies.

## Core Philosophy

Leadforge is NOT a CRM. It is NOT an email platform. It is NOT an outreach platform.

Its sole responsibility is: **Discover → Enrich → Understand → Filter → Export**

## Advanced Search

The search engine (`/src/server/workspace/search-engine.ts`) supports:

- **Fuzzy matching**: case-insensitive partial matching across all fields
- **Quoted phrases**: `"project management tool"` — exact match
- **Boolean operators**: `AND`, `OR`, `NOT`
- **Exclusion**: `-wordpress` — exclude results containing "wordpress"
- **Field-specific filters**: `industry:AI`, `country:US`, `funding:Seed`
- **Autocomplete**: `/api/v1/companies/search?autocomplete=true&q=...`
- **Search history**: recorded automatically, viewable via API

### Search fields

Company name, domain, description, website content, technologies, categories,
pricing, industries, funding, countries, hiring, AI summaries, evidence, tags.

### API

```
GET /api/v1/companies/search?q=ai AND saas -healthcare&page=1&pageSize=50
```

## Export Engine

The export engine (`/src/server/workspace/export/export-engine.ts`) supports:

- **Formats**: CSV, JSON, XLSX (Excel-compatible XML)
- **Custom columns**: choose which fields to include
- **Export presets**: LightReach, Clay, Apollo, HubSpot, Custom
- **Export profiles**: reusable templates with saved column mappings
- **Preview mode**: see sample rows, file size estimate, warnings before exporting
- **Background processing**: large exports (100k+ rows) processed in chunks
- **Progress tracking**: `processedRows` / `totalRows` on ExportHistory records
- **Export history**: every export recorded with status, file size, duration

### API

```
POST /api/v1/workspace/exports
{
  "format": "csv",
  "preset": "lightreach",  // optional
  "selectedIds": ["..."],  // optional — export selected companies
  "filters": { ... },      // optional — export filtered companies
  "preview": true           // optional — preview without exporting
}
```

## Collections

Custom collections organize companies into smart folders:

- Create named collections (e.g., "Top AI Startups", "YC Summer 2026")
- Color-coded with optional icons
- Smart collections (auto-populated from a saved query)
- Pin important collections
- Add/remove companies via API

### API

```
GET    /api/v1/workspace/collections
POST   /api/v1/workspace/collections
GET    /api/v1/workspace/collections/:id
PUT    /api/v1/workspace/collections/:id
DELETE /api/v1/workspace/collections/:id
GET    /api/v1/workspace/collections/:id/companies
POST   /api/v1/workspace/collections/:id/companies
```

## Notes

Markdown notes attached to companies:

- Version history (incremented on each edit)
- Author tracking
- Timestamped
- Searchable

### API

```
GET  /api/v1/workspace/notes?companyId=...
POST /api/v1/workspace/notes
PUT  /api/v1/workspace/notes/:id
DELETE /api/v1/workspace/notes/:id
```

## Saved Views

Persist searches, filters, and column layouts:

- Named views (e.g., "High ICP AI Startups")
- Pinned views for quick access
- Default view for workspace
- Saved column layouts
- Saved sort order

### API

```
GET    /api/v1/workspace/views
POST   /api/v1/workspace/views
DELETE /api/v1/workspace/views/:id
```

## Bulk Operations

Operate on multiple companies at once:

- **Tag**: add a tag to selected companies
- **Untag**: remove a tag
- **Re-analyze**: queue AI analysis for selected companies
- **Re-enrich**: queue website enrichment for selected companies
- **Pin**: pin selected companies
- **Unpin**: unpin selected companies
- **Archive**: mark as disqualified
- **Delete**: permanently delete

### API

```
POST /api/v1/workspace/bulk
{
  "action": "tag",
  "companyIds": ["id1", "id2", ...],
  "data": "High Priority"
}
```

## Comparison Mode

Compare up to 5 companies side-by-side:

- ICP match, qualification, confidence scores
- Technologies (overlapping and unique)
- Pricing models
- Funding stages
- Hiring status
- Website quality scores
- Video opportunity scores
- Target customer
- AI summary

### API

```
POST /api/v1/workspace/compare
{
  "companyIds": ["id1", "id2", "id3"]
}
```

## Company Detail Workspace

The Company detail page (`/company/:id`) has 8 tabs:

1. **Overview** — company facts, AI scores, contact info, business summary, risk/opportunity factors
2. **AI Intelligence** — full AI analysis with ICP match, website quality, video opportunity
3. **Technologies** — detected tech stack grouped by category
4. **Pricing** — pricing signals and AI pricing intelligence
5. **People** — contacts (links to People page)
6. **Timeline** — discovery → enrichment → AI analysis history
7. **Evidence** — all AI evidence with field, value, confidence, source, reasoning
8. **Notes** — user notes with markdown support

## Analytics Workspace

Intelligence-focused analytics at `/api/v1/workspace/analytics`:

- Top industries, technologies, funding stages, pricing models, countries
- Discovery source distribution
- ICP match distribution
- Qualification score distribution
- Video opportunity distribution
- Average AI confidence

## Database Schema

Phase 5 adds these models:

- **Collection** — custom collections (smart folders)
- **CollectionCompany** — many-to-many join (collection ↔ company)
- **Note** — markdown notes with version history
- **SavedView** — persisted searches/filters/layouts
- **ExportProfile** — reusable export templates
- **ExportHistory** — export job records with progress tracking
- **SearchHistory** — search query history
- **PinnedCompany** — pinned companies
- **WorkspacePrefs** — user workspace preferences

## Performance

The workspace is designed for 100,000+ companies:

- Chunked processing for exports (500 rows per chunk)
- Cursor-based pagination support
- In-memory aggregation for analytics (avoids expensive SQL groupBy)
- Efficient Prisma queries with selective field loading
- HTML capped at 500KB per page (enrichment memory safety)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/companies/search` | Advanced search |
| POST | `/api/v1/workspace/compare` | Compare companies |
| POST | `/api/v1/workspace/bulk` | Bulk operations |
| GET | `/api/v1/workspace/analytics` | Intelligence analytics |
| GET/POST | `/api/v1/workspace/collections` | Collections CRUD |
| GET/PUT/DELETE | `/api/v1/workspace/collections/:id` | Collection detail |
| GET/POST | `/api/v1/workspace/collections/:id/companies` | Collection members |
| GET/POST | `/api/v1/workspace/notes` | Notes CRUD |
| PUT/DELETE | `/api/v1/workspace/notes/:id` | Note detail |
| GET/POST | `/api/v1/workspace/views` | Saved views CRUD |
| DELETE | `/api/v1/workspace/views/:id` | Delete view |
| POST | `/api/v1/workspace/exports` | Start export |
| GET | `/api/v1/workspace/exports/history` | Export history |
| GET/POST | `/api/v1/workspace/exports/profiles` | Export profiles |
| DELETE | `/api/v1/workspace/exports/profiles/:id` | Delete profile |
| GET | `/api/v1/workspace/exports/:id/download` | Download export |
| GET/DELETE | `/api/v1/workspace/search/history` | Search history |
| GET/POST | `/api/v1/workspace/pinned` | Pinned companies |
| GET/PUT | `/api/v1/workspace/prefs` | Workspace preferences |
