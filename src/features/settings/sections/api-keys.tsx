"use client";

import * as React from "react";
import { SettingsSection } from "../settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

const PLACEHOLDER_KEYS: ApiKey[] = [
  { id: "1", name: "Production worker", prefix: "lf_live_a1b2", lastUsedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(), createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString() },
  { id: "2", name: "Dev environment", prefix: "lf_live_c3d4", lastUsedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() },
];

export function ApiKeysSection() {
  const { toast } = useToast();
  const [keys, setKeys] = React.useState<ApiKey[]>(PLACEHOLDER_KEYS);

  const createKey = () => {
    const newKey: ApiKey = {
      id: String(Date.now()),
      name: "New API key",
      prefix: "lf_live_" + Math.random().toString(36).slice(2, 6),
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
    };
    setKeys((k) => [newKey, ...k]);
    toast({
      title: "API key created",
      description: "Copy the key now — you won't be able to see it again.",
    });
  };

  return (
    <SettingsSection
      title="API Keys"
      description="Manage keys for programmatic access to the Leadforge REST API."
      footer={
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] text-muted-foreground">All keys are SHA-256 hashed at rest.</p>
          <Button size="sm" className="gap-1.5" onClick={createKey}>
            <Plus className="w-3.5 h-3.5" />
            Create key
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        {keys.map((key) => (
          <div
            key={key.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border/60 bg-background/40"
          >
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-foreground">{key.name}</div>
              <div className="text-[11.5px] text-muted-foreground font-mono">
                {key.prefix}••••••••••••••••
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground text-right hidden sm:block">
              <div>Last used</div>
              <div className="text-foreground tabular-nums">
                {key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : "Never"}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => toast({ title: "Copied to clipboard" })}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setKeys((k) => k.filter((x) => x.id !== key.id))}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
