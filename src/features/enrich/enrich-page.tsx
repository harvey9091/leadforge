"use client";

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
  RefreshCw,
  Filter,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  firecrawl: {
    configured: boolean;
    available: boolean;
    latencyMs?: number;
    version?: string;
    lastCrawl?: string | null;
    error?: string;
  };
  worker: { workerId: string; running: boolean; activeJobCount: number };
  topTechnologies: Array<{ name: string; category: string; count: number }>;
  recentEnrichments: Array<{
    id: string; name: string; domain: string | null; logoUrl: string | null;
    lastEnrichedAt: string; enrichmentPages: number | null;
    pricingDetected: boolean; enterpriseDetected: boolean;
  }>;
}

export function EnrichPage() {
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["enrich", "stats"],
    queryFn: () => apiClient.get<EnrichStats>("/enrich/stats"),
    refetchInterval: 5_000,
  });

  const [testingFirecrawl, setTestingFirecrawl] = React.useState(false);
  const [firecrawlTestResult, setFirecrawlTestResult] = React.useState<{ success: boolean; latencyMs?: number; version?: string; error?: string } | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  async function handleTestFirecrawl() {
    setTestingFirecrawl(true);
    setFirecrawlTestResult(null);
    try {
      const result = await apiClient.get<{ available: boolean; latencyMs?: number; version?: string; error?: string }>("/firecrawl/health");
      setFirecrawlTestResult({
        success: result.available,
        latencyMs: result.latencyMs,
        version: result.version,
        error: result.error,
      });
      refetchStats();
    } catch {
      setFirecrawlTestResult({ success: false, error: "Failed to reach health endpoint" });
    } finally {
      setTestingFirecrawl(false);
    }
  }

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["enrich", "jobs"],
    queryFn: () => apiClient.get<{ data: EnrichmentJob[] }>("/enrich/jobs", { limit: 50 }),
    refetchInterval: (query) => {
      const jobs = query.state.data?.data ?? [];
      const hasActive = jobs.some((j) => j.status === "RUNNING" || j.status === "QUEUED" || j.status === "RETRYING");
      return hasActive ? 3_000 : 15_000;
    },
  });

  const [expandedJob, setExpandedJob] = React.useState<string | null>(null);

  const filteredJobs = React.useMemo(() => {
    if (!jobsData?.data) return [];
    if (statusFilter === "all") return jobsData.data;
    return jobsData.data.filter((j) => j.status === statusFilter.toUpperCase());
  }, [jobsData?.data, statusFilter]);

  const activeCount = jobsData?.data?.filter((j) => j.status === "RUNNING" || j.status === "QUEUED" || j.status === "RETRYING").length ?? 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title="Enrich"
        description="Enrich companies with website data via Firecrawl."
        actions={<EnrichAllDialog />}
      />

      <div className="flex items-center gap-2 -mt-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-[12px] font-medium"
          onClick={handleTestFirecrawl}
          disabled={testingFirecrawl}
        >
          {testingFirecrawl ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Testing
            </>
          ) : (
            <>
              <Globe className="w-3.5 h-3.5" />
              Test Firecrawl
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-[12px] font-medium"
          onClick={() => { refetchStats(); }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
        {firecrawlTestResult && (
          <span className={cn(
            "text-[11.5px] font-medium ml-1",
            firecrawlTestResult.success ? "text-success" : "text-destructive"
          )}>
            {firecrawlTestResult.success ? "Connected" : "Disconnected"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {stats && stats.topTechnologies.length > 0 && (
            <Card className="border-border/60 bg-card/40 overflow-hidden">
              <div className="px-5 pt-5 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-[14px] font-semibold text-foreground tracking-tight">Top Technologies</h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Most detected across companies</p>
                </div>
              </div>
              <div className="px-5 pb-5 space-y-1">
                {stats.topTechnologies.slice(0, 8).map((tech) => (
                  <div key={tech.name} className="flex items-center gap-3 py-1.5 group">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-28 shrink-0 group-hover:text-foreground transition-colors">
                      {tech.category}
                    </span>
                    <span className="text-[13px] font-medium text-foreground flex-1">{tech.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-muted-foreground tabular-nums w-8 text-right">{tech.count}</span>
                      <div className="w-16 h-1 rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-foreground/20 group-hover:bg-foreground/40 transition-all duration-300"
                          style={{ width: `${Math.min((tech.count / (stats.topTechnologies[0]?.count ?? 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div>
          <Card className="border-border/60 bg-card/40 overflow-hidden h-full">
            <div className="px-5 pt-5 pb-4">
              <h3 className="text-[14px] font-semibold text-foreground tracking-tight">Firecrawl Status</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">Worker health & connectivity</p>
            </div>
            <div className="px-5 pb-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-muted-foreground">Service status</span>
                <StatusBadge
                  status={stats?.firecrawl.available ? "healthy" : stats?.firecrawl.configured ? "degraded" : "unhealthy"}
                />
              </div>
              {stats?.firecrawl.latencyMs != null && (
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] text-muted-foreground">Latency</span>
                  <span className="text-[12.5px] font-medium text-foreground tabular-nums">{stats.firecrawl.latencyMs}ms</span>
                </div>
              )}
              {stats?.firecrawl.version && (
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] text-muted-foreground">Version</span>
                  <span className="text-[12.5px] font-medium text-foreground tabular-nums">v{stats.firecrawl.version}</span>
                </div>
              )}
              {stats?.firecrawl.lastCrawl && (
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] text-muted-foreground">Last crawl</span>
                  <span className="text-[12.5px] font-medium text-foreground tabular-nums">{formatRelativeTime(stats.firecrawl.lastCrawl)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-muted-foreground">Worker</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-normal border-0 px-2 py-0.5 rounded-md",
                    stats?.worker?.running
                      ? "bg-success/10 text-success"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <span className="w-1 h-1 rounded-full bg-current mr-1.5" />
                  {stats?.worker?.running ? "Running" : "Stopped"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-muted-foreground">Active jobs</span>
                <span className="text-[12.5px] font-medium text-foreground tabular-nums">{stats?.worker?.activeJobCount ?? 0} / 2</span>
              </div>

              <div className="pt-2 border-t border-border/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Worker Capacity</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {stats?.worker?.activeJobCount ?? 0}/{2}
                  </span>
                </div>
                <Progress
                  value={((stats?.worker?.activeJobCount ?? 0) / 2) * 100}
                  className="h-1.5 [&>div]:bg-foreground/40"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Section
        title="Enrichment Jobs"
        description={
          <span className="flex items-center gap-2">
            {jobsData?.data?.length ?? 0} jobs
            {activeCount > 0 && (
              <span className="text-info flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-info opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-info" />
                </span>
                {activeCount} active
              </span>
            )}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-[12px] w-[140px] border-border/60 bg-background/50">
                <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1.5" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {jobsLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            <p className="text-[12.5px] text-muted-foreground font-medium">Loading enrichment jobs…</p>
          </div>
        ) : !jobsData?.data || jobsData.data.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="text-[14px] font-semibold text-foreground mb-1.5">No enrichment jobs yet</h3>
            <p className="text-[12.5px] text-muted-foreground max-w-sm mb-5 leading-relaxed">
              Enrich discovered companies to extract website data, detect technologies, and capture pricing information.
            </p>
            <EnrichAllDialog />
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span className="pl-7">Company / Status</span>
              <span className="pr-2 text-right">Actions</span>
            </div>
            {filteredJobs.map((job) => (
              <EnrichJobCard
                key={job.id}
                job={job}
                expanded={expandedJob === job.id}
                onToggle={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
              />
            ))}
            {filteredJobs.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-[12.5px] text-muted-foreground">No jobs match this filter.</p>
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

function EnrichAllDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const { data: stats } = useQuery({
    queryKey: ["enrich", "stats"],
    queryFn: () => apiClient.get<{ companies: { pending: number } }>("/enrich/stats"),
  });

  const bulkMutation = useMutation({
    mutationFn: () => apiClient.post<{ enqueued: number; total: number; jobs: unknown[] }>("/enrich/bulk"),
    onSuccess: (result) => {
      toast({
        title: `Enrichment enqueued`,
        description: `${result.enqueued} companies enqueued for enrichment.`,
      });
      queryClient.invalidateQueries({ queryKey: ["enrich"] });
      setOpen(false);
    },
    onError: (err) => {
      toast({
        title: "Failed to start enrichment",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const pendingCount = stats?.companies.pending ?? 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 h-8 text-[12px] font-medium" disabled={pendingCount === 0}>
          <Zap className="w-3.5 h-3.5" />
          Enrich all
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">Enrich all unenriched companies?</DialogTitle>
        </DialogHeader>
        <div className="py-3 space-y-3">
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            This will create enrichment jobs for every company that has not yet been enriched.
            The worker processes jobs concurrently (up to 2 at a time).
          </p>
          <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3.5 bg-muted/20">
            <div className="w-8 h-8 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="text-[13px] font-medium text-foreground">
              {pendingCount} {pendingCount === 1 ? "company" : "companies"} pending enrichment
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => bulkMutation.mutate()}
            disabled={bulkMutation.isPending || pendingCount === 0}
            className="gap-1.5 h-8 text-[12px] font-medium"
          >
            {bulkMutation.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />Enqueuing…</>
            ) : (
              <><Zap className="w-3.5 h-3.5" />Start enrichment</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
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

  const progress = job.pagesCrawled > 0 && isActive ? Math.min((job.pagesCrawled / 20) * 100, 100) : null;

  return (
    <Card className={cn(
      "border-border/60 bg-card/40 overflow-hidden transition-all duration-200",
      job.status === "RUNNING" && "ring-1 ring-info/20",
      expanded && "bg-card/60"
    )}>
      <div className={cn(
        "px-4 py-3.5 flex items-center gap-3 transition-colors duration-200",
        "hover:bg-muted/20 cursor-pointer",
        expanded && "bg-muted/10"
      )} onClick={onToggle}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <EnrichStatusIcon status={job.status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-semibold text-foreground truncate tracking-tight">
              {job.company?.name ?? "Unknown company"}
            </span>
            <StatusBadge status={job.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11.5px] text-muted-foreground">
            <span className="truncate max-w-[200px]">{job.company?.domain ?? "—"}</span>
            {job.pagesCrawled > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="tabular-nums">{job.pagesCrawled} pages</span>
              </>
            )}
            {job.technologiesFound > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="tabular-nums">{job.technologiesFound} techs</span>
              </>
            )}
            {job.durationMs && (
              <>
                <span className="text-border">·</span>
                <span className="tabular-nums">{(job.durationMs / 1000).toFixed(1)}s</span>
              </>
            )}
            <span className="text-border">·</span>
            <span className="tabular-nums">{formatRelativeTime(job.createdAt)}</span>
          </div>
          {progress !== null && (
            <div className="mt-2">
              <div className="h-1 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-info/60 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {job.status === "RUNNING" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  onClick={(e) => { e.stopPropagation(); action.mutate("pause"); }}
                >
                  <Pause className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pause</TooltipContent>
            </Tooltip>
          )}
          {job.status === "PAUSED" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  onClick={(e) => { e.stopPropagation(); action.mutate("resume"); }}
                >
                  <Play className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Resume</TooltipContent>
            </Tooltip>
          )}
          {(job.status === "FAILED" || job.status === "COMPLETED" || job.status === "CANCELLED") && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  onClick={(e) => { e.stopPropagation(); action.mutate("retry"); }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retry</TooltipContent>
            </Tooltip>
          )}
          {isActive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => { e.stopPropagation(); action.mutate("cancel"); }}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cancel</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {job.errorMessage && (
        <div className="px-4 pb-2.5 pt-1 text-[11.5px] text-destructive bg-destructive/[0.03] border-t border-border/30">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{job.errorMessage}</span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
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
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border/40 bg-muted/10">
        <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Enrichment Logs</span>
        <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">{logs.length} entries</span>
      </div>
      <div className="max-h-72 overflow-y-auto p-3 font-mono text-[11px] space-y-0">
        {isLoading ? (
          <div className="text-muted-foreground text-center py-6 text-[12.5px]">Loading logs…</div>
        ) : logs.length === 0 ? (
          <div className="text-muted-foreground text-center py-6 text-[12.5px]">No logs yet</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2.5 hover:bg-muted/30 rounded-md px-2 py-1 transition-colors">
              <span className="text-muted-foreground/70 shrink-0 tabular-nums text-[10.5px] pt-0.5">
                {new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false })}
              </span>
              <span className={cn(
                "shrink-0 font-semibold text-[10.5px] w-11",
                log.level === "ERROR" && "text-destructive",
                log.level === "WARN" && "text-warning",
                log.level === "INFO" && "text-info",
                log.level === "DEBUG" && "text-muted-foreground"
              )}>
                {log.level}
              </span>
              {log.page && (
                <Badge variant="outline" className="text-[9px] py-0 h-4 shrink-0 font-mono border-border/50">
                  {log.page}
                </Badge>
              )}
              <span className="text-foreground/90 text-[11px] leading-relaxed">{log.message}</span>
              {log.durationMs && (
                <span className="text-muted-foreground text-[10px] ml-auto shrink-0 tabular-nums">{log.durationMs}ms</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
