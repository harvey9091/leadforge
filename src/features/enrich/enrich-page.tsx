"use client";

/**
 * Enrich page — manage enrichment jobs and view enrichment metrics.
 *
 * Features:
 *  - Create enrichment job (pick a company to enrich)
 *  - View enrichment job list with live status
 *  - Pause / Resume / Retry / Cancel
 *  - Per-job log viewer
 *  - Firecrawl health status
 *  - Enrichment metrics (companies enriched, pending, avg crawl time)
 */

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Play,
  Pause,
  RotateCcw,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Terminal,
  Activity,
  Globe,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiClient } from "@/lib/api-client";
import { cn, formatRelativeTime, formatNumber } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface EnrichmentJob {
  id: string;
  companyId: string;
  status: "QUEUED" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED" | "RETRYING";
  pagesCrawled: number;
  technologiesFound: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastHeartbeat: string | null;
  durationMs: number | null;
  createdAt: string;
  company?: { id: string; name: string; domain: string | null };
  _count?: { logs: number };
}

interface EnrichStats {
  companies: { total: number; enriched: number; pending: number };
  jobs: { total: number; running: number; completed: number; failed: number; queued: number };
  avgCrawlMs: number;
  avgPages: number;
  successRate: number;
  firecrawl: { configured: boolean; available: boolean; latencyMs?: number; error?: string };
  worker: { workerId: string; running: boolean; activeJobCount: number };
  topTechnologies: Array<{ name: string; category: string; count: number }>;
  recentEnrichments: Array<{
    id: string; name: string; domain: string | null; logoUrl: string | null;
    lastEnrichedAt: string; enrichmentPages: number | null;
    pricingDetected: boolean; enterpriseDetected: boolean;
  }>;
}

interface Company {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
}

