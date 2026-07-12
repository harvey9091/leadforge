/**
 * =============================================================================
 * Leadforge — Test Setup
 * =============================================================================
 *
 * Shared setup for all test suites. Configures:
 *  - DOM environment (jsdom) for component tests
 *  - Path aliases (@/ → src/)
 *  - Global mocks (IntersectionObserver, matchMedia, etc.)
 *  - Cleanup after each test
 * =============================================================================
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Auto-cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock IntersectionObserver (required by radix-ui scroll areas)
beforeAll(() => {
  if (typeof window !== "undefined") {
    window.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn().mockReturnValue([]),
    })) as unknown as IntersectionObserver;

    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as MediaQueryList;

    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  }
});
