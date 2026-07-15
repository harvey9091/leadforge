"use client";

/**
 * Global keyboard shortcuts.
 *
 * Conventions:
 *  - ⌘/Ctrl + K → Command palette
 *  - G then D/L/C/P/M/A/S/, → Navigation (Linear-style "double tap")
 *  - ⌘/Ctrl + B → Toggle sidebar
 *  - ? → Show keyboard shortcuts help (Phase 2)
 *
 * The "G" prefix is implemented with a 600ms timeout — press G, then the
 * next key within 600ms to navigate. This is the same pattern Linear uses.
 */

import * as React from "react";
import { navigate } from "@/hooks/use-hash-route";
import { useCommandPalette } from "@/components/layout/command-palette-store";
import type { RouteId } from "@/lib/routes";

const G_MAP: Record<string, RouteId> = {
  d: "dashboard",
  v: "discover",
  e: "enrich",
  l: "leads",
  c: "companies",
  p: "people",
  a: "analytics",
  i: "ai-insights",
  s: "system",
  ",": "settings",
};

export function useKeyboardShortcuts(opts: {
  onToggleSidebar: () => void;
}) {
  const { onToggleSidebar } = opts;
  const setOpen = useCommandPalette((s) => s.setOpen);
  const gPressed = React.useRef<number | null>(null);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs / contenteditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      // ⌘K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        return; // handled by command palette
      }

      // ⌘B / Ctrl+B → toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        onToggleSidebar();
        return;
      }

      const key = e.key.toLowerCase();

      // G prefix
      if (key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        gPressed.current = window.setTimeout(() => {
          gPressed.current = null;
        }, 600);
        return;
      }

      if (gPressed.current) {
        window.clearTimeout(gPressed.current);
        gPressed.current = null;
        const route = G_MAP[key];
        if (route) {
          e.preventDefault();
          navigate(`#${route === "settings" ? "/settings" : `/${route === "dashboard" ? "dashboard" : route}`}`);
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onToggleSidebar, setOpen]);
}
