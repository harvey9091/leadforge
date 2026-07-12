import { describe, it, expect } from "vitest";
import { detectTechnologies, TECHNOLOGY_RULES } from "@/server/enrichment/technologies/detector";

describe("technology detector", () => {
  it("has 50+ technology rules", () => {
    expect(TECHNOLOGY_RULES.length).toBeGreaterThan(50);
  });

  it("each rule has required fields", () => {
    for (const rule of TECHNOLOGY_RULES) {
      expect(rule.name).toBeTruthy();
      expect(rule.slug).toBeTruthy();
      expect(rule.category).toBeTruthy();
      expect(rule.patterns.length).toBeGreaterThan(0);
    }
  });

  it("detects React", () => {
    const html = '<div id="root" data-reactroot></div><script src="react.production.min.js"></script>';
    const detected = detectTechnologies(html);
    expect(detected.find((t) => t.slug === "react")).toBeDefined();
  });

  it("detects Next.js", () => {
    const html = '<script>window.__NEXT_DATA__ = {};</script>';
    const detected = detectTechnologies(html);
    expect(detected.find((t) => t.slug === "nextjs")).toBeDefined();
  });

  it("detects Vercel", () => {
    const html = '<meta name="x-vercel-id" content="abc">';
    const detected = detectTechnologies(html);
    expect(detected.find((t) => t.slug === "vercel")).toBeDefined();
  });

  it("detects Stripe", () => {
    const html = '<script src="https://js.stripe.com/v3/"></script>';
    const detected = detectTechnologies(html);
    expect(detected.find((t) => t.slug === "stripe")).toBeDefined();
  });

  it("detects Google Analytics", () => {
    const html = '<script>gtag("config", "G-ABCDEF1234");</script>';
    const detected = detectTechnologies(html);
    expect(detected.find((t) => t.slug === "google-analytics")).toBeDefined();
  });

  it("detects multiple technologies at once", () => {
    const html = `
      <script>window.__NEXT_DATA__ = {};</script>
      <script src="https://js.stripe.com/v3/"></script>
      <link rel="stylesheet" href="tailwind.css">
      <script src="https://js.sentry-cdn.com/abc.js"></script>
    `;
    const detected = detectTechnologies(html);
    const slugs = detected.map((t) => t.slug);
    expect(slugs).toContain("nextjs");
    expect(slugs).toContain("stripe");
    expect(slugs).toContain("tailwind");
    expect(slugs).toContain("sentry");
  });

  it("returns empty array for plain HTML", () => {
    const html = "<html><body><h1>Hello</h1></body></html>";
    const detected = detectTechnologies(html);
    expect(detected).toEqual([]);
  });

  it("all slugs are unique", () => {
    const slugs = TECHNOLOGY_RULES.map((r) => r.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it("covers all required technology categories", () => {
    const categories = new Set(TECHNOLOGY_RULES.map((r) => r.category));
    expect(categories.has("frontend")).toBe(true);
    expect(categories.has("backend")).toBe(true);
    expect(categories.has("hosting")).toBe(true);
    expect(categories.has("analytics")).toBe(true);
    expect(categories.has("payments")).toBe(true);
    expect(categories.has("auth")).toBe(true);
    expect(categories.has("monitoring")).toBe(true);
    expect(categories.has("support")).toBe(true);
  });
});
