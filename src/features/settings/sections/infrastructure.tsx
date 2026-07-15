"use client";

import * as React from "react";
import { SettingsSection, SettingsRow } from "../settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Globe,
  Sparkles,
  Database,
  Boxes,
  Search,
  Scan,
  Server,
  ExternalLink,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const INTEGRATIONS: Array<{ id: string; name: string; description: string; icon: React.ComponentType<{ className?: string }>; defaultPort?: string; healthEndpoint: string }> = [
  { id: "firecrawl", name: "Firecrawl", description: "Web scraping for company enrichment.", icon: Globe, defaultPort: "3003", healthEndpoint: "/v1/health" },
  { id: "freellm", name: "FreeLLM", description: "LLM gateway for AI qualification.", icon: Sparkles, defaultPort: "3002", healthEndpoint: "/chat/completions" },
  { id: "redis", name: "Redis", description: "Cache and rate limiting store.", icon: Database, healthEndpoint: "" },
  { id: "rabbitmq", name: "RabbitMQ", description: "Job queue for background workers.", icon: Boxes, healthEndpoint: "" },
  { id: "postgresql", name: "PostgreSQL", description: "Primary datastore.", icon: Database, healthEndpoint: "" },
  { id: "searxng", name: "SearXNG", description: "Privacy-respecting meta-search engine.", icon: Search, healthEndpoint: "/search?q=test&format=json" },
  { id: "chromadb", name: "ChromaDB", description: "Vector database for semantic search.", icon: Scan, healthEndpoint: "/api/v1/heartbeat" },
];

interface IntegrationStatus {
  id: string;
  status: "connected" | "disconnected" | "error" | "unknown";
  latencyMs?: number;
  version?: string;
  error?: string;
  lastChecked?: string;
  lastSuccessAt?: string;
}

interface IntegrationConfigData {
  configured: boolean;
  baseUrl: string;
  apiKeySet: boolean;
  enabled: boolean;
  timeout: number;
  maxRetries: number;
  updatedAt: string | null;
}

