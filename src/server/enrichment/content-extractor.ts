/**
 * =============================================================================
 * Content Extractor
 * =============================================================================
 *
 * Extracts structured data from crawled HTML:
 *  - Title, description, H1, keywords
 *  - Navigation links
 *  - Footer content
 *  - Contact information (emails, phones)
 *  - Social media links
 *  - Logo and hero image
 *  - Call-to-action text
 *  - Pricing information
 *  - Content blocks (headings + paragraphs)
 *
 * All output is sanitized — no raw HTML is stored.
 * =============================================================================
 */

import { sanitizeHtml } from "./firecrawl-client";

export interface ExtractedContent {
  title?: string;
  description?: string;
  h1?: string;
  keywords: string[];
  navigation: NavLink[];
  footer: string;
  contactEmails: string[];
  supportEmail?: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  socialLinks: SocialLinks;
  logoUrl?: string;
  heroImageUrl?: string;
  callToAction?: string;
  pricingDetected: boolean;
  trialDetected: boolean;
  freemiumDetected: boolean;
  enterpriseDetected: boolean;
  pricingModel?: string;
  languages: string[];
  contentBlocks: ContentBlock[];
}

export interface NavLink {
  text: string;
  href: string;
}

export interface SocialLinks {
  twitter?: string;
  linkedin?: string;
  github?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  discord?: string;
}

export interface ContentBlock {
  pageType: string;
  blockType: "heading" | "paragraph" | "feature" | "faq";
  heading?: string;
  content: string;
  order: number;
}

export function extractContent(html: string, url: string): ExtractedContent {
  return {
    title: extractTitle(html),
    description: extractDescription(html),
    h1: extractH1(html),
    keywords: extractKeywords(html),
    navigation: extractNavigation(html),
    footer: extractFooter(html),
    contactEmails: extractEmails(html),
    supportEmail: extractSupportEmail(html),
    contactEmail: extractContactEmail(html),
    phone: extractPhone(html),
    address: extractAddress(html),
    socialLinks: extractSocialLinks(html),
    logoUrl: extractLogo(html, url),
    heroImageUrl: extractHeroImage(html, url),
    callToAction: extractCTA(html),
    pricingDetected: detectPricing(html),
    trialDetected: detectTrial(html),
    freemiumDetected: detectFreemium(html),
    enterpriseDetected: detectEnterprise(html),
    pricingModel: detectPricingModel(html),
    languages: extractLanguages(html),
    contentBlocks: extractContentBlocks(html),
  };
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim();
}

function extractDescription(html: string): string | undefined {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  return match?.[1]?.trim();
}

function extractH1(html: string): string | undefined {
  const match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  return match?.[1]?.trim();
}

function extractKeywords(html: string): string[] {
  const match = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);
  if (!match) return [];
  return match[1].split(",").map((k) => k.trim()).filter((k) => k.length > 0).slice(0, 20);
}

function extractNavigation(html: string): NavLink[] {
  const links: NavLink[] = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null && links.length < 50) {
    const href = match[1]!;
    const text = match[2]!.trim();
    if (text && href && !href.startsWith("#") && !href.startsWith("javascript:")) {
      links.push({ text: text.slice(0, 100), href });
    }
  }

  return links;
}

function extractFooter(html: string): string {
  const match = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
  if (!match) return "";
  return sanitizeHtml(match[1]!).replace(/\s+/g, " ").trim().slice(0, 2000);
}

function extractEmails(html: string): string[] {
  const emails = new Set<string>();
  const emailRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  let match: RegExpExecArray | null;
  while ((match = emailRegex.exec(html)) !== null) {
    emails.add(match[1]!.toLowerCase());
  }
  const plainEmailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi;
  while ((match = plainEmailRegex.exec(html)) !== null && emails.size < 10) {
    const email = match[1]!.toLowerCase();
    if (!email.includes("example.com") && !email.includes("sentry") && !email.includes("wixpress")) {
      emails.add(email);
    }
  }
  return Array.from(emails);
}

function extractSupportEmail(html: string): string | undefined {
  const emails = extractEmails(html);
  return emails.find((e) => e.startsWith("support@") || e.startsWith("help@"));
}

function extractContactEmail(html: string): string | undefined {
  const emails = extractEmails(html);
  return emails.find((e) => e.startsWith("contact@") || e.startsWith("hello@") || e.startsWith("info@"));
}

function extractPhone(html: string): string | undefined {
  const match = html.match(/\+?1?\s*\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/);
  return match?.[0];
}

function extractAddress(html: string): string | undefined {
  const match = html.match(/<address[^>]*>([\s\S]*?)<\/address>/i);
  if (!match) return undefined;
  return sanitizeHtml(match[1]!).replace(/\s+/g, " ").trim().slice(0, 300) || undefined;
}

