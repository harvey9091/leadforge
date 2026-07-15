"use client";

import * as React from "react";
import { SettingsSection } from "../settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiKeysSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const res = await fetch("/api/v1/api-keys");
      if (!res.ok) throw new Error("Failed to fetch API keys");
      const json = await res.json();
      return json.data as ApiKey[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to create API key");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "API key created", description: "Copy the key now — you won't be able to see it again." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete API key");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "API key deleted" });
    },
  });

  const createKey = () => {
    const name = prompt("API key name:", "New API key");
    if (name?.trim()) {
      createMutation.mutate(name.trim());
    }
  };

  return (
    <SettingsSection
      title="API Keys"
      description="Manage keys for programmatic access to the Leadforge REST API."
      footer={
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] text-muted-foreground">All keys are SHA-256 hashed at rest.</p>
          <Button size="sm" className="gap-1.5" onClick={createKey} disabled={createMutation.isPending}>
            <Plus className="w-3.5 h-3.5" />
            Create key
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="text-[13px] text-muted-foreground">Loading API keys…</div>
      ) : !keys || keys.length === 0 ? (
        <div className="text-[13px] text-muted-foreground">No API keys yet.</div>
      ) : (
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
                onClick={() => deleteMutation.mutate(key.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