export function EnrichPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["enrich", "stats"],
    queryFn: () => apiClient.get<EnrichStats>("/enrich/stats"),
    refetchInterval: 5_000,
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["enrich", "jobs"],
    queryFn: () => apiClient.get<{ data: EnrichmentJob[] }>("/enrich/jobs", { limit: 50 }),
    refetchInterval: (query) => {
      const jobs = query.state.data?.data ?? [];
      const hasActive = jobs.some((j) => j.status === "RUNNING" || j.status === "QUEUED" || j.status === "RETRYING");
      return hasActive ? 3_000 : 15_000;
    },
  });

  const [createOpen, setCreateOpen] = React.useState(false);
  const [expandedJob, setExpandedJob] = React.useState<string | null>(null);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Enrich"
        description="Enrich discovered companies with website data via Firecrawl."
        actions={<CreateEnrichmentJobDialog open={createOpen} onOpenChange={setCreateOpen} />}
      />

      {/* Firecrawl status banner */}
      <Card className={cn(
        "p-4 mb-6 border-border/60 flex items-center gap-4",
        stats?.firecrawl.available ? "bg-success/[0.04]" : "bg-warning/[0.04]"
      )}>
        <div className={cn(
          "w-9 h-9 rounded-md flex items-center justify-center",
          stats?.firecrawl.available ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
        )}>
          <Globe className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-medium text-foreground">
            {statsLoading ? "Checking Firecrawl…" : stats?.firecrawl.available
              ? "Firecrawl connected"
              : "Firecrawl not configured — using direct HTTP fetch"}
          </div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">
            {stats?.firecrawl.available
              ? `Latency: ${stats.firecrawl.latencyMs}ms — full scraping power`
              : "All enrichment uses real website fetching. Configure FIRECRAWL_API_URL for enhanced scraping."}
          </div>
        </div>
        {stats?.worker && (
          <Badge variant="outline" className="text-[10px] font-normal">
            {stats.worker.running ? "Worker running" : "Worker stopped"}
          </Badge>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Companies Enriched"
          value={stats?.companies.enriched ?? 0}
          format="compact"
          icon={CheckCircle2}
          loading={statsLoading}
        />
        <StatCard
          label="Pending Enrichment"
          value={stats?.companies.pending ?? 0}
          format="compact"
          icon={Clock}
          loading={statsLoading}
        />
        <StatCard
          label="Avg Crawl Time"
          value={stats && stats.avgCrawlMs > 0 ? `${(stats.avgCrawlMs / 1000).toFixed(1)}s` : "—"}
          format="raw"
          icon={Activity}
          loading={statsLoading}
        />
        <StatCard
          label="Success Rate"
          value={stats ? `${stats.successRate.toFixed(0)}%` : "—"}
          format="raw"
          icon={Zap}
          loading={statsLoading}
        />
      </div>

      {/* Top technologies + recent enrichments */}
      {stats && stats.topTechnologies.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card className="p-5 border-border/60 bg-card/40">
            <Section title="Top Technologies" description="Most detected across companies">
              <div className="space-y-2">
                {stats.topTechnologies.slice(0, 8).map((tech) => (
                  <div key={tech.name} className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[9px] uppercase font-normal w-20 justify-center">
                      {tech.category}
                    </Badge>
                    <span className="text-[12.5px] text-foreground font-medium flex-1">{tech.name}</span>
                    <span className="text-[12px] text-muted-foreground tabular-nums">{tech.count}</span>
                  </div>
                ))}
              </div>
            </Section>
          </Card>

          <Card className="p-5 border-border/60 bg-card/40">
            <Section title="Recently Enriched" description="Latest enriched companies">
              <div className="space-y-1">
                {stats.recentEnrichments.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/30">
                    <div className="w-6 h-6 rounded bg-muted/60 flex items-center justify-center text-[9px] font-semibold shrink-0">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-[12px] font-medium text-foreground flex-1 truncate">{c.name}</span>
                    {c.pricingDetected && <Badge variant="secondary" className="text-[9px]">$</Badge>}
                    {c.enterpriseDetected && <Badge variant="secondary" className="text-[9px]">Ent</Badge>}
                    <span className="text-[10.5px] text-muted-foreground tabular-nums">
                      {c.lastEnrichedAt ? formatRelativeTime(c.lastEnrichedAt) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </Card>
        </div>
      )}

      {/* Jobs list */}
      <Section title="Enrichment Jobs" description={`${jobsData?.data?.length ?? 0} jobs`}>
        {jobsLoading ? (
          <Card className="p-8 text-center text-muted-foreground text-[13px]">Loading jobs…</Card>
        ) : !jobsData?.data || jobsData.data.length === 0 ? (
          <Card className="p-10 text-center border-dashed">
            <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-[14px] font-semibold text-foreground mb-1">No enrichment jobs yet</h3>
            <p className="text-[12.5px] text-muted-foreground mb-4 max-w-sm mx-auto">
              Enrich discovered companies to extract website data, detect technologies, and capture pricing information.
            </p>
            <CreateEnrichmentJobDialog />
          </Card>
        ) : (
          <div className="space-y-2">
            {jobsData.data.map((job) => (
              <EnrichJobCard
                key={job.id}
                job={job}
                expanded={expandedJob === job.id}
                onToggle={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function CreateEnrichmentJobDialog({ open, onOpenChange }: { open?: boolean; onOpenChange?: (v: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [selectedCompany, setSelectedCompany] = React.useState<Company | null>(null);

  const { data: companies } = useQuery({
    queryKey: ["companies", "for-enrich", search],
    queryFn: () => apiClient.get<{ data: Company[]; pagination: { total: number } }>("/companies", {
      pageSize: 20,
      q: search || undefined,
    }),
    enabled: open !== false,
  });

  const createMutation = useMutation({
    mutationFn: (companyId: string) =>
      apiClient.post("/enrich/jobs", { companyId }),
    onSuccess: () => {
      toast({ title: "Enrichment job created", description: "Worker will start within 5 seconds." });
      queryClient.invalidateQueries({ queryKey: ["enrich"] });
      onOpenChange?.(false);
      setSelectedCompany(null);
      setSearch("");
    },
    onError: (err) => {
      toast({
        title: "Failed to create job",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const dialog = (
    <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-[16px]">Create enrichment job</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <p className="text-[12.5px] text-muted-foreground">
          Select a company to enrich. The worker will crawl its website, detect technologies, extract content, and capture pricing information.
        </p>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies…"
            className="pl-8 h-9 text-[13px]"
          />
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1 rounded-md border border-border/60 p-1">
          {companies?.data.length === 0 ? (
            <div className="text-center py-6 text-[12px] text-muted-foreground">No companies found</div>
          ) : (
            companies?.data.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCompany(c)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                  selectedCompany?.id === c.id ? "bg-foreground/8" : "hover:bg-muted/40"
                )}
              >
                <div className="w-6 h-6 rounded bg-muted/60 flex items-center justify-center text-[9px] font-semibold shrink-0">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium text-foreground truncate">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.domain ?? "—"}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() => selectedCompany && createMutation.mutate(selectedCompany.id)}
          disabled={!selectedCompany || createMutation.isPending}
          className="gap-1.5"
        >
          {createMutation.isPending ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating…</>
          ) : (
            <><Zap className="w-3.5 h-3.5" />Start enrichment</>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  if (open !== undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange!}>
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Create job
          </Button>
        </DialogTrigger>
        {dialog}
      </Dialog>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          Create job
        </Button>
      </DialogTrigger>
      {dialog}
    </Dialog>
  );
}

function EnrichJobCard({
  job,
  expanded,
  onToggle,
}: {
  job: EnrichmentJob;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["enrich"] });
  };

  const action = useMutation({
    mutationFn: async (action: "pause" | "resume" | "retry" | "cancel") => {
      if (action === "cancel") return apiClient.delete(`/enrich/jobs/${job.id}`);
      return apiClient.post(`/enrich/jobs/${job.id}/${action}`);
    },
    onSuccess: (_, action) => {
      toast({ title: `Job ${action}d` });
      invalidate();
    },
    onError: (err, action) => {
      toast({ title: `Failed to ${action} job`, description: err instanceof Error ? err.message : "", variant: "destructive" });
    },
  });

  const isActive = job.status === "RUNNING" || job.status === "QUEUED" || job.status === "RETRYING";

  return (
    <Card className={cn(
      "border-border/60 bg-card/40 overflow-hidden",
      job.status === "RUNNING" && "ring-1 ring-info/20"
    )}>
      <div className="flex items-center gap-3 p-4">
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <EnrichStatusIcon status={job.status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-semibold text-foreground truncate">
              {job.company?.name ?? "Unknown company"}
            </span>
            <StatusBadge status={job.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11.5px] text-muted-foreground flex-wrap">
            <span>{job.company?.domain ?? "—"}</span>
            {job.pagesCrawled > 0 && (
              <>
                <span>·</span>
                <span>{job.pagesCrawled} pages</span>
              </>
            )}
            {job.technologiesFound > 0 && (
              <>
                <span>·</span>
                <span>{job.technologiesFound} technologies</span>
              </>
            )}
            {job.durationMs && (
              <>
                <span>·</span>
                <span>{(job.durationMs / 1000).toFixed(1)}s</span>
              </>
            )}
            <span>·</span>
            <span>{formatRelativeTime(job.createdAt)}</span>
            {job.lastHeartbeat && isActive && (
              <>
                <span>·</span>
                <span className="text-success flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  {formatRelativeTime(job.lastHeartbeat)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {job.status === "RUNNING" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => action.mutate("pause")}>
                  <Pause className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pause</TooltipContent>
            </Tooltip>
          )}
          {job.status === "PAUSED" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => action.mutate("resume")}>
                  <Play className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Resume</TooltipContent>
            </Tooltip>
          )}
          {(job.status === "FAILED" || job.status === "COMPLETED" || job.status === "CANCELLED") && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => action.mutate("retry")}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retry</TooltipContent>
            </Tooltip>
          )}
          {isActive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => action.mutate("cancel")}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cancel</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {job.errorMessage && (
        <div className="px-4 pb-2 text-[11.5px] text-destructive">
          {job.errorMessage}
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <EnrichJobLogs jobId={job.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function EnrichStatusIcon({ status }: { status: EnrichmentJob["status"] }) {
  switch (status) {
    case "RUNNING":
    case "RETRYING":
      return <Loader2 className="w-4 h-4 text-info animate-spin shrink-0" />;
    case "QUEUED":
      return <Clock className="w-4 h-4 text-muted-foreground shrink-0" />;
    case "COMPLETED":
      return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />;
    case "FAILED":
      return <XCircle className="w-4 h-4 text-destructive shrink-0" />;
    case "PAUSED":
      return <Pause className="w-4 h-4 text-warning shrink-0" />;
    case "CANCELLED":
      return <X className="w-4 h-4 text-muted-foreground shrink-0" />;
    default:
      return <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />;
  }
}

function EnrichJobLogs({ jobId }: { jobId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["enrich", "jobs", jobId, "logs"],
    queryFn: () => apiClient.get<{ data: Array<{ id: string; level: string; page: string | null; message: string; metadata: string; durationMs: number | null; timestamp: string }> }>(`/enrich/jobs/${jobId}/logs`, { limit: 100 }),
    refetchInterval: 3_000,
  });

  const logs = (data?.data ?? []).reverse();

  return (
    <div className="border-t border-border/60 bg-background/40">
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border/40">
        <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[11.5px] font-medium text-muted-foreground uppercase tracking-wide">Enrichment Logs</span>
        <span className="text-[11px] text-muted-foreground ml-auto">{logs.length} entries</span>
      </div>
      <div className="max-h-72 overflow-y-auto p-3 font-mono text-[11px] space-y-0.5">
        {isLoading ? (
          <div className="text-muted-foreground text-center py-4">Loading logs…</div>
        ) : logs.length === 0 ? (
          <div className="text-muted-foreground text-center py-4">No logs yet</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 hover:bg-muted/30 rounded px-1 py-0.5">
              <span className="text-muted-foreground/60 shrink-0 tabular-nums">
                {new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false })}
              </span>
              <span className={cn(
                "shrink-0 font-semibold w-10",
                log.level === "ERROR" && "text-destructive",
                log.level === "WARN" && "text-warning",
                log.level === "INFO" && "text-info",
                log.level === "DEBUG" && "text-muted-foreground"
              )}>
                {log.level}
              </span>
              {log.page && (
                <Badge variant="outline" className="text-[9px] py-0 h-4 shrink-0 font-mono">
                  {log.page}
                </Badge>
              )}
              <span className="text-foreground/90">{log.message}</span>
              {log.durationMs && (
                <span className="text-muted-foreground text-[10px] ml-auto shrink-0">{log.durationMs}ms</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
