/**
 * =============================================================================
 * Shared Discovery Utilities
 * =============================================================================
 *
 * Common parsing helpers used by multiple discovery source adapters.
 * Eliminates duplicated code across source files.
 * =============================================================================
 */

/**
 * Extract a tag value from XML, handling CDATA sections.
 */
export function extractXmlTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, "i");
  const match = regex.exec(xml);
  if (!match) return undefined;
  return (match[1] ?? match[2] ?? "").trim();
}

/**
 * Extract an attribute value from an XML tag.
 */
export function extractXmlAttr(xml: string, tag: string, attr: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, "i");
  const match = regex.exec(xml);
  return match?.[1];
}

/**
 * Strip HTML tags and decode common HTML entities.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Decode HTML entities in a string.
 */
export function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

/**
 * Escape a string for use in a regular expression.
 */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse an Atom/XML feed into entries.
 */
export interface AtomEntry {
  id: string;
  title: string;
  link: string;
  published: string;
  updated?: string;
  content?: string;
  summary?: string;
  author?: string;
}

export function parseAtomFeed(xml: string): AtomEntry[] {
  const entries: AtomEntry[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1]!;
    const entry: AtomEntry = {
      id: extractXmlTag(block, "id") ?? "",
      title: extractXmlTag(block, "title") ?? "",
      link: extractXmlAttr(block, "link", "href") ?? "",
      published: extractXmlTag(block, "published") ?? "",
      updated: extractXmlTag(block, "updated") ?? undefined,
      content: extractXmlTag(block, "content") ?? extractXmlTag(block, "summary") ?? undefined,
      author: extractXmlTag(block, "name") ?? undefined,
    };
    if (entry.title && entry.link) {
      entries.push(entry);
    }
  }

  return entries;
}