export function InfrastructureSection() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [statuses, setStatuses] = React.useState<Map<string, IntegrationStatus>>(new Map());
  const [configs, setConfigs] = React.useState<Map<string, IntegrationConfigData>>(new Map());
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [testingId, setTestingId] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [testResults, setTestResults] = React.useState<Map<string, { success: boolean; error?: string; latencyMs?: number }>>(new Map());

  const [editForm, setEditForm] = React.useState({
    baseUrl: "",
    apiKey: "",
    enabled: false,
    timeout: 30000,
    maxRetries: 2,
  });
  const [showKey, setShowKey] = React.useState(false);

  React.useEffect(() => {
    loadAllStatuses();
    loadAllConfigs();
  }, []);

  async function loadAllStatuses() {
    try {
      const data = await apiClient.get<{ integrations: IntegrationStatus[] }>("/integrations/health");
      const map = new Map<string, IntegrationStatus>();
      data.integrations.forEach((i) => map.set(i.id, i));
      setStatuses(map);
    } catch {
      // may fail if integrations API is not available
    } finally {
      setLoading(false);
    }
  }

  async function loadAllConfigs() {
    try {
      const promises = INTEGRATIONS.map(async (int) => {
        try {
          const data = await apiClient.get<IntegrationConfigData & { configured: boolean }>(`/integrations/${int.id}`);
          setConfigs((prev) => new Map(prev).set(int.id, data));
        } catch {
          // integration may not exist yet
        }
      });
      await Promise.allSettled(promises);
    } catch {
      // ignore
    }
  }

  function startEdit(id: string) {
    const config = configs.get(id);
    const def = INTEGRATIONS.find((i) => i.id === id);
    setEditForm({
      baseUrl: config?.baseUrl ?? (def ? `https://${def!.name.toLowerCase()}.your-server${def!.defaultPort ? `:${def!.defaultPort}` : ""}` : ""),
      apiKey: "",
      enabled: config?.enabled ?? false,
      timeout: config?.timeout ?? 30000,
      maxRetries: config?.maxRetries ?? 2,
    });
    setShowKey(false);
    setEditingId(id);
    setTestResults((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setShowKey(false);
  }

  async function handleTest() {
    if (!editingId) return;
    setTestingId(editingId);
    setTestResults((prev) => {
      const next = new Map(prev);
      next.delete(editingId);
      return next;
    });
    try {
      const result = await apiClient.post<{ success: boolean; error?: string; latencyMs?: number; version?: string }>(
        `/integrations/${editingId}/test`,
        {
          baseUrl: editForm.baseUrl,
          apiKey: editForm.apiKey,
          timeout: editForm.timeout,
        }
      );
      setTestResults((prev) => new Map(prev).set(editingId, result));
      if (result.success) {
        toast({ title: "Connection successful", description: `Latency: ${result.latencyMs}ms` });
      } else {
        toast({ title: "Connection failed", description: result.error, variant: "destructive" });
      }
    } catch {
      setTestResults((prev) =>
        new Map(prev).set(editingId, { success: false, error: "Network error" })
      );
      toast({ title: "Connection test failed", variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  }

  async function handleSave() {
    if (!editingId) return;
    setSavingId(editingId);
    try {
      await apiClient.post(`/integrations/${editingId}`, {
        baseUrl: editForm.baseUrl,
        apiKey: editForm.apiKey,
        enabled: editForm.enabled,
        timeout: editForm.timeout,
        maxRetries: editForm.maxRetries,
      });
      toast({ title: `${INTEGRATIONS.find((i) => i.id === editingId)?.name} configuration saved` });
      setEditingId(null);
      setShowKey(false);
      await loadAllConfigs();
      await loadAllStatuses();
    } catch {
      toast({ title: "Failed to save configuration", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  async function handleReconnect(id: string) {
    try {
      await apiClient.post(`/integrations/${id}/connect`);
      toast({ title: "Reconnecting..." });
      await loadAllStatuses();
    } catch {
      toast({ title: "Reconnect failed", variant: "destructive" });
    }
  }

  function getStatusBadge(status: string, latencyMs?: number) {
    const statusColors: Record<string, string> = {
      connected: "bg-success/10 text-success border-success/20",
      disconnected: "bg-muted text-muted-foreground",
      error: "bg-destructive/10 text-destructive border-destructive/20",
      unknown: "bg-muted text-muted-foreground",
    };
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className={cn("text-[10px] uppercase tracking-wide", statusColors[status] || statusColors.unknown)}>
          {status}
        </Badge>
        {latencyMs != null && (
          <span className="text-[11px] text-muted-foreground">{latencyMs}ms</span>
        )}
      </div>
    );
  }

  function renderEditForm(int: typeof INTEGRATIONS[0]) {
    return (
      <div className="space-y-3 border border-border/60 rounded-md p-4 bg-muted/10">
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Base URL</Label>
            <Input
              value={editForm.baseUrl}
              onChange={(e) => setEditForm((f) => ({ ...f, baseUrl: e.target.value }))}
              placeholder={int.id === "firecrawl" ? "https://firecrawl.your-server:3003" : `https://${int.name.toLowerCase()}.your-server`}
              className="h-8 text-[13px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">API Key (leave blank to keep existing)</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={editForm.apiKey}
                onChange={(e) => setEditForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder={configs.get(int.id)?.apiKeySet ? "••••••••••••••••" : "Enter API key"}
                className="h-8 text-[13px] pr-9"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Timeout (ms)</Label>
              <Input
                type="number"
                min={1000}
                max={300000}
                value={editForm.timeout}
                onChange={(e) => setEditForm((f) => ({ ...f, timeout: parseInt(e.target.value) || 30000 }))}
                className="h-8 text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Max Retries</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={editForm.maxRetries}
                onChange={(e) => setEditForm((f) => ({ ...f, maxRetries: parseInt(e.target.value) || 2 }))}
                className="h-8 text-[13px]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id={`enabled-${int.id}`}
              checked={editForm.enabled}
              onCheckedChange={(checked) => setEditForm((f) => ({ ...f, enabled: checked }))}
            />
            <Label htmlFor={`enabled-${int.id}`} className="text-[13px]">Enabled</Label>
          </div>
        </div>

        {testResults.get(int.id) && (
          <div
            className={cn(
              "rounded-md border p-2.5 flex items-start gap-2 text-[12.5px]",
              testResults.get(int.id)!.success
                ? "border-success/30 bg-success/[0.04]"
                : "border-destructive/30 bg-destructive/[0.04]"
            )}
          >
            {testResults.get(int.id)!.success ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            )}
            <div>
              <span className={cn("font-medium", testResults.get(int.id)!.success ? "text-success" : "text-destructive")}>
                {testResults.get(int.id)!.success ? "Connected" : "Connection failed"}
              </span>
              {testResults.get(int.id)!.latencyMs != null && (
                <span className="text-muted-foreground ml-1">· {testResults.get(int.id)!.latencyMs}ms</span>
              )}
              {testResults.get(int.id)!.error && (
                <p className="text-destructive mt-0.5 text-[11.5px]">{testResults.get(int.id)!.error}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11.5px]"
            onClick={handleTest}
            disabled={testingId === int.id || !editForm.baseUrl}
          >
            {testingId === int.id ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Testing…</> : "Test Connection"}
          </Button>
          <Button size="sm" className="h-7 text-[11.5px]" onClick={handleSave} disabled={savingId === int.id}>
            {savingId === int.id ? <><Loader2 className="w-3 h-3 animate-spin" />Saving…</> : "Save"}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11.5px]" onClick={cancelEdit}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SettingsSection
      title="Infrastructure"
      description="Manage connections to external services running on your Oracle servers."
      footer={
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] text-muted-foreground">
            All services must be reachable from Server 1 (LeadForge). Never use localhost for remote services.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11.5px] gap-1"
            onClick={loadAllStatuses}
            disabled={loading}
          >
            {loading ? <><Loader2 className="w-3 h-3 animate-spin" />Checking…</> : <><RefreshCw className="w-3 h-3" />Refresh All</>}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {INTEGRATIONS.map((int) => {
          const Icon = int.icon;
          const status = statuses.get(int.id);
          const config = configs.get(int.id);
          const isEditing = editingId === int.id;

          return (
            <div
              key={int.id}
              className={cn(
                "rounded-md border border-border/60 bg-background/40 overflow-hidden",
                isEditing && "ring-1 ring-primary/30"
              )}
            >
              <div className="flex items-center gap-3 px-3 py-3">
                <div className="w-8 h-8 rounded-md bg-muted/40 flex items-center justify-center text-foreground shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground">{int.name}</span>
                    {config?.apiKeySet && (
                      <Badge variant="outline" className="text-[9px] uppercase tracking-wide text-muted-foreground border-muted-foreground/20">Key Set</Badge>
                    )}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5">{int.description}</div>
                  {status && (
                    <div className="mt-1">
                      {getStatusBadge(status.status, status.latencyMs)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isEditing && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => handleReconnect(int.id)}
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reconnect
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => startEdit(int.id)}
                      >
                        Configure
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {isEditing && renderEditForm(int)}

              {!isEditing && status?.version && (
                <div className="px-3 pb-2 text-[11px] text-muted-foreground flex items-center gap-3">
                  <span>Version: {status.version}</span>
                  {status.lastChecked && <span>Last checked: {new Date(status.lastChecked).toLocaleTimeString()}</span>}
                  {status.lastSuccessAt && <span className="text-success">Last OK: {new Date(status.lastSuccessAt).toLocaleTimeString()}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SettingsSection>
  );
}
