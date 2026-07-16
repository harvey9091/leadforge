"use client";

/**
 * Integrations — single source of truth for all external service configuration.
 *
 * Premium redesign:
 *  - Better card layout with refined hover states
 *  - Cleaner status indicators
 *  - Better modal styling
 *  - More polished overall feel
 */

import * as React from "react";
import { SettingsSection } from "../settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  Boxes,
  Sparkles,
  Database,
  Search,
  Scan,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const INTEGRATIONS = [
  { id: "firecrawl", name: "Firecrawl", description: "Web scraping for company enrichment.", icon: Globe },
  { id: "freellm", name: "FreeLLM", description: "LLM gateway for AI qualification and ICP analysis.", icon: Sparkles },
  { id: "redis", name: "Redis", description: "Cache and rate limiting store.", icon: Database },
  { id: "rabbitmq", name: "RabbitMQ", description: "Job queue for background workers.", icon: Boxes },
  { id: "postgresql", name: "PostgreSQL", description: "Primary datastore.", icon: Database },
  { id: "searxng", name: "SearXNG", description: "Privacy-respecting meta-search engine.", icon: Search },
  { id: "chromadb", name: "ChromaDB", description: "Vector database for semantic search.", icon: Scan },
];

interface IntegrationStatus {
  id: string;
  status: string;
  latencyMs?: number;
  version?: string;
  error?: string;
  lastChecked?: string;
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

interface TestResult {
  success: boolean;
  latencyMs?: number;
  version?: string;
  error?: string;
  models?: string[];
  httpStatus?: number;
  statusText?: string;
  probePath?: string;
  documentationUrl?: string;
  authRequired?: boolean;
}

export function IntegrationsSection() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [statuses, setStatuses] = React.useState<Map<string, IntegrationStatus>>(new Map());
  const [configs, setConfigs] = React.useState<Map<string, IntegrationConfigData>>(new Map());
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalIntegrationId, setModalIntegrationId] = React.useState<string | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [testResult, setTestResult] = React.useState<TestResult | null>(null);
  const [showKey, setShowKey] = React.useState(false);
  const [models, setModels] = React.useState<string[]>([]);
  const [discoveringModels, setDiscoveringModels] = React.useState(false);

  const [baseUrl, setBaseUrl] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [enabled, setEnabled] = React.useState(false);
  const [timeout, setTimeoutValue] = React.useState(30000);
  const [maxRetries, setMaxRetries] = React.useState(2);

  React.useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [healthData, ...configPromises] = await Promise.all([
        apiClient.get<{ integrations: IntegrationStatus[] }>("/integrations/health").catch(() => ({ integrations: [] })),
        ...INTEGRATIONS.map((int) =>
          apiClient.get<IntegrationConfigData>(`/integrations/${int.id}`).catch(() => ({ configured: false, baseUrl: "", apiKeySet: false, enabled: false, timeout: 30000, maxRetries: 2, updatedAt: null }))
        ),
      ]);

      const statusMap = new Map<string, IntegrationStatus>();
      healthData.integrations.forEach((i) => statusMap.set(i.id, i));
      setStatuses(statusMap);

      const configMap = new Map<string, IntegrationConfigData>();
      INTEGRATIONS.forEach((int, index) => {
        configMap.set(int.id, configPromises[index]);
      });
      setConfigs(configMap);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function openModal(id: string) {
    const config = configs.get(id);
    const def = INTEGRATIONS.find((i) => i.id === id);
    setModalIntegrationId(id);
    setBaseUrl(config?.baseUrl ?? "");
    setApiKey("");
    setEnabled(config?.enabled ?? false);
    setTimeoutValue(config?.timeout ?? 30000);
    setMaxRetries(config?.maxRetries ?? 2);
    setShowKey(false);
    setTestResult(null);
    setModels([]);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalIntegrationId(null);
    setTestResult(null);
    setModels([]);
  }

  async function handleTest() {
    if (!modalIntegrationId || !baseUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      if (modalIntegrationId === "freellm") {
        const result = await apiClient.post<TestResult>(`/settings/freellm/test`, {
          baseUrl,
          apiKey,
          model: "auto",
        });
        setTestResult(result);
        if (result.success) {
          toast({ title: "Connected", description: `Latency: ${result.latencyMs}ms` });
        } else {
          toast({ title: "Connection failed", description: result.error, variant: "destructive" });
        }
      } else {
        const result = await apiClient.post<TestResult>(`/integrations/${modalIntegrationId}/test`, {
          baseUrl,
          apiKey,
          timeout,
        });
        setTestResult(result);
        if (result.success) {
          toast({ title: "Connected", description: `Latency: ${result.latencyMs}ms` });
        } else {
          toast({ title: "Connection failed", description: result.error, variant: "destructive" });
        }
      }
    } catch {
      setTestResult({ success: false, error: "Network error" });
      toast({ title: "Connection test failed", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  }

  async function handleDiscoverModels() {
    if (!baseUrl) {
      toast({ title: "Enter a Base URL first", variant: "destructive" });
      return;
    }
    if (modalIntegrationId !== "freellm") {
      toast({ title: "Model discovery is only available for FreeLLM", variant: "destructive" });
      return;
    }
    setDiscoveringModels(true);
    setModels([]);
    try {
      const result = await apiClient.post<{ success: boolean; models: string[]; error?: string }>(
        `/integrations/${modalIntegrationId}/models`,
        { baseUrl, apiKey }
      );
      if (result.success && result.models.length > 0) {
        setModels(result.models);
        toast({ title: `Found ${result.models.length} models` });
      } else if (result.error) {
        toast({ title: "Model discovery failed", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "No models found — enter model name manually" });
      }
    } catch {
      toast({ title: "Failed to discover models", variant: "destructive" });
    } finally {
      setDiscoveringModels(false);
    }
  }

  async function handleSave() {
    if (!modalIntegrationId) return;
    setSaving(true);
    try {
      if (modalIntegrationId === "freellm") {
        await apiClient.post("/settings/freellm", {
          baseUrl,
          apiKey,
          model: "auto",
          temperature: 0.3,
          maxTokens: 4000,
          timeout,
          streaming: false,
        });
      } else {
        await apiClient.post(`/integrations/${modalIntegrationId}`, {
          baseUrl,
          apiKey,
          enabled,
          timeout,
          maxRetries,
        });
      }
      toast({ title: `${INTEGRATIONS.find((i) => i.id === modalIntegrationId)?.name} configuration saved` });
      closeModal();
      await loadAll();
    } catch {
      toast({ title: "Failed to save configuration", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleReconnect(id: string) {
    try {
      await apiClient.post(`/integrations/${id}/connect`);
      toast({ title: "Reconnecting..." });
      await loadAll();
    } catch {
      toast({ title: "Reconnect failed", variant: "destructive" });
    }
  }

  function getStatusBadge(status: string, latencyMs?: number) {
    const colors: Record<string, string> = {
      connected: "bg-success/10 text-success border-success/20",
      disconnected: "bg-muted text-muted-foreground",
      error: "bg-destructive/10 text-destructive border-destructive/20",
      unknown: "bg-muted text-muted-foreground",
    };
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className={cn("text-[10px] uppercase tracking-wide font-semibold", colors[status] || colors.unknown)}>
          {status}
        </Badge>
        {latencyMs != null && <span className="text-[11px] text-muted-foreground tabular-nums">{latencyMs}ms</span>}
      </div>
    );
  }

  function renderFreeLLMModal() {
    return (
      <Dialog open={modalOpen && modalIntegrationId === "freellm"} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold">Configure FreeLLM</DialogTitle>
            <DialogDescription>
              Connect to your FreeLLM-compatible LLM gateway for AI qualification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-medium">Base URL</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://68.233.114.213:3002/v1"
                className="h-9 text-[13px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-medium">API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={configs.get("freellm")?.apiKeySet ? "••••••••••••••••" : "Enter API key"}
                  className="h-9 text-[13px] pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-medium">Model</Label>
              <Select value="auto" onValueChange={() => {}}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Auto (server default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (server default)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {testResult && (
              <div
                className={cn(
                  "rounded-lg border p-3 flex items-start gap-2.5 text-[12.5px]",
                  testResult.success
                    ? "border-success/30 bg-success/[0.04]"
                    : "border-destructive/30 bg-destructive/[0.04]"
                )}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <span className={cn("font-semibold", testResult.success ? "text-success" : "text-destructive")}>
                    {testResult.success ? "Connected" : "Connection failed"}
                  </span>
                  {testResult.success && testResult.latencyMs != null && (
                    <span className="text-muted-foreground ml-1">
                      · Latency: {testResult.latencyMs}ms
                      {testResult.version && <span className="ml-1">· Model: {testResult.version}</span>}
                    </span>
                  )}
                  {!testResult.success && (
                    <div className="mt-1.5 space-y-1">
                      {testResult.httpStatus && testResult.httpStatus > 0 && (
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold",
                            testResult.httpStatus === 401 && "bg-destructive/20 text-destructive",
                            testResult.httpStatus === 403 && "bg-destructive/20 text-destructive",
                            testResult.httpStatus === 404 && "bg-orange-500/20 text-orange-400",
                            testResult.httpStatus >= 500 && "bg-orange-500/20 text-orange-400",
                          )}>
                            HTTP {testResult.httpStatus}
                          </span>
                          <span className="text-muted-foreground">{testResult.statusText}</span>
                        </div>
                      )}
                      {testResult.probePath && (
                        <div className="text-[11px] text-muted-foreground">
                          Path: <code className="bg-muted/50 px-1 rounded">{testResult.probePath}</code>
                        </div>
                      )}
                      {testResult.authRequired && (
                        <div className="text-[11px] text-orange-400">
                          Authentication required — check that the API key is correct.
                        </div>
                      )}
                      {testResult.error && (
                        <p className="text-destructive mt-0.5 text-[11px] font-mono break-all">{testResult.error}</p>
                      )}
                      {!testResult.httpStatus && !testResult.authRequired && (
                        <p className="text-muted-foreground text-[11px]">
                          Suggestion: Check Base URL, firewall rules, and that Server 2 is reachable on the specified port.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12.5px] font-medium">Timeout (ms)</Label>
                <Input
                  type="number"
                  min={1000}
                  max={600000}
                  value={timeout}
                  onChange={(e) => setTimeoutValue(parseInt(e.target.value) || 60000)}
                  className="h-9 text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12.5px] font-medium">Max Retries</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(parseInt(e.target.value) || 2)}
                  className="h-9 text-[13px]"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" className="h-8 text-[12.5px]" onClick={handleTest} disabled={testing || !baseUrl}>
              {testing ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Testing…</> : "Test Connection"}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-[12.5px]" onClick={closeModal}>
                Cancel
              </Button>
              <Button size="sm" className="h-8 text-[12.5px]" onClick={handleSave} disabled={saving || !baseUrl}>
                {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function renderFirecrawlModal() {
    return (
      <Dialog open={modalOpen && modalIntegrationId === "firecrawl"} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold">Configure Firecrawl</DialogTitle>
            <DialogDescription>
              Connect to your Firecrawl instance for web scraping and content extraction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-medium">Base URL</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://68.233.114.213:3003"
                className="h-9 text-[13px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-medium">API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={configs.get("firecrawl")?.apiKeySet ? "••••••••••••••••" : "Enter API key"}
                  className="h-9 text-[13px] pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={cn(
                  "rounded-lg border p-3 flex items-start gap-2.5 text-[12.5px]",
                  testResult.success
                    ? "border-success/30 bg-success/[0.04]"
                    : "border-destructive/30 bg-destructive/[0.04]"
                )}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <span className={cn("font-semibold", testResult.success ? "text-success" : "text-destructive")}>
                    {testResult.success ? "Connected" : "Connection failed"}
                  </span>
                  {testResult.success && testResult.latencyMs != null && (
                    <span className="text-muted-foreground ml-1">· Latency: {testResult.latencyMs}ms</span>
                  )}
                  {!testResult.success && (
                    <div className="mt-1.5 space-y-1">
                      {testResult.httpStatus && testResult.httpStatus > 0 && (
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold",
                            testResult.httpStatus === 401 && "bg-destructive/20 text-destructive",
                            testResult.httpStatus === 403 && "bg-destructive/20 text-destructive",
                            testResult.httpStatus === 404 && "bg-orange-500/20 text-orange-400",
                            testResult.httpStatus >= 500 && "bg-orange-500/20 text-orange-400",
                          )}>
                            HTTP {testResult.httpStatus}
                          </span>
                          <span className="text-muted-foreground">{testResult.statusText}</span>
                        </div>
                      )}
                      {testResult.probePath && (
                        <div className="text-[11px] text-muted-foreground">
                          Probed: <code className="bg-muted/50 px-1 rounded">{testResult.probePath}</code>
                        </div>
                      )}
                      {testResult.documentationUrl && (
                        <div className="text-[11px] text-muted-foreground">
                          Docs: <code className="bg-muted/50 px-1 rounded">{testResult.documentationUrl}</code>
                        </div>
                      )}
                      {testResult.authRequired && (
                        <div className="text-[11px] text-orange-400">
                          Authentication required — API key may be needed.
                        </div>
                      )}
                      {testResult.error && (
                        <p className="text-destructive mt-0.5 text-[11px] font-mono break-all">{testResult.error}</p>
                      )}
                      {!testResult.httpStatus && !testResult.authRequired && (
                        <p className="text-muted-foreground text-[11px]">
                          Suggestion: Check Base URL, firewall rules, and that Server 2 is reachable on the specified port.
                        </p>
                      )}
                    </div>
                  )}
                  {testResult.version && (
                    <span className="text-muted-foreground ml-1">· Version: {testResult.version}</span>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12.5px] font-medium">Timeout (ms)</Label>
                <Input
                  type="number"
                  min={1000}
                  max={300000}
                  value={timeout}
                  onChange={(e) => setTimeoutValue(parseInt(e.target.value) || 30000)}
                  className="h-9 text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12.5px] font-medium">Max Retries</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(parseInt(e.target.value) || 2)}
                  className="h-9 text-[13px]"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" className="h-8 text-[12.5px]" onClick={handleTest} disabled={testing || !baseUrl}>
              {testing ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Testing…</> : "Test Connection"}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-[12.5px]" onClick={closeModal}>
                Cancel
              </Button>
              <Button size="sm" className="h-8 text-[12.5px]" onClick={handleSave} disabled={saving || !baseUrl}>
                {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <SettingsSection
      title="Integrations"
      description="Connect external services to power the Leadforge pipeline."
      footer={
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] text-muted-foreground">
            All services must be reachable from the LeadForge server.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11.5px] gap-1.5 border-border/60"
            onClick={loadAll}
            disabled={loading}
          >
            {loading ? <><Loader2 className="w-3 h-3 animate-spin" />Checking…</> : <><RefreshCw className="w-3 h-3" />Refresh All</>}
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        {INTEGRATIONS.map((int) => {
          const Icon = int.icon;
          const status = statuses.get(int.id);
          const config = configs.get(int.id);

          return (
            <div
              key={int.id}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border/60 bg-background/40 hover:bg-background/60 hover:border-border/80 transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center text-foreground shrink-0 group-hover:scale-105 transition-transform duration-200">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-foreground">{int.name}</span>
                  {config?.apiKeySet && (
                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider text-muted-foreground border-muted-foreground/20 font-semibold">Key Set</Badge>
                  )}
                </div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">{int.description}</div>
                {status && (
                  <div className="mt-1.5">
                    {getStatusBadge(status.status, status.latencyMs)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[12px] gap-1.5"
                  onClick={() => handleReconnect(int.id)}
                >
                  <RefreshCw className="w-3 h-3" />
                  Reconnect
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[12px] border-border/60"
                  onClick={() => openModal(int.id)}
                >
                  Configure
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {renderFreeLLMModal()}
      {renderFirecrawlModal()}
    </SettingsSection>
  );
}
