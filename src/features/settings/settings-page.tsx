"use client";

/**
 * Settings page — wraps a sub-navigation layout with multiple sections.
 *
 * Premium redesign:
 *  - Cleaner sub-navigation with better spacing
 *  - Better visual hierarchy
 *  - More refined card layout
 */

import * as React from "react";
import { useHashRoute } from "@/hooks/use-hash-route";
import { PageHeader } from "@/components/common/page-header";
import { SETTINGS_SUBNAV } from "@/components/layout/nav-config";
import { routeHref, type RouteId } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { GeneralSection } from "@/features/settings/sections/general";
import { ProfileSection } from "@/features/settings/sections/profile";
import { AppearanceSection } from "@/features/settings/sections/appearance";
import { ApiKeysSection } from "@/features/settings/sections/api-keys";
import { IntegrationsSection } from "@/features/settings/sections/integrations";
import { WorkersSection } from "@/features/settings/sections/workers";
import { SystemSection } from "@/features/settings/sections/system";

export function SettingsPage() {
  const route = useHashRoute();
  const activeId = route.id as RouteId;

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      <PageHeader
        title="Settings"
        description="Manage your workspace, profile, integrations, and system configuration."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-8">
        {/* Sub-navigation */}
        <nav className="space-y-0.5 lg:sticky lg:top-20 lg:self-start">
          {SETTINGS_SUBNAV.map((item) => {
            const Icon = item.icon;
            const active = activeId === item.id;
            return (
              <a
                key={item.id}
                href={routeHref(item.id)}
                className={cn(
                  "flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[13px] font-medium transition-all duration-200",
                  active
                    ? "bg-muted text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1">{item.label}</span>
                {item.soon && (
                  <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/50">
                    Soon
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Section content */}
        <div className="min-w-0 space-y-4">
          {activeId === "settings.general" && <GeneralSection />}
          {activeId === "settings.profile" && <ProfileSection />}
          {activeId === "settings.appearance" && <AppearanceSection />}
          {activeId === "settings.api-keys" && <ApiKeysSection />}
          {activeId === "settings.integrations" && <IntegrationsSection />}
          {activeId === "settings.workers" && <WorkersSection />}
          {activeId === "settings.system" && <SystemSection />}
          {(activeId === "settings" || !activeId.startsWith("settings.")) && <GeneralSection />}
        </div>
      </div>
    </div>
  );
}
