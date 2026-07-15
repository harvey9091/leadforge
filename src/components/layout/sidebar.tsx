"use client";

/**
 * Sidebar — collapsible primary navigation.
 *
 * Design intent:
 *  - Default expanded (240px) on desktop, icon-only (60px) when collapsed.
 *  - Hover reveals labels in collapsed mode via tooltip.
 *  - Active item is indicated by a subtle accent background + left bar.
 *  - Section labels disappear in collapsed mode for visual quiet.
 *  - Footer holds the user profile menu + a collapse toggle.
 *
 * Animations are 150ms ease — fast enough to feel snappy, slow enough to
 * be visible. No spring physics, no bounce — Linear-style restraint.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NAV_SECTIONS, type NavItem } from "@/components/layout/nav-config";
import { routeHref, type RouteId } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useHashRoute } from "@/hooks/use-hash-route";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const route = useHashRoute();

  return (
    <TooltipProvider delayDuration={collapsed ? 300 : 99999} skipDelayDuration={200}>
      <motion.aside
        animate={{ width: collapsed ? 60 : 248 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        className="flex h-full flex-col border-r border-border bg-sidebar shrink-0 overflow-hidden"
      >
        {/* Workspace switcher */}
        <div className="h-14 flex items-center px-3 border-b border-sidebar-border shrink-0">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-sidebar-accent transition-colors">
                  <Logo withWordmark={false} size={22} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Leadforge · Main workspace</TooltipContent>
            </Tooltip>
          ) : (
            <button className="flex-1 flex items-center gap-2.5 px-1.5 h-9 rounded-md hover:bg-sidebar-accent transition-colors group">
              <Logo withWordmark={false} size={22} />
              <div className="flex-1 text-left min-w-0">
                <div className="text-[13px] font-semibold text-sidebar-foreground leading-tight truncate">
                  Leadforge
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight truncate">
                  Main workspace
                </div>
              </div>
              <ChevronsRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="space-y-0.5">
              {!collapsed && (
                <div className="px-2 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
                  {section.label}
                </div>
              )}
              {section.items.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  active={isActive(route.id, item.id)}
                  collapsed={collapsed}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-sidebar-border p-2 shrink-0">
          <button
            onClick={onToggle}
            className={cn(
              "w-full flex items-center gap-2.5 h-9 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors text-[13px]",
              collapsed ? "justify-center" : "justify-start px-2.5"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronsLeft className="w-4 h-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

function SidebarItem({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const content = (
    <a
      href={routeHref(item.id)}
      className={cn(
        "group relative flex items-center gap-2.5 h-9 rounded-md text-[13px] font-medium transition-colors",
        collapsed ? "justify-center w-9 mx-auto" : "px-2.5",
        active
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      )}
    >
      {active && !collapsed && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-foreground rounded-r-full"
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        />
      )}
      <Icon className={cn("w-[17px] h-[17px] shrink-0", active && "text-foreground")} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.soon ? (
            <span className="text-[9.5px] uppercase font-semibold tracking-wide text-muted-foreground/60 px-1.5 py-0.5 rounded bg-muted/60">
              Soon
            </span>
          ) : item.badge ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-foreground/8 text-foreground">
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </a>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {item.label}
          {item.shortcut && (
            <kbd className="text-[10px] text-muted-foreground">{item.shortcut}</kbd>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }
  return content;
}

function isActive(current: RouteId, item: RouteId): boolean {
  if (current === item) return true;
  // Settings sub-routes should highlight the settings parent.
  if (item === "settings" && current.startsWith("settings.")) return true;
  return false;
}
