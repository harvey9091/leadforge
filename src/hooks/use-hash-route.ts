"use client";

import * as React from "react";
import { resolveRoute, type RouteMeta } from "@/lib/routes";

/**
 * useHashRoute — a tiny hash-based router.
 *
 * Because the host environment only exposes a single Next.js route (`/`),
 * all internal navigation is encoded in the URL hash. This keeps views
 * shareable, supports back/forward, and requires no server config.
 *
 * Migrating to App Router multi-route in Phase 2 is a mechanical rename —
 * view components are already self-contained.
 */
export function useHashRoute(): RouteMeta {
  const [route, setRoute] = React.useState<RouteMeta>(() =>
    resolveRoute(typeof window !== "undefined" ? window.location.hash : "")
  );

  React.useEffect(() => {
    const onChange = () => {
      setRoute(resolveRoute(window.location.hash));
      // Scroll to top on every navigation — feels more app-like.
      window.scrollTo({ top: 0, behavior: "auto" });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}

/**
 * navigate — imperative navigation helper.
 */
export function navigate(path: string) {
  if (!path.startsWith("#")) path = `#${path}`;
  if (window.location.hash === path) return;
  window.location.hash = path;
}
