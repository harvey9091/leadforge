"use client";

/**
 * AppShell — the dashboard layout wrapper.
 *
 * Layout:
 *  ┌─────────┬───────────────────────────────┐
 *  │         │ Topbar                         │
 *  │ Sidebar ├───────────────────────────────┤
 *  │         │ <main> page content </main>    │
 *  │         │                                │
 *  └─────────┴───────────────────────────────┘
 *
 * Sidebar collapse state is persisted in localStorage so it survives
 * reloads. The collapsed width on mobile is handled by hiding the sidebar
 * entirely and using a Sheet (drawer).
 */

import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

const SIDEBAR_KEY = "lf:sidebar:collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);

  // Hydrate from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);

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
