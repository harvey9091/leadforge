# Enrichment Engine (Phase 3)

> Transforms discovered companies into rich company profiles using Firecrawl
> (or direct HTTP scraping fallback). Detects technologies, extracts content,
> checks website health, and stores historical snapshots.

## How enrichment works

```
User creates enrichment job (UI or API)
  → Job inserted into EnrichmentJob table with status=QUEUED
  → Enrichment worker polls for QUEUED jobs (every 15 seconds)
  → Worker sets status=RUNNING
  → For each page (homepage, pricing, about, contact, careers):
      → Crawl page via Firecrawl (or direct HTTP fetch)
      → Detect technologies from HTML
      → Extract structured content (title, description, CTA, contact info)
      → Store website snapshot (for diff engine)
  → Update company with enriched fields
  → Store content blocks
  → Store detected technologies
  → Emit EnrichmentCompleted event
  → Worker sets status=COMPLETED
```

## Dual-mode scraping

The enrichment engine operates in two modes:

1. **Firecrawl mode** (production): When `FIRECRAWL_API_URL` is configured and
   the Firecrawl instance is reachable, all scraping goes through Firecrawl's
   `/v1/scrape` endpoint. This provides JavaScript rendering, structured
   extraction, and screenshot capture.

2. **Direct HTTP mode** (dev fallback): When Firecrawl is not configured or
   unreachable, the engine falls back to direct HTTP fetching. This still
   fetches real websites — no mock data. The same `CrawledPage` shape is
   produced so downstream code doesn't care which mode was used.

Mode is selected automatically based on environment configuration and health
check results. The System page shows which mode is active.

## Technology detection

The technology detection engine (`/src/server/enrichment/technologies/detector.ts`)
uses regex patterns to identify 80+ technologies from HTML:

- **Frontend**: React, Next.js, Vue, Angular, Svelte, Solid, Gatsby, Remix, Astro, etc.
- **Backend**: Laravel, Rails, Django, WordPress, Express, Fastify, NestJS, Spring, Phoenix
- **Hosting**: Vercel, Netlify, Cloudflare, AWS, CloudFront, Fly.io, Railway, Render, Heroku
- **Database**: Supabase, Firebase, PlanetScale, Neon, Turso
- **Analytics**: Google Analytics, GTM, Mixpanel, PostHog, Segment, Amplitude, Hotjar, Plausible
- **Payments**: Stripe, Lemon Squeezy, Paddle, RevenueCat, Chargebee
- **Auth**: Clerk, Auth0, Stytch, NextAuth, WorkOS
- **Monitoring**: Sentry, Datadog, LogRocket, Bugsnag
- **Support**: Intercom, HubSpot, Crisp, Zendesk, Drift, Tawk.to
- **CMS**: Contentful, Sanity, Strapi, Prismic, Webflow, Wix
- **Email**: Mailchimp, ConvertKit, Klaviyo, Brevo, Resend
- **And more**: build tools, fonts, icons, UI libraries, video, search

### Adding a new technology

Add a rule to `TECHNOLOGY_RULES` in `detector.ts`:

```typescript
{
  name: "Your Tech",
  slug: "your-tech",
  category: "frontend",
  patterns: [/your-tech\.js/i, /data-your-tech/i],
}
```

That's it — the detector will automatically find it on the next enrichment run.

## Content extraction

The content extractor (`/src/server/enrichment/content-extractor.ts`) pulls
structured data from crawled HTML:

- **Meta**: title, description, H1, keywords
- **Navigation**: all nav links
- **Contact**: emails (support, contact, general), phone, address
- **Social**: Twitter, LinkedIn, GitHub, Facebook, Instagram, YouTube, Discord
- **Branding**: logo URL, hero image URL
- **Pricing**: pricing detected, trial detected, freemium detected, enterprise detected, pricing model
- **Content blocks**: headings and paragraphs (for AI processing)
- **Languages**: from `html lang` and `hreflang` attributes
- **CTA**: call-to-action button text

All extracted content is sanitized — no raw HTML is stored.

## Website health

For each enriched company, the engine tracks:

- HTTPS enabled
- HTTP status code
- Page load speed (ms)
- Redirect chain
- robots.txt content
- sitemap.xml URL
- Canonical URL

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/enrich/jobs` | Create enrichment job |
| GET | `/api/v1/enrich/jobs` | List enrichment jobs |
| GET | `/api/v1/enrich/jobs/:id` | Get job details |
| POST | `/api/v1/enrich/jobs/:id/pause` | Pause a running job |
| POST | `/api/v1/enrich/jobs/:id/resume` | Resume a paused job |
| POST | `/api/v1/enrich/jobs/:id/retry` | Retry a failed/completed job |
| GET | `/api/v1/enrich/jobs/:id/logs` | Get job logs |
| GET | `/api/v1/enrich/stats` | Enrichment dashboard metrics |
| GET | `/api/v1/firecrawl/health` | Firecrawl health check |

## Database schema

Phase 3 adds these tables:

- **EnrichmentJob** — enrichment job with status, progress, pages crawled
- **EnrichmentLog** — per-job structured log entries
- **WebsiteSnapshot** — historical page captures (for diff engine)
- **Technology** — technology registry (name, slug, category)
- **CompanyTechnology** — many-to-many join (company ↔ technology)
- **Pricing** — extracted pricing plans
- **Screenshot** — captured screenshots
- **ContentBlock** — structured content extracted from pages

The Company model is extended with enrichment fields: headline, category,
ICP hints, pricing model, contact info, website health, enrichment metadata.

## Worker lifecycle

The enrichment worker follows the same pattern as the discovery worker:

- **Polling**: every 15 seconds (less aggressive than discovery)
- **Concurrency**: 1 job at a time (enrichment is memory-intensive)
- **Heartbeat**: updated every page crawl
- **Stale recovery**: jobs with no heartbeat for 3 minutes are retried
- **Crash-safe**: job state is persisted; stale jobs are detected on restart

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `FIRECRAWL_API_URL` | — | Firecrawl instance URL (e.g. `http://firecrawl:3002`) |
| `FIRECRAWL_API_KEY` | — | Firecrawl API key (if auth required) |
| `FIRECRAWL_TIMEOUT` | `30000` | Request timeout in ms |
| `FIRECRAWL_MAX_RETRIES` | `2` | Max retry attempts |

When `FIRECRAWL_API_URL` is not set, the engine uses direct HTTP fetching.

## Security

- All URLs are validated before crawling (http/https only)
- HTML is sanitized before storage (scripts, iframes, event handlers removed)
- HTML is capped at 500KB per page to prevent memory issues
- Rate limited to 2 requests/second per source
- robots.txt is respected where appropriate

## Events

The enrichment engine emits these events through the event bus:

- `EnrichmentStarted` — job started processing
- `EnrichmentCompleted` — job finished successfully
- `EnrichmentFailed` — job failed

Other services can subscribe to these events to trigger downstream actions
(e.g., AI qualification after enrichment completes).
