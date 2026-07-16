"use client";

/**
 * Command palette (⌘K) — central navigation, search, and quick action hub.
 *
 * Premium redesign:
 *  - Better dialog styling
 *  - Refined item spacing
 *  - Better visual hierarchy
 */

import * as React from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useCommandPalette } from "@/components/layout/command-palette-store";
import { ALL_NAV_ITEMS } from "@/components/layout/nav-config";
import { routeHref, type RouteId } from "@/lib/routes";
import { navigate } from "@/hooks/use-hash-route";
import { useTheme } from "next-themes";
import {
  Building2,
  Users2,
  Sun,
  Moon,
  Settings,
  Plus,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

export function CommandPalette() {
  const open = useCommandPalette((s) => s.open);
  const setOpen = useCommandPalette((s) => s.setOpen);
  const { theme, setTheme } = useTheme();

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  const go = (id: RouteId) => {
    navigate(routeHref(id));
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, leads, companies, actions…" />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {ALL_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.id}
                value={`${item.label} navigate ${item.shortcut ?? ""}`}
                onSelect={() => go(item.id)}
                className="text-[13px]"
              >
                <Icon className="w-4 h-4 mr-2.5 text-muted-foreground" />
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <kbd className="text-[10px] text-muted-foreground font-mono">
                    {item.shortcut}
                  </kbd>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick actions">
          <CommandItem
            value="new lead create add"
            onSelect={() => go("leads")}
            className="text-[13px]"
          >
            <Plus className="w-4 h-4 mr-2.5 text-muted-foreground" />
            Create new lead
          </CommandItem>
          <CommandItem
            value="search companies"
            onSelect={() => go("companies")}
            className="text-[13px]"
          >
            <Building2 className="w-4 h-4 mr-2.5 text-muted-foreground" />
            Search companies
            <ArrowRight className="w-3.5 h-3.5 ml-auto text-muted-foreground/60" />
          </CommandItem>
          <CommandItem
            value="search leads"
            onSelect={() => go("leads")}
            className="text-[13px]"
          >
            <Users2 className="w-4 h-4 mr-2.5 text-muted-foreground" />
            Search leads
            <ArrowRight className="w-3.5 h-3.5 ml-auto text-muted-foreground/60" />
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem
            value="theme dark"
            onSelect={() => setTheme("dark")}
            className="text-[13px]"
          >
            <Moon className="w-4 h-4 mr-2.5 text-muted-foreground" />
            Switch to dark theme
            {theme === "dark" && <span className="ml-auto text-[10px] text-muted-foreground">Active</span>}
          </CommandItem>
          <CommandItem
            value="theme light"
            onSelect={() => setTheme("light")}
            className="text-[13px]"
          >
            <Sun className="w-4 h-4 mr-2.5 text-muted-foreground" />
            Switch to light theme
            {theme === "light" && <span className="ml-auto text-[10px] text-muted-foreground">Active</span>}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          <CommandItem
            value="settings general profile api-keys"
            onSelect={() => go("settings")}
            className="text-[13px]"
          >
            <Settings className="w-4 h-4 mr-2.5 text-muted-foreground" />
            Open settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
