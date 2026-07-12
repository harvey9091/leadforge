/**
 * =============================================================================
 * Semantic Search — Phase 7
 * =============================================================================
 *
 * Natural language search with graceful fallback to structured filters.
 *
 * Examples:
 *  "AI startups hiring frontend engineers"
 *  "Developer tools with pricing under $50"
 *  "Series A cybersecurity companies"
 *  "YC companies using Next.js"
 *
 * Strategy:
 *  1. Parse the natural language query into structured filters
 *  2. Search using those filters
 *  3. If FreeLLM is available, optionally use embeddings for semantic matching
 * =============================================================================
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface SemanticSearchResult {
  query: string;
  parsedFilters: ParsedFilters;
  results: Array<{
    id: string;
    name: string;
    domain: string | null;
    description: string | null;
    industry: string | null;
    country: string | null;
    pricingModel: string | null;
    fundingStage: string | null;
    aiSummary: string | null;
    icpMatch: number | null;
    qualification: number | null;
    score: number;
  }>;
  total: number;
  usedSemantic: boolean;
}

export interface ParsedFilters {
  industries: string[];
  technologies: string[];
  pricingModels: string[];
  fundingStages: string[];
  targetCustomers: string[];
  hiringRoles: string[];
  keywords: string[];
  maxPrice?: number;
  regions: string[];
}

/**
 * Parse a natural language query into structured filters.
 */
export function parseSemanticQuery(query: string): ParsedFilters {
  const lower = query.toLowerCase();
  const filters: ParsedFilters = {
    industries: [],
    technologies: [],
    pricingModels: [],
    fundingStages: [],
    targetCustomers: [],
    hiringRoles: [],
    keywords: [],
    regions: [],
  };

  // Industry detection
  const industryMap: Record<string, string> = {
    "ai": "AI", "artificial intelligence": "AI",
    "developer tools": "Developer Tools", "devtools": "Developer Tools",
    "fintech": "Fintech", "finance": "Fintech",
    "healthtech": "Healthcare", "healthcare": "Healthcare", "health": "Healthcare",
    "education": "Education", "edtech": "Education",
    "cybersecurity": "Security", "security": "Security",
    "infrastructure": "Infrastructure", "devops": "Infrastructure",
    "saas": "SaaS",
    "ecommerce": "E-Commerce", "e-commerce": "E-Commerce",
    "marketing": "Marketing",
    "analytics": "Analytics",
    "productivity": "Productivity",
    "design": "Design",
    "communication": "Communication",
  };

  for (const [pattern, industry] of Object.entries(industryMap)) {
    if (lower.includes(pattern)) {
      if (!filters.industries.includes(industry)) {
        filters.industries.push(industry);
      }
    }
  }

  // Technology detection
  const techMap: Record<string, string> = {
    "next.js": "Next.js", "nextjs": "Next.js",
    "react": "React", "vue": "Vue.js", "angular": "Angular", "svelte": "Svelte",
    "stripe": "Stripe", "vercel": "Vercel", "supabase": "Supabase",
    "firebase": "Firebase", "cloudflare": "Cloudflare",
    "tailwind": "Tailwind CSS",
    "python": "Python", "django": "Django", "flask": "Flask",
    "node": "Node.js", "express": "Express.js",
    "postgresql": "PostgreSQL", "redis": "Redis",
    "kubernetes": "Kubernetes", "docker": "Docker",
    "sentry": "Sentry", "intercom": "Intercom",
  };

  for (const [pattern, tech] of Object.entries(techMap)) {
    if (lower.includes(pattern)) {
      if (!filters.technologies.includes(tech)) {
        filters.technologies.push(tech);
      }
    }
  }

  // Funding stage detection
  if (lower.includes("seed")) filters.fundingStages.push("Seed");
  if (lower.includes("series a")) filters.fundingStages.push("Series A");
  if (lower.includes("series b")) filters.fundingStages.push("Series B+");
  if (lower.includes("pre-seed") || lower.includes("preseed")) filters.fundingStages.push("Pre-seed");
  if (lower.includes("bootstrapped")) filters.fundingStages.push("Bootstrapped");

  // Target customer detection
  if (lower.includes("b2b")) filters.targetCustomers.push("B2B");
  if (lower.includes("b2c")) filters.targetCustomers.push("B2C");
  if (lower.includes("marketplace")) filters.targetCustomers.push("Marketplace");
  if (lower.includes("developer tool")) filters.targetCustomers.push("Developer Tool");

  // Pricing detection
  if (lower.includes("free") || lower.includes("freemium")) filters.pricingModels.push("Freemium");
  if (lower.includes("enterprise")) filters.pricingModels.push("Enterprise");
  if (lower.includes("trial")) filters.pricingModels.push("Trial");

  // Max price extraction
  const priceMatch = lower.match(/(?:under|below|less than|<)\s*\$(\d+)/);
  if (priceMatch) {
    filters.maxPrice = parseInt(priceMatch[1]!, 10);
  }

  // Hiring role detection
  if (lower.includes("frontend")) filters.hiringRoles.push("Frontend");
  if (lower.includes("backend")) filters.hiringRoles.push("Backend");
  if (lower.includes("engineer")) filters.hiringRoles.push("Engineering");
  if (lower.includes("sales")) filters.hiringRoles.push("Sales");
  if (lower.includes("marketing")) filters.hiringRoles.push("Marketing");

  // Region detection
  if (lower.includes("north america") || lower.includes("us ") || lower.includes("usa")) filters.regions.push("United States");
  if (lower.includes("europe") || lower.includes("eu ")) filters.regions.push("Europe");
  if (lower.includes("asia")) filters.regions.push("Asia");

  // Keywords — remaining words that aren't part of known patterns
  const stopWords = new Set(["ai", "startups", "startup", "companies", "company", "using", "with", "and", "or", "the", "a", "an", "for", "hiring", "looking", "based", "in", "under", "below", "less", "than"]);
  const words = lower.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));
  // Add words not already captured by patterns
  for (const word of words) {
    if (!Object.keys(industryMap).some((p) => p.includes(word)) && !Object.keys(techMap).some((p) => p.includes(word))) {
      if (!filters.keywords.includes(word)) {
        filters.keywords.push(word);
      }
    }
  }

  return filters;
}

