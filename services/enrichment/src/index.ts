/**
 * =============================================================================
 * Leadforge — Enrichment Service (Phase 2)
 * =============================================================================
 *
 * Uses Firecrawl to scrape and extract structured data from each
 * company's web presence.
 *
 * Pages scraped (per Architecture v1.0):
 *  - homepage
 *  - pricing
 *  - about
 *  - careers
 *  - changelog
 *  - blog
 *  - contact
 *  - legal
 *
 * Extracted signals:
 *  - technologies (from <script> tags, headers, wappalyzer)
 *  - team size hints (from careers page count, about page)
 *  - product category (from homepage hero + meta description)
 *  - funding signals (from news mentions, SEC filings)
 *  - social links
 *
 * Output is stored in the Website[] and embedded into Company.
 *
 * Phase 1 status: interface defined, no implementation.
 * =============================================================================
 */

export interface EnrichmentRequest {
  companyId: string;
  domain: string;
  /** Which page types to scrape (defaults to all) */
  pageTypes?: PageType[];
}

export type PageType =
  | "HOMEPAGE"
  | "PRICING"
  | "ABOUT"
  | "CAREERS"
  | "BLOG"
  | "CHANGELOG"
  | "CONTACT"
  | "LEGAL";

export interface EnrichmentResult {
  companyId: string;
  pages: Array<{
    url: string;
    pageType: PageType;
    title?: string;
    description?: string;
    wordCount: number;
    contentHash: string;
    scrapedAt: string;
  }>;
  technologies: string[];
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    github?: string;
  };
  teamSizeHint?: number;
  productCategory?: string;
  fundingSignals?: string[];
}

export async function enrichCompany(
  request: EnrichmentRequest
): Promise<EnrichmentResult> {
  throw new Error("Not implemented — Phase 2");
}
