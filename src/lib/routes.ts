/**
 * Application route definitions.
 *
 * The application is a single-route SPA (only `/` is exposed by the host
 * environment). Internal navigation uses hash-based routing (`#/dashboard`,
 * `#/leads`, etc.) so views are shareable and back/forward works naturally.
 *
 * In Phase 2+, when the project is deployed via Docker Compose with a real
 * reverse proxy, this can be migrated to Next.js App Router multi-route
 * navigation without touching the view components.
 */

export type RouteId =
  | "landing"
  | "login"
  | "register"
  | "forgot-password"
  | "dashboard"
  | "discover"
  | "enrich"
  | "leads"
  | "companies"
  | "company"
  | "compare"
  | "people"
  | "analytics"
  | "ai-insights"
  | "feed"
  | "system"
  | "settings"
  | "settings.general"
  | "settings.profile"
  | "settings.appearance"
  | "settings.api-keys"
  | "settings.integrations"
  | "settings.workers"
  | "settings.system"
  | "404";

export interface RouteMeta {
  id: RouteId;
  /** Hash path (without the leading #) */
  path: string;
  title: string;
  description: string;
  /** True for routes that require authentication */
  protected: boolean;
  /** True for routes that use the dashboard shell (sidebar + topbar) */
  shell: boolean;
}

export const ROUTES: Record<RouteId, RouteMeta> = {
  landing: {
    id: "landing",
    path: "/",
    title: "Leadforge",
    description: "Self-hosted lead intelligence platform.",
    protected: false,
    shell: false,
  },
  login: {
    id: "login",
    path: "/login",
    title: "Sign in — Leadforge",
    description: "Sign in to your workspace.",
    protected: false,
    shell: false,
  },
  register: {
    id: "register",
    path: "/register",
    title: "Create account — Leadforge",
    description: "Create a new workspace account.",
    protected: false,
    shell: false,
  },
  "forgot-password": {
    id: "forgot-password",
    path: "/forgot-password",
    title: "Reset password — Leadforge",
    description: "Send a password reset link.",
    protected: false,
    shell: false,
  },
  dashboard: {
    id: "dashboard",
    path: "/dashboard",
    title: "Dashboard — Leadforge",
    description: "Overview of pipeline, activity and signal.",
    protected: true,
    shell: true,
  },
  discover: {
    id: "discover",
    path: "/discover",
    title: "Discover — Leadforge",
    description: "Create and manage discovery jobs.",
    protected: true,
    shell: true,
  },
  enrich: {
    id: "enrich",
    path: "/enrich",
    title: "Enrich — Leadforge",
    description: "Enrich companies with website data via Firecrawl.",
    protected: true,
    shell: true,
  },
  leads: {
    id: "leads",
    path: "/leads",
    title: "Leads — Leadforge",
    description: "Qualified companies and people in your pipeline.",
    protected: true,
    shell: true,
  },
  companies: {
    id: "companies",
    path: "/companies",
    title: "Companies — Leadforge",
    description: "Every discovered company in the database.",
    protected: true,
    shell: true,
  },
  company: {
    id: "company",
    path: "/company",
    title: "Company — Leadforge",
    description: "Company detail workspace.",
    protected: true,
    shell: true,
  },
  compare: {
    id: "compare",
    path: "/compare",
    title: "Compare — Leadforge",
    description: "Compare companies side-by-side.",
    protected: true,
    shell: true,
  },
   people: {
     id: "people",
     path: "/people",
     title: "People — Leadforge",
     description: "Contacts discovered and verified.",
     protected: true,
     shell: true,
   },
   analytics: {
    id: "analytics",
    path: "/analytics",
    title: "Analytics — Leadforge",
    description: "Performance, funnel and source analytics.",
    protected: true,
    shell: true,
  },
  "ai-insights": {
    id: "ai-insights",
    path: "/ai-insights",
    title: "AI Insights — Leadforge",
    description: "ICP fit, scoring and qualification signals.",
    protected: true,
    shell: true,
  },
  feed: {
    id: "feed",
    path: "/feed",
    title: "Intelligence Feed — Leadforge",
    description: "Live feed of signals and opportunities.",
    protected: true,
    shell: true,
  },
  system: {
    id: "system",
    path: "/system",
    title: "System — Leadforge",
    description: "Infrastructure, workers and queue health.",
    protected: true,
    shell: true,
  },
  settings: {
    id: "settings",
    path: "/settings",
    title: "Settings — Leadforge",
    description: "Workspace and account settings.",
    protected: true,
    shell: true,
  },
  "settings.general": {
    id: "settings.general",
    path: "/settings/general",
    title: "General — Leadforge",
    description: "Workspace general settings.",
    protected: true,
    shell: true,
  },
  "settings.profile": {
    id: "settings.profile",
    path: "/settings/profile",
    title: "Profile — Leadforge",
    description: "Your profile and preferences.",
    protected: true,
    shell: true,
  },
  "settings.appearance": {
    id: "settings.appearance",
    path: "/settings/appearance",
    title: "Appearance — Leadforge",
    description: "Theme, density and typography.",
    protected: true,
    shell: true,
  },
  "settings.api-keys": {
    id: "settings.api-keys",
    path: "/settings/api-keys",
    title: "API Keys — Leadforge",
    description: "Manage API keys for programmatic access.",
    protected: true,
    shell: true,
  },
  "settings.integrations": {
    id: "settings.integrations",
    path: "/settings/integrations",
    title: "Integrations — Leadforge",
    description: "Connect external services.",
    protected: true,
    shell: true,
  },
  "settings.workers": {
    id: "settings.workers",
    path: "/settings/workers",
    title: "Workers — Leadforge",
    description: "Configure background workers.",
    protected: true,
    shell: true,
  },
  "settings.system": {
    id: "settings.system",
    path: "/settings/system",
    title: "System — Leadforge",
    description: "System-wide configuration.",
    protected: true,
    shell: true,
  },
  "404": {
    id: "404",
    path: "/404",
    title: "Not found — Leadforge",
    description: "The page you are looking for does not exist.",
    protected: false,
    shell: false,
  },
};

/** Route lookup by hash path. */
const PATH_TO_ROUTE = new Map<string, RouteMeta>(
  Object.values(ROUTES).map((r) => [r.path, r])
);

/** Resolve a hash string (e.g. "#/dashboard") to a route. */
export function resolveRoute(hash: string): RouteMeta {
  const path = hash.replace(/^#/, "").split("?")[0] || "/";
  const exact = PATH_TO_ROUTE.get(path);
  if (exact) return exact;

  // Fuzzy match for nested settings paths
  if (path.startsWith("/settings/")) {
    const sub = path.split("/")[2];
    const key = `settings.${sub}` as RouteId;
    if (ROUTES[key]) return ROUTES[key];
  }

  // Company detail: /company/:id
  if (path.startsWith("/company/")) {
    return ROUTES["company"];
  }

  return ROUTES["404"];
}

/** Build a navigation href (with leading #) for a route id. */
export function routeHref(id: RouteId): string {
  return `#${ROUTES[id].path}`;
}

/** Extract the company ID from a /company/:id hash path. */
export function getCompanyIdFromHash(hash: string): string | null {
  const path = hash.replace(/^#/, "").split("?")[0];
  const match = path.match(/^\/company\/(.+)$/);
  return match?.[1] ?? null;
}