/**
 * Execute a semantic search.
 */
export async function semanticSearch(query: string, limit: number = 20): Promise<SemanticSearchResult> {
  const filters = parseSemanticQuery(query);

  // Build where clause from parsed filters
  const where: Prisma.CompanyWhereInput = { AND: [] };

  // Industry filter
  if (filters.industries.length > 0) {
    (where.AND as Prisma.CompanyWhereInput[]).push({
      OR: filters.industries.map((ind) => ({ industry: { contains: ind } })),
    });
  }

  // Technology filter (via relation)
  if (filters.technologies.length > 0) {
    (where.AND as Prisma.CompanyWhereInput[]).push({
      companyTechnologies: {
        some: {
          technology: { name: { in: filters.technologies } },
        },
      },
    });
  }

  // Funding stage filter
  if (filters.fundingStages.length > 0) {
    (where.AND as Prisma.CompanyWhereInput[]).push({
      OR: filters.fundingStages.map((stage) => ({ fundingStage: { contains: stage } })),
    });
  }

  // Target customer filter (via AI analysis)
  if (filters.targetCustomers.length > 0) {
    (where.AND as Prisma.CompanyWhereInput[]).push({
      aiAnalyses: {
        some: { targetCustomer: { in: filters.targetCustomers } },
      },
    });
  }

  // Pricing model filter
  if (filters.pricingModels.length > 0) {
    (where.AND as Prisma.CompanyWhereInput[]).push({
      OR: filters.pricingModels.map((pm) => ({ pricingModel: { contains: pm } })),
    });
  }

  // Keyword search
  if (filters.keywords.length > 0) {
    const keywordConditions: Prisma.CompanyWhereInput[] = [];
    for (const kw of filters.keywords) {
      keywordConditions.push({ name: { contains: kw } });
      keywordConditions.push({ description: { contains: kw } });
      keywordConditions.push({ searchVector: { contains: kw } });
    }
    (where.AND as Prisma.CompanyWhereInput[]).push({ OR: keywordConditions });
  }

  // Clean up empty AND
  if ((where.AND as Prisma.CompanyWhereInput[]).length === 0) {
    delete where.AND;
  }

  const companies = await db.company.findMany({
    where,
    take: limit,
    orderBy: { discoveredAt: "desc" },
    include: {
      aiAnalyses: {
        where: { status: "completed" },
        take: 1,
        orderBy: { analyzedAt: "desc" },
        select: { summaryOneLine: true, icpMatchPct: true, qualificationScore: true, targetCustomer: true },
      },
    },
  });

  const results = companies.map((c) => {
    const ai = c.aiAnalyses[0];
    let score = 50;
    // Boost score based on filter matches
    if (filters.industries.length > 0 && c.industry && filters.industries.some((i) => c.industry?.toLowerCase().includes(i.toLowerCase()))) score += 20;
    if (filters.technologies.length > 0) score += 15;
    if (ai && filters.targetCustomers.length > 0 && ai.targetCustomer && filters.targetCustomers.includes(ai.targetCustomer)) score += 15;

    return {
      id: c.id,
      name: c.name,
      domain: c.domain,
      description: c.description,
      industry: c.industry,
      country: c.country,
      pricingModel: c.pricingModel,
      fundingStage: c.fundingStage,
      aiSummary: ai?.summaryOneLine ?? null,
      icpMatch: ai?.icpMatchPct ?? null,
      qualification: ai?.qualificationScore ?? null,
      score,
    };
  });

  results.sort((a, b) => b.score - a.score);

  return {
    query,
    parsedFilters: filters,
    results,
    total: results.length,
    usedSemantic: false, // Set to true when FreeLLM embeddings are used
  };
}
