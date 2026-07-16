"use client";

import * as React from "react";
import { SettingsSection, SettingsRow } from "../settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  Server,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FreeLLMStatus {
  success: boolean;
  latencyMs?: number;
  model?: string;
  error?: string;
}

interface FreeLLMConfig {
  configured: boolean;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  streaming: boolean;
  apiKeySet: boolean;
  updatedAt: string | null;
}

export function FreeLLMSection() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [discovering, setDiscovering] = React.useState(false);
  const [config, setConfig] = React.useState<FreeLLMConfig | null>(null);
  const [testResult, setTestResult] = React.useState<FreeLLMStatus | null>(null);
  const [models, setModels] = React.useState<string[]>([]);
  const [showKey, setShowKey] = React.useState(false);

  const [baseUrl, setBaseUrl] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [model, setModel] = React.useState("auto");
  const [temperature, setTemperature] = React.useState(0.3);
  const [maxTokens, setMaxTokens] = React.useState(4000);
  const [timeoutMs, setTimeoutMs] = React.useState(60000);
  const [streaming, setStreaming] = React.useState(false);

  React.useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await apiClient.get<FreeLLMConfig>("/settings/freellm");
      setConfig(data);
      setBaseUrl(data.baseUrl);
    setModel(data.model);
    setTemperature(data.temperature);
    setMaxTokens(data.maxTokens);
    setTimeoutMs(data.timeout);
    setStreaming(data.streaming);
    } catch {
      // config may not be set yet
    } finally {
      setLoading(false);
    }
  }

  async function handleDiscoverModels() {
    if (!baseUrl) {
      toast({ title: "Enter a Base URL first", variant: "destructive" });
      return;
    }
    setDiscovering(true);
    setModels([]);
    try {
      const result = await apiClient.post<{ success: boolean; models: string[]; error?: string }>(
        "/settings/freellm/models",
        { baseUrl, apiKey }
      );
      if (result.success && result.models.length > 0) {
        setModels(result.models);
        if (!result.models.includes(model)) {
          setModel(result.models[0]);
        }
        toast({ title: `Found ${result.models.length} models` });
      } else if (result.error) {
        setModels([]);
        toast({ title: "Model discovery failed", description: result.error, variant: "destructive" });
      } else {
        setModels([]);
        toast({ title: "No models found — enter model name manually" });
      }
    } catch {
      toast({ title: "Failed to discover models", variant: "destructive" });
    } finally {
      setDiscovering(false);
    }
  }

  async function handleTest() {
    if (!baseUrl) {
      toast({ title: "Enter a Base URL first", variant: "destructive" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
    const testModel = model === "auto" ? "auto" : model;
    const result = await apiClient.post<FreeLLMStatus>("/settings/freellm/test", {
      baseUrl,
      apiKey,
      model: testModel,
    });
      setTestResult(result);
      if (result.success) {
        toast({ title: "Connected", description: `Latency: ${result.latencyMs}ms${result.model ? ` · Model: ${result.model}` : ""}` });
      } else {
        toast({ title: "Connection failed", description: result.error, variant: "destructive" });
      }
    } catch {
      setTestResult({ success: false, error: "Network error" });
      toast({ title: "Connection test failed", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiClient.post("/settings/freellm", {
        baseUrl,
        apiKey,
        model: model === "default" ? "auto" : model,
        temperature,
        maxTokens,
        timeout: timeoutMs,
        streaming,
        });
      await loadConfig();
      setTestResult(null);
      toast({ title: "FreeLLM configuration saved" });
    } catch {
      toast({ title: "Failed to save configuration", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SettingsSection title="FreeLLM API" description="LLM gateway for AI qualification.">
        <div className="flex items-center justify-center py-8 text-muted-foreground text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading configuration…
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="FreeLLM API"
      description="LLM gateway for AI qualification. Configure your FreeLLM-compatible endpoint."
      footer={
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] text-muted-foreground">
            {config?.configured ? "Active — AI workers use this endpoint" : "Not configured — AI features will be unavailable"}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-[11.5px]" onClick={handleTest} disabled={testing || !baseUrl}>
              {testing ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Testing…</> : "Test Connection"}
            </Button>
            <Button size="sm" className="h-7 text-[11.5px] gap-1" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-3 h-3 animate-spin" />Saving…</> : "Save"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <SettingsRow label="Base URL" description="The base URL of your FreeLLM-compatible API (e.g. http://your-server:3002/v1)">
          <div className="w-72">
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-server:3002/v1"
              className="h-8 text-[13px]"
            />
          </div>
        </SettingsRow>

        <SettingsRow label="API Key" description="Stored encrypted at rest. Leave blank to keep existing key.">
          <div className="w-72 relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.apiKeySet ? "••••••••••••••••" : "Enter API key"}
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
        </SettingsRow>

        <SettingsRow label="Model" description="The model to use. 'Auto' selects the server default.">
          <div className="w-72 space-y-2">
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (server default)</SelectItem>
                {models.filter(m => m !== "auto").map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                value={model === "auto" ? "" : model}
                onChange={(e) => setModel(e.target.value || "auto")}
                placeholder="Or type a model name"
                className="h-7 text-[12px]"
                disabled={model === "auto"}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1 shrink-0"
                onClick={handleDiscoverModels}
                disabled={discovering || !baseUrl}
              >
                {discovering ? <><Loader2 className="w-3 h-3 animate-spin" />Scanning</> : <><RefreshCw className="w-3 h-3" />Discover</>}
              </Button>
            </div>
          </div>
        </SettingsRow>

        <div className="grid grid-cols-2 gap-4">
          <SettingsRow label="Temperature" description="0 = deterministic, 2 = creative">
            <div className="w-32">
              <Input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(clampTemp(parseFloat(e.target.value)))}
                className="h-8 text-[13px]"
              />
            </div>
          </SettingsRow>

          <SettingsRow label="Max Tokens" description="Maximum response length">
            <div className="w-32">
              <Input
                type="number"
                min={1}
                max={1000000}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Math.max(1, parseInt(e.target.value, 10) || 4000))}
                className="h-8 text-[13px]"
              />
            </div>
          </SettingsRow>

          <SettingsRow label="Request Timeout (ms)" description="Timeout per request">
            <div className="w-32">
            <Input
              type="number"
              min={1000}
              max={600000}
              step={1000}
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Math.max(1000, parseInt(e.target.value, 10) || 60000))}
              className="h-8 text-[13px]"
            />
            </div>
          </SettingsRow>

          <SettingsRow label="Streaming" description="Enable streaming responses">
            <Switch checked={streaming} onCheckedChange={setStreaming} />
          </SettingsRow>
        </div>

        {testResult && (
          <div className={cn(
            "rounded-md border p-3 flex items-start gap-2.5",
            testResult.success
              ? "border-success/30 bg-success/[0.04]"
              : "border-destructive/30 bg-destructive/[0.04]"
          )}>
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            )}
            <div className="text-[12.5px]">
              <span className={cn("font-medium", testResult.success ? "text-success" : "text-destructive")}>
                {testResult.success ? "Connected" : "Connection failed"}
              </span>
              {testResult.success && testResult.latencyMs != null && (
                <span className="text-muted-foreground ml-2">
                  · Latency: {testResult.latencyMs}ms
                  {testResult.model && <span className="ml-1">· Model: {testResult.model}</span>}
                </span>
              )}
              {testResult.error && (
                <p className="text-destructive mt-0.5">{testResult.error}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

function clampTemp(v: number): number {
  if (Number.isNaN(v)) return 0.3;
  return Math.round(Math.min(Math.max(v, 0), 2) * 10) / 10;
}
