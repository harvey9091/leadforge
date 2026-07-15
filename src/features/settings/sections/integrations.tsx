"use client";

import { SettingsSection, SettingsRow } from "../settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Boxes, Sparkles, Database } from "lucide-react";
import Link from "next/link";
import { routeHref, type RouteId } from "@/lib/routes";

const INTEGRATIONS = [
  { name: "Firecrawl", description: "Web scraping for company enrichment.", icon: Globe, status: "configured" },
  { name: "RabbitMQ", description: "Job queue for background workers.", icon: Boxes, status: "pending" },
  { name: "Redis", description: "Cache and rate limiting store.", icon: Database, status: "pending" },
];

export function IntegrationsSection() {
  return (
    <SettingsSection
      title="Integrations"
      description="Connect external services to power the Leadforge pipeline."
    >
      <div className="space-y-2">
        {INTEGRATIONS.map((int) => {
          const Icon = int.icon;
          return (
            <div
              key={int.name}
              className="flex items-center gap-3 px-3 py-3 rounded-md border border-border/60 bg-background/40"
            >
              <div className="w-9 h-9 rounded-md bg-muted/40 flex items-center justify-center text-foreground shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">{int.name}</div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">{int.description}</div>
              </div>
              {int.status === "configured" ? (
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide bg-success/10 text-success border-success/20">Connected</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending</Badge>
              )}
            </div>
          );
        })}

        <Link href={routeHref("settings.freellm" as RouteId)}>
          <div className="flex items-center gap-3 px-3 py-3 rounded-md border border-border/60 bg-background/40 hover:border-primary/40 transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-foreground">FreeLLM API</span>
                <Badge variant="outline" className="text-[9.5px] uppercase tracking-wide font-medium text-primary border-primary/30 bg-primary/5">AI</Badge>
              </div>
              <div className="text-[11.5px] text-muted-foreground mt-0.5">LLM gateway for AI qualification and ICP analysis.</div>
            </div>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">Configure →</Badge>
          </div>
        </Link>
      </div>
    </SettingsSection>
  );
}
