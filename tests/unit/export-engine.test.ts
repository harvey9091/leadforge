import { describe, it, expect } from "vitest";
import {
  getDefaultColumns,
  getExportPreset,
  getAvailablePresets,
  escapeCSV,
  type ExportColumn,
} from "@/server/workspace/export/export-engine";

describe("export engine", () => {
  it("returns default columns", () => {
    const columns = getDefaultColumns();
    expect(columns.length).toBeGreaterThan(10);
    expect(columns.find((c) => c.field === "name")).toBeDefined();
    expect(columns.find((c) => c.field === "domain")).toBeDefined();
  });

  it("returns preset columns", () => {
    const lightreach = getExportPreset("lightreach");
    expect(lightreach).not.toBeNull();
    expect(lightreach!.find((c) => c.field === "name")).toBeDefined();

    const clay = getExportPreset("clay");
    expect(clay).not.toBeNull();

    const apollo = getExportPreset("apollo");
    expect(apollo).not.toBeNull();
  });

  it("returns null for unknown preset", () => {
    expect(getExportPreset("unknown")).toBeNull();
  });

  it("returns available presets", () => {
    const presets = getAvailablePresets();
    expect(presets.length).toBeGreaterThanOrEqual(4);
    expect(presets.find((p) => p.name === "lightreach")).toBeDefined();
    expect(presets.find((p) => p.name === "clay")).toBeDefined();
    expect(presets.find((p) => p.name === "apollo")).toBeDefined();
    expect(presets.find((p) => p.name === "hubspot")).toBeDefined();
  });
});

describe("escapeCSV", () => {
  it("passes through simple values", () => {
    expect(escapeCSV("hello")).toBe("hello");
  });

  it("quotes values with commas", () => {
    expect(escapeCSV("hello, world")).toBe('"hello, world"');
  });

  it("quotes values with quotes (and escapes them)", () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes values with newlines", () => {
    expect(escapeCSV("line1\nline2")).toBe('"line1\nline2"');
  });
});
