"use client";

/**
 * AppShell — the dashboard layout wrapper.
 *
 * Premium redesign:
 *  - Cleaner spacing and proportions
 *  - Better handling of sidebar collapse state
 *  - Improved mobile experience
 */

import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

const SIDEBAR_KEY = "lf:sidebar:collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(SIDEBAR_KEY);
    return stored === "1";
  });

  const toggle = React.useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  useKeyboardShortcuts({ onToggleSidebar: toggle });

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onToggleSidebar={toggle} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
