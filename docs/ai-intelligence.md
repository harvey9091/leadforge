# Lead Intelligence Engine (Phase 4)

> AI-powered company analysis using FreeLLM (z-ai-web-dev-sdk). Every enriched
> company receives a complete intelligence profile with traceable evidence.

## How it works

```
Company (enriched)
  → Content Extraction (technologies, content blocks, pricing signals)
  → Prompt Builder (system + user prompt with company data + ICP config)
  → FreeLLM (z-ai-web-dev-sdk chat completions)
  → Structured JSON response
  → Zod Schema Validation (reject malformed, retry automatically)
  → Confidence Engine (every field gets confidence + evidence)
  → Database (AIAnalysis + AIEvidence records)
  → Dashboard / AI Insights page
```

No AI response is written directly to PostgreSQL — everything passes through
Zod schema validation first. If validation fails, the worker retries with
exponential backoff.

## FreeLLM Integration

The application uses **only** the `z-ai-web-dev-sdk` as its LLM gateway.
No direct calls to OpenAI, Anthropic, Gemini, Groq, or OpenRouter.

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_MODEL` | `default` | Model name |
| `AI_TEMPERATURE` | `0.3` | Temperature (low = more consistent) |
| `AI_MAX_TOKENS` | `4000` | Max tokens per response |
| `AI_TIMEOUT` | `60000` | Request timeout in ms |
| `AI_RETRIES` | `3` | Max retry attempts |

### Circuit Breaker

If 5 consecutive AI calls fail, the circuit breaker opens and blocks all
AI calls for 60 seconds. This prevents cascading failures when the LLM
service is degraded. The circuit breaker state is visible on the System page.

### Caching

AI responses are cached by: `companyId + websiteHash + promptHash + modelVersion`.

When a company's website is re-enriched (content changes), the `websiteHash`
changes and the cache is automatically invalidated. The next analysis will
call FreeLLM with fresh data.

## Structured Output

Every LLM response MUST be valid JSON conforming to the Zod schema defined
in `src/server/ai/schema.ts`. The schema includes:

- **Business intelligence**: one-line summary, paragraph, detailed summary, product category, sub-category, industry, target market, target customer, customer profile
- **Pricing intelligence**: pricing model (Free/Freemium/Trial/Paid/Enterprise/Custom/Unknown), pricing estimate, budget category
- **Company stage**: Idea/Bootstrapped/Pre-seed/Seed/Series A/Series B+/Enterprise/Public/Unknown + confidence
- **Hiring intelligence**: hiring status, trend, team composition, remote-first
- **Product maturity**: MVP/Growing/Established/Enterprise/Legacy/Unknown
- **Website quality** (0-100): visual quality, UX, copywriting, brand, performance, professionalism, modernity, overall
- **Video opportunity** (0-100): product video, explainer, homepage animation, demo, launch trailer, onboarding, feature updates, social content, overall
- **ICP match**: match percentage, reasons, missing requirements, strengths, weaknesses
- **Qualification score**: 0-100 with reasons
- **Risk factors** + **Opportunity factors**: arrays of strings
- **Evidence**: every major conclusion cites field, value, confidence, source, evidence text, and reasoning

### Hallucination Prevention

If the LLM doesn't know something, it MUST return `"Unknown"`. The system
prompt explicitly instructs: "If you don't know something, return 'Unknown'
— never fabricate or guess."

## Evidence Engine

Every AI conclusion must cite supporting evidence. Example:

```
Field: productCategory
Value: Developer Tools
Confidence: 95%
Source: homepage
Evidence: "Homepage mentions 'developer tools' and 'CI/CD integration'"
Reasoning: "The homepage clearly positions this as a developer tools product"
```

No unexplained scores — every field has a trail back to the source data.

## ICP Engine

Users define their Ideal Customer Profile (ICP) via the API or Settings:

- **Industries**: e.g., Developer Tools, AI Infrastructure, B2B SaaS
- **Categories**: product categories
- **Target markets**: B2B, B2C, Marketplace, etc.
- **Employee range**: min-max
- **Funding stages**: Pre-seed, Seed, Series A, etc.
- **Hiring roles**: Engineering, Sales, Marketing
- **Pricing visible**: required or not
- **Regions**: North America, Europe, etc.

The ICP config is included in the prompt sent to FreeLLM. The LLM calculates
ICP Match %, missing requirements, strengths, and weaknesses based on the
provided ICP criteria and the company's enriched data.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/ai/analyze` | Analyze a single company |
| POST | `/api/v1/ai/batch` | Start batch analysis (up to 1000 companies) |
| GET | `/api/v1/ai/jobs` | List AI jobs |
| GET | `/api/v1/ai/insights/:companyId` | Get AI analysis for a company |
| GET | `/api/v1/ai/stats` | AI dashboard metrics |
| GET | `/api/v1/ai/icp` | Get active ICP config |
| PUT | `/api/v1/ai/icp` | Update ICP config |
| GET | `/api/v1/ai/search?q=...` | Search AI analyses |
| POST | `/api/v1/ai/test` | Test FreeLLM connection |

## Database Schema

Phase 4 adds these models:

- **AIAnalysis** — full intelligence profile (30+ fields)
- **AIEvidence** — per-conclusion evidence records
- **ICPConfig** — user-defined Ideal Customer Profile
- **PromptCache** — cached LLM responses (keyed by company + website + prompt + model)
- **AIJob** — background job queue for analysis tasks

## Worker Lifecycle

The AI worker follows the same pattern as discovery + enrichment workers:

- **Polling**: every 10 seconds
- **Concurrency**: 1 job at a time (AI calls are expensive)
- **Heartbeat**: updated during processing
- **Stale recovery**: jobs with no heartbeat for 3 minutes are retried
- **Circuit breaker**: 5 consecutive failures = 60s cooldown

## Verified Results

Real AI analysis completed on a discovered company:

- **Company**: Mojave Paint (mojavepaint.app)
- **Summary**: "Mojave Paint is a macOS-focused image editing tool designed for precise graphical asset production."
- **ICP Match**: 85%
- **Qualification Score**: 75/100
- **Confidence**: 80%
- **Evidence**: 8 items (each with field, value, confidence, source, evidence text)
- **Tokens used**: 3013
- **Duration**: 19.8 seconds
- **Industry**: Software Development
