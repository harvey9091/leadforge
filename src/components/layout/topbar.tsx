"use client";

/**
 * Topbar — the persistent header inside the dashboard shell.
 *
 * Premium redesign:
 *  - Cleaner spacing and typography
 *  - Better search trigger with modern styling
 *  - Refined notification area
 *  - Improved user profile menu
 *  - Subtle backdrop blur
 */

import * as React from "react";
import { motion } from "framer-motion";
import {
  Search,
  Bell,
  Command as CommandIcon,
  ChevronRight,
  Sparkles,
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
    <header className="h-[57px] shrink-0 border-b border-border/60 bg-background/70 backdrop-blur-xl flex items-center gap-3 px-4 lg:px-6 sticky top-0 z-30">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px] min-w-0">
        <span className="text-muted-foreground/70 hidden sm:inline font-medium">
          Leadforge
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 hidden sm:inline" />
        <span className="font-semibold text-foreground truncate">
          {route.title.replace(" — Leadforge", "")}
        </span>
      </div>

      {/* Search */}
      <button
        onClick={() => setOpen(true)}
        className="ml-auto hidden md:flex items-center gap-2.5 h-9 w-64 lg:w-80 px-3 rounded-xl border border-border/80 bg-muted/20 text-[13px] text-muted-foreground hover:bg-muted/40 hover:border-border transition-all duration-200 group"
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground/70 group-hover:text-muted-foreground transition-colors" />
        <span className="flex-1 text-left text-muted-foreground/80 group-hover:text-muted-foreground transition-colors">
          Search anything…
        </span>
        <kbd className="flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-md border border-border/80 bg-background/50 text-muted-foreground/80 group-hover:text-muted-foreground group-hover:bg-background transition-all">
          <CommandIcon className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      <div className="flex items-center gap-1.5 md:ml-0 ml-auto">
        {/* Mobile search */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden w-8 h-8 rounded-lg"
          onClick={() => setOpen(true)}
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-lg relative"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-success ring-2 ring-background" />
        </Button>

        {/* Divider */}
        <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 h-9 px-1 rounded-lg hover:bg-muted/40 transition-all duration-200">
              <Avatar className="w-7 h-7 ring-1 ring-border/60">
                <AvatarFallback className="bg-muted/60 text-[11px] font-semibold text-foreground">
                  {user ? initials(user.name ?? user.email) : "··"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden lg:block text-left">
                <div className="text-[12.5px] font-medium text-foreground leading-tight truncate max-w-[120px]">
                  {user?.name ?? "User"}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-1.5 rounded-xl shadow-premium-lg border-border/60">
            <div className="px-2.5 py-2.5 mb-1">
              <div className="text-[13px] font-semibold text-foreground truncate">
                {user?.name ?? "User"}
              </div>
              <div className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                {user?.email}
              </div>
              {user?.role === "ADMIN" && (
                <Badge
                  variant="secondary"
                  className="mt-2 text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md"
                >
                  Admin
                </Badge>
              )}
            </div>
            <DropdownMenuSeparator className="bg-border/40" />
            <DropdownMenuItem className="text-[13px] cursor-pointer rounded-lg" onClick={() => navigate("/settings/profile")}>
              <UserIcon className="w-3.5 h-3.5 mr-2.5 text-muted-foreground" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-[13px] cursor-pointer rounded-lg" onClick={() => navigate("/settings")}>
              <SettingsIcon className="w-3.5 h-3.5 mr-2.5 text-muted-foreground" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="text-[13px] cursor-pointer rounded-lg">
              <Keyboard className="w-3.5 h-3.5 mr-2.5 text-muted-foreground" />
              Keyboard shortcuts
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/40" />
            <DropdownMenuItem
              className="text-[13px] cursor-pointer text-destructive rounded-lg hover:text-destructive"
              onClick={() => void signOut()}
            >
              <LogOut className="w-3.5 h-3.5 mr-2.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
