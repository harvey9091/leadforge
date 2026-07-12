"use client";

import { SettingsSection, SettingsRow } from "../settings-section";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function WorkersSection() {
  const WORKERS = [
    { name: "discovery", description: "Discovers new companies from configured sources.", enabled: true },
    { name: "enrichment", description: "Enriches companies via Firecrawl (homepage, pricing, about).", enabled: true },
    { name: "ai", description: "Runs FreeLLM qualification + scoring on enriched companies.", enabled: false },
    { name: "scheduler", description: "Triggers recurring discovery + cleanup jobs.", enabled: true },
    { name: "cleanup", description: "Removes stale data and old audit logs per retention policy.", enabled: true },
  ];

  return (
    <SettingsSection
      title="Workers"
      description="Background workers that consume jobs from RabbitMQ. Phase 1 lays the configuration; Phase 2 wires the workers."
    >
      <div className="space-y-1">
        {WORKERS.map((w) => (
          <SettingsRow
            key={w.name}
            label={
              <span className="flex items-center gap-2">
                <span className="font-mono text-[12.5px] text-foreground">{w.name}</span>
                {w.enabled ? (
                  <Badge variant="secondary" className="text-[9.5px] uppercase tracking-wide bg-success/10 text-success border-success/20">Enabled</Badge>
                ) : (
                  <Badge variant="outline" className="text-[9.5px] uppercase tracking-wide text-muted-foreground">Disabled</Badge>
                )}
              </span>
            }
            description={w.description}
          >
            <Switch defaultChecked={w.enabled} />
          </SettingsRow>
        ))}
      </div>
      <div className="mt-5 pt-4 border-t border-border/60">
        <SettingsRow
          label="Concurrency"
          description="Number of jobs each worker processes in parallel."
        >
          <Input type="number" defaultValue={4} className="w-20 h-9 text-[13px]" />
        </SettingsRow>
        <SettingsRow
          label="Poll interval (ms)"
          description="How often workers poll the queue when idle."
        >
          <Input type="number" defaultValue={1000} className="w-24 h-9 text-[13px]" />
        </SettingsRow>
      </div>
    </SettingsSection>
  );
}
