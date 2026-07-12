import { describe, it, expect } from "vitest";
import { extractContent } from "@/server/enrichment/content-extractor";

describe("content extractor", () => {
  it("extracts title", () => {
    const html = "<html><head><title>Acme — Best Tool</title></head><body></body></html>";
    const content = extractContent(html, "https://acme.com");
    expect(content.title).toBe("Acme — Best Tool");
  });

  it("extracts meta description", () => {
    const html = '<html><head><meta name="description" content="The best tool for the job"></head></html>';
    const content = extractContent(html, "https://acme.com");
    expect(content.description).toBe("The best tool for the job");
  });

  it("extracts og:description as fallback", () => {
    const html = '<html><head><meta property="og:description" content="Open Graph desc"></head></html>';
    const content = extractContent(html, "https://acme.com");
    expect(content.description).toBe("Open Graph desc");
  });

  it("extracts H1", () => {
    const html = "<html><body><h1>Welcome to Acme</h1></body></html>";
    const content = extractContent(html, "https://acme.com");
    expect(content.h1).toBe("Welcome to Acme");
  });

  it("extracts emails from mailto links", () => {
    const html = '<html><body><a href="mailto:hello@acme.com">Contact</a></body></html>';
    const content = extractContent(html, "https://acme.com");
    expect(content.contactEmails).toContain("hello@acme.com");
  });

  it("extracts support email", () => {
    const html = '<html><body><a href="mailto:support@acme.com">Support</a></body></html>';
    const content = extractContent(html, "https://acme.com");
    expect(content.supportEmail).toBe("support@acme.com");
  });

  it("extracts social links", () => {
    const html = `
      <a href="https://twitter.com/acme">Twitter</a>
      <a href="https://linkedin.com/company/acme">LinkedIn</a>
      <a href="https://github.com/acme">GitHub</a>
    `;
    const content = extractContent(html, "https://acme.com");
    expect(content.socialLinks.twitter).toBe("https://twitter.com/acme");
    expect(content.socialLinks.linkedin).toBe("https://linkedin.com/company/acme");
    expect(content.socialLinks.github).toBe("https://github.com/acme");
  });

  it("detects pricing", () => {
    const html = '<html><body><a href="/pricing">Pricing</a>$29 per month</body></html>';
    const content = extractContent(html, "https://acme.com");
    expect(content.pricingDetected).toBe(true);
  });

  it("detects trial", () => {
    const html = "<html><body>Start your 14-day free trial</body></html>";
    const content = extractContent(html, "https://acme.com");
    expect(content.trialDetected).toBe(true);
  });

  it("detects enterprise", () => {
    const html = "<html><body>Contact sales for enterprise pricing</body></html>";
    const content = extractContent(html, "https://acme.com");
    expect(content.enterpriseDetected).toBe(true);
  });

  it("extracts languages from html lang attribute", () => {
    const html = '<html lang="en-US"><body></body></html>';
    const content = extractContent(html, "https://acme.com");
    expect(content.languages).toContain("en-US");
  });

  it("extracts content blocks (headings + paragraphs)", () => {
    const html = `
      <html><body>
        <h2>Features</h2>
        <p>Our product has amazing features that you will love.</p>
        <h3>Pricing</h3>
        <p>Start at just $10 per month.</p>
      </body></html>
    `;
    const content = extractContent(html, "https://acme.com");
    expect(content.contentBlocks.length).toBeGreaterThan(0);
    const headings = content.contentBlocks.filter((b) => b.blockType === "heading");
    expect(headings.length).toBeGreaterThan(0);
  });

  it("extracts logo from og:image", () => {
    const html = '<html><head><meta property="og:image" content="https://acme.com/logo.png"></head></html>';
    const content = extractContent(html, "https://acme.com");
    expect(content.logoUrl).toBe("https://acme.com/logo.png");
  });

  it("handles empty HTML gracefully", () => {
    const content = extractContent("", "https://acme.com");
    expect(content.title).toBeUndefined();
    expect(content.contactEmails).toEqual([]);
    expect(content.pricingDetected).toBe(false);
  });
});
