"use client";

/**
 * Sidebar — collapsible primary navigation.
 *
 * Premium redesign:
 *  - Smoother animations with subtle spring physics
 *  - More refined active state with glow effect
 *  - Better hover states with scale and color transitions
 *  - Section labels with better typography
 *  - Improved collapse toggle
 *  - Better workspace switcher design
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronsLeft, ChevronsRight, Plus } from "lucide-react";
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
        animate={{ width: collapsed ? 64 : 256 }}
        transition={{
          duration: 0.25,
          ease: [0.4, 0, 0.2, 1],
        }}
        className="flex h-full flex-col border-r border-sidebar-border bg-sidebar shrink-0 overflow-hidden relative"
      >
        {/* Workspace switcher */}
        <div className="h-[57px] flex items-center px-3 border-b border-sidebar-border/60 shrink-0">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-sidebar-accent transition-all duration-200 hover:scale-105">
                  <Logo withWordmark={false} size={22} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex items-center gap-2">
                Leadforge · Main workspace
              </TooltipContent>
            </Tooltip>
          ) : (
            <button className="flex-1 flex items-center gap-2.5 px-2 h-9 rounded-lg hover:bg-sidebar-accent transition-all duration-200 group">
              <Logo withWordmark={false} size={22} />
              <div className="flex-1 text-left min-w-0">
                <div className="text-[13px] font-semibold text-sidebar-foreground leading-tight truncate">
                  Leadforge
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight truncate">
                  Main workspace
                </div>
              </div>
              <ChevronsRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 space-y-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="space-y-0.5">
              {!collapsed && (
                <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
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

        {/* Bottom section - collapse toggle */}
        <div className="p-2.5 shrink-0 border-t border-sidebar-border/60">
          <button
            onClick={onToggle}
            className={cn(
              "w-full flex items-center gap-2.5 h-9 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200 text-[13px]",
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

  const activeClass = active
    ? "bg-sidebar-accent text-sidebar-foreground shadow-sm"
    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground";

  const content = (
    <a
      href={routeHref(item.id)}
      className={cn(
        "group relative flex items-center gap-2.5 h-9 rounded-lg text-[13px] font-medium transition-all duration-200",
        collapsed ? "justify-center w-10 mx-auto" : "px-2.5",
        activeClass
      )}
    >
      {active && !collapsed && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-foreground rounded-r-full"
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        />
      )}
      <Icon
        className={cn(
          "w-[17px] h-[17px] shrink-0 transition-all duration-200",
          active ? "text-foreground" : "group-hover:text-foreground"
        )}
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.soon ? (
            <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/50 px-1.5 py-0.5 rounded-md bg-muted/40">
              Soon
            </span>
          ) : item.badge ? (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/90">
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
  if (item === "settings" && current.startsWith("settings.")) return true;
  return false;
}
