/**
 * Navigation config — single source of truth for the sidebar, command
 * palette, keyboard shortcuts, and breadcrumb generation.
 */

import {
  LayoutDashboard,
  Compass,
  Zap,
  Radio,
  Users2,
  Building2,
  Contact2,
  BarChart3,
  Sparkles,
  Activity,
  Settings,
  KeyRound,
  Server,
  type LucideIcon,
} from "lucide-react";
import type { RouteId } from "@/lib/routes";

export interface NavItem {
  id: RouteId;
  label: string;
  icon: LucideIcon;
  /** Optional keyboard shortcut. */
  shortcut?: string;
  /** Optional badge text — used for counts/new indicators. */
  badge?: string;
  /** Phase 2 features show a "soon" indicator instead of being hidden. */
  soon?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        shortcut: "G D",
      },
      {
        id: "discover",
        label: "Discover",
        icon: Compass,
        shortcut: "G V",
        badge: "New",
      },
      {
        id: "enrich",
        label: "Enrich",
        icon: Zap,
        shortcut: "G E",
        badge: "New",
      },
      {
        id: "leads",
        label: "Leads",
        icon: Users2,
        shortcut: "G L",
      },
      {
        id: "companies",
        label: "Companies",
        icon: Building2,
        shortcut: "G C",
      },
      {
        id: "people",
        label: "People",
        icon: Contact2,
        shortcut: "G P",
      },
    ],
  },
  {
    label: "Outreach",
    items: [
      {
        id: "analytics",
        label: "Analytics",
        icon: BarChart3,
        shortcut: "G A",
      },
      {
        id: "ai-insights",
        label: "AI Insights",
        icon: Sparkles,
        shortcut: "G I",
        soon: true,
      },
      {
        id: "feed",
        label: "Feed",
        icon: Radio,
        shortcut: "G F",
        badge: "New",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        id: "system",
        label: "System",
        icon: Activity,
        shortcut: "G S",
      },
      {
        id: "settings",
        label: "Settings",
        icon: Settings,
        shortcut: "G ,",
      },
    ],
  },
];

/** Flatten all nav items for command palette search. */
export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export const SETTINGS_SUBNAV: NavItem[] = [
  { id: "settings.general", label: "General", icon: Settings },
  { id: "settings.profile", label: "Profile", icon: Contact2 },
  { id: "settings.appearance", label: "Appearance", icon: BarChart3 },
  { id: "settings.api-keys", label: "API Keys", icon: KeyRound },
  { id: "settings.infrastructure", label: "Infrastructure", icon: Server },
  { id: "settings.integrations", label: "Integrations", icon: Sparkles, soon: true },
  { id: "settings.freellm", label: "FreeLLM", icon: Sparkles },
  { id: "settings.workers", label: "Workers", icon: Activity, soon: true },
  { id: "settings.system", label: "System", icon: Activity },
];