function extractSocialLinks(html: string): SocialLinks {
  const links: SocialLinks = {};
  const patterns: Array<[keyof SocialLinks, RegExp]> = [
    ["twitter", /href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"']+)["']/i],
    ["linkedin", /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/[^"']+)["']/i],
    ["github", /href=["'](https?:\/\/(?:www\.)?github\.com\/[^"']+)["']/i],
    ["facebook", /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"']+)["']/i],
    ["instagram", /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"']+)["']/i],
    ["youtube", /href=["'](https?:\/\/(?:www\.)?youtube\.com\/[^"']+)["']/i],
    ["discord", /href=["'](https?:\/\/(?:www\.)?discord\.(?:com|gg)\/[^"']+)["']/i],
  ];
  for (const [key, pattern] of patterns) {
    const match = html.match(pattern);
    if (match) links[key] = match[1];
  }
  return links;
}

function extractLogo(html: string, baseUrl: string): string | undefined {
  // Try og:image first
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogMatch?.[1]) return resolveUrl(ogMatch[1], baseUrl);

  // Try logo class/alt
  const logoMatch = html.match(/<img[^>]+(?:class=["'][^"']*logo[^"']*["']|alt=["'][^"']*logo[^"']*["'])[^>]+src=["']([^"']+)["']/i);
  if (logoMatch?.[1]) return resolveUrl(logoMatch[1], baseUrl);

  return undefined;
}

function extractHeroImage(html: string, baseUrl: string): string | undefined {
  const match = html.match(/<img[^>]+(?:class=["'][^"']*hero[^"']*["']|class=["'][^"']*banner[^"']*["'])[^>]+src=["']([^"']+)["']/i);
  if (match?.[1]) return resolveUrl(match[1], baseUrl);

  // Try og:image as fallback
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogMatch?.[1]) return resolveUrl(ogMatch[1], baseUrl);

  return undefined;
}

function extractCTA(html: string): string | undefined {
  const patterns = [
    /<a[^>]+(?:class=["'][^"']*cta[^"']*["']|class=["'][^"']*button[^"']*["'])[^>]*>([^<]{3,40})<\/a>/i,
    /<button[^>]*>([^<]{3,40})<\/button>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1] && !/^(sign in|log in|login)$/i.test(match[1].trim())) {
      return match[1].trim();
    }
  }
  return undefined;
}

function detectPricing(html: string): boolean {
  return /pricing|plans?\s*(?:and\s*pricing)?|\$\d+|per\s*month|per\s*month|\/mo\b/i.test(html);
}

function detectTrial(html: string): boolean {
  return /free\s*trial|trial\s*period|start\s*trial|14-day|30-day|7-day/i.test(html);
}

function detectFreemium(html: string): boolean {
  return /free\s*plan|free\s*tier|freemium|free\s*forever/i.test(html);
}

function detectEnterprise(html: string): boolean {
  return /enterprise\s*plan|contact\s*sales|enterprise\s*pricing|custom\s*pricing/i.test(html);
}

function detectPricingModel(html: string): string | undefined {
  if (/per\s*seat|per\s*user/i.test(html)) return "per_user";
  if (/per\s*month|\/mo\b/i.test(html)) return "subscription";
  if (/one-?time|lifetime/i.test(html)) return "one_time";
  if (/usage-?based|pay\s*as\s*you\s*go/i.test(html)) return "usage_based";
  if (detectEnterprise(html)) return "enterprise";
  if (detectPricing(html)) return "subscription";
  return undefined;
}

function extractLanguages(html: string): string[] {
  const languages = new Set<string>();
  const langAttr = html.match(/<html[^>]+lang=["']([a-z]{2}(-[A-Z]{2})?)["']/i);
  if (langAttr) languages.add(langAttr[1]!);

  const altLangRegex = /hreflang=["']([a-z]{2}(-[A-Z]{2})?)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = altLangRegex.exec(html)) !== null) {
    languages.add(match[1]!);
  }

  return Array.from(languages);
}

function extractContentBlocks(html: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let order = 0;

  // Extract headings (h2, h3)
  const headingRegex = /<h[23][^>]*>([^<]+)<\/h[23]>/gi;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(html)) !== null && blocks.length < 20) {
    const heading = match[1]!.trim();
    if (heading.length > 3 && heading.length < 200) {
      blocks.push({
        pageType: "HOMEPAGE",
        blockType: "heading",
        heading,
        content: heading,
        order: order++,
      });
    }
  }

  // Extract paragraphs
  const paraRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((match = paraRegex.exec(html)) !== null && blocks.length < 30) {
    const text = sanitizeHtml(match[1]!).replace(/\s+/g, " ").trim();
    if (text.length > 50 && text.length < 500) {
      blocks.push({
        pageType: "HOMEPAGE",
        blockType: "paragraph",
        content: text,
        order: order++,
      });
    }
  }

  return blocks;
}

function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}
