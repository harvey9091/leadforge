"use client";

import { SettingsSection, SettingsRow } from "../settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Boxes, Sparkles, Mail, Database } from "lucide-react";

const INTEGRATIONS = [
  { name: "Firecrawl", description: "Web scraping for company enrichment.", icon: Globe, status: "configured", phase: "Phase 2" },
  { name: "FreeLLM API", description: "LLM gateway for AI qualification.", icon: Sparkles, status: "pending", phase: "Phase 2" },
  { name: "RabbitMQ", description: "Job queue for background workers.", icon: Boxes, status: "pending", phase: "Phase 2" },
  { name: "Redis", description: "Cache and rate limiting store.", icon: Database, status: "pending", phase: "Phase 2" },
  { name: "SMTP Relay", description: "Outbound email for outreach.", icon: Mail, status: "not_configured", phase: "Phase 2" },
];

export function IntegrationsSection() {
  return (
    <SettingsSection
      title="Integrations"
      description="Connect external services. Phase 1 lays the configuration surface; Phase 2 wires the actual integrations."
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
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">{int.name}</span>
                  <Badge variant="outline" className="text-[9.5px] uppercase tracking-wide font-medium text-muted-foreground">
                    {int.phase}
                  </Badge>
                </div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">{int.description}</div>
              </div>
              {int.status === "configured" ? (
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide bg-success/10 text-success border-success/20">Connected</Badge>
              ) : int.status === "pending" ? (
                <Button variant="outline" size="sm" className="h-7 text-[11.5px]">Configure</Button>
              ) : (
                <Button variant="outline" size="sm" className="h-7 text-[11.5px]">Connect</Button>
              )}
            </div>
          );
        })}
      </div>
    </SettingsSection>
  );
}
