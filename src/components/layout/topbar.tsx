"use client";

/**
 * Topbar — the persistent header inside the dashboard shell.
 *
 * Contains:
 *  - Breadcrumb / current page title
 *  - Global search trigger (opens command palette)
 *  - Quick actions
 *  - Theme toggle
 *  - Notifications dropdown (placeholder)
 *  - User profile menu
 *
 * Designed to be sticky and visually quiet — it should disappear into the
 * background until the user needs it.
 */

import * as React from "react";
import { motion } from "framer-motion";
import {
  Search,
  Bell,
  Command as CommandIcon,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useHashRoute } from "@/hooks/use-hash-route";
import { useAuth } from "@/components/providers/auth-provider";
import { useCommandPalette } from "@/components/layout/command-palette-store";
import { initials } from "@/lib/utils";
import { navigate } from "@/hooks/use-hash-route";
import {
  User as UserIcon,
  Settings as SettingsIcon,
  LogOut,
  Keyboard,
} from "lucide-react";

interface TopbarProps {
  onToggleSidebar: () => void;
}

export function Topbar({ onToggleSidebar: _onToggleSidebar }: TopbarProps) {
  const route = useHashRoute();
  const { user, signOut } = useAuth();
  const setOpen = useCommandPalette((s) => s.setOpen);

  return (
    <header className="h-14 shrink-0 border-b border-border bg-background/80 backdrop-blur-xl flex items-center gap-3 px-4 lg:px-6 sticky top-0 z-30">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px] min-w-0">
        <span className="text-muted-foreground hidden sm:inline">Leadforge</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 hidden sm:inline" />
        <span className="font-medium text-foreground truncate">
          {route.title.replace(" — Leadforge", "")}
        </span>
      </div>

      {/* Search */}
      <button
        onClick={() => setOpen(true)}
        className="ml-auto hidden md:flex items-center gap-2 h-8 w-64 lg:w-72 px-3 rounded-md border border-border bg-muted/30 text-[13px] text-muted-foreground hover:bg-muted/60 hover:border-border/80 transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-background">
          <CommandIcon className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      <div className="flex items-center gap-1.5 md:ml-0 ml-auto">
        {/* Mobile search */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden w-8 h-8"
          onClick={() => setOpen(true)}
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </Button>

        {/* Quick action */}
        <Button variant="ghost" size="icon" className="w-8 h-8 relative" aria-label="Notifications">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-success" />
        </Button>

        {/* Divider */}
        <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 h-8 px-1 rounded-md hover:bg-muted/60 transition-colors">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-muted text-[11px] font-medium text-foreground">
                  {user ? initials(user.name ?? user.email) : "··"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 p-1.5">
            <div className="px-2.5 py-2 mb-1 border-b border-border">
              <div className="text-[13px] font-medium text-foreground truncate">
                {user?.name ?? "User"}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {user?.email}
              </div>
              {user?.role === "ADMIN" && (
                <Badge variant="secondary" className="mt-1.5 text-[9.5px] uppercase tracking-wide font-semibold">
                  Admin
                </Badge>
              )}
            </div>
            <DropdownMenuItem className="text-[13px] cursor-pointer" onClick={() => navigate("/settings/profile")}>
              <UserIcon className="w-3.5 h-3.5 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-[13px] cursor-pointer" onClick={() => navigate("/settings")}>
              <SettingsIcon className="w-3.5 h-3.5 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="text-[13px] cursor-pointer">
              <Keyboard className="w-3.5 h-3.5 mr-2" />
              Keyboard shortcuts
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[13px] cursor-pointer text-destructive hover:text-destructive"
              onClick={() => void signOut()}
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
