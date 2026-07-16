"use client";

/**
 * Discover page — premium redesign with beautiful job tracking.
 *
 * Features:
 *  - Modern progress visualization with timeline
 *  - Animated progress bars
 *  - Beautiful status badges
 *  - Refined job cards with hover effects
 *  - Smooth expand/collapse for logs
 *  - Better empty state
 */

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Play,
  Pause,
  RotateCcw,
  X,
  ChevronDown,
  ChevronRight,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Terminal,
  Zap,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { Card } from "@/components/ui/card";
import { AnimatedList } from "@/components/animations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn, formatRelativeTime, formatNumber, formatPercent } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiscoveryJob {
  id: string;
  name: string;
  status: "QUEUED" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED" | "RETRYING";
  sources: string[];
  maxCompanies: number;
  keywords: string[];
  hiringOnly: boolean;
  dateFrom: string | null;
  dateTo: string | null;
  companiesFound: number;
  companiesStored: number;
  duplicatesFound: number;
  errorsCount: number;
  retriesCount: number;
  currentSource: string | null;
  currentPage: number;
  totalPages: number;
  startedAt: string | null;
  completedAt: string | null;
  lastHeartbeat: string | null;
  estimatedCompletion: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { logs: number; jobSources: number };
}

interface DiscoveryLog {
  id: string;
  jobId: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  source: string | null;
  message: string;
  metadata: unknown;
  createdAt: string;
}

interface SourceMeta {
  id: string;
  label: string;
  description: string;
  rateLimitPerSec: number;
}

interface DiscoverStats {
  companies: { total: number; today: number };
  jobs: { total: number; today: number; running: number; completed: number; failed: number; queued: number; paused: number };
  avgRuntimeMs: number;
  sourceDistribution: Array<{ source: string; count: number }>;
  recentDiscoveries: Array<{
    id: string; name: string; domain: string | null; description: string | null;
    country: string | null; industry: string | null; discoveredAt: string; source: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DiscoverPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [expandedJob, setExpandedJob] = React.useState<string | null>(null);

  // Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["discover", "stats"],
    queryFn: () => apiClient.get<DiscoverStats>("/discover/stats"),
    refetchInterval: 5_000,
  });

  // Jobs list
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["discover", "jobs"],
    queryFn: () => apiClient.get<{ data: DiscoveryJob[] }>("/discover/jobs", { limit: 50 }),
    refetchInterval: (query) => {
      const jobs = query.state.data?.data ?? [];
      const hasActive = jobs.some((j) => j.status === "RUNNING" || j.status === "QUEUED" || j.status === "RETRYING");
      return hasActive ? 3_000 : 15_000;
    },
  });

  const jobs = jobsData?.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Discover"
        description="Create discovery jobs to find companies from public sources."
        actions={
          <CreateJobDialog open={createOpen} onOpenChange={setCreateOpen} />
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Companies"
          value={stats?.companies.total ?? 0}
          format="compact"
          icon={Activity}
          loading={statsLoading}
        />
        <StatCard
          label="Discovered Today"
          value={stats?.companies.today ?? 0}
          format="compact"
          icon={Zap}
          loading={statsLoading}
        />
        <StatCard
          label="Running Jobs"
          value={stats?.jobs.running ?? 0}
          format="raw"
          icon={Loader2}
          loading={statsLoading}
        />
        <StatCard
          label="Completed Jobs"
          value={stats?.jobs.completed ?? 0}
          format="compact"
          icon={CheckCircle2}
          loading={statsLoading}
        />
      </div>

      {/* Jobs list */}
      <Section
        title="Discovery Jobs"
        description={`${jobs.length} job${jobs.length === 1 ? "" : "s"}`}
        actions={
          <CreateJobButton />
        }
      >
        {jobsLoading ? (
          <div className="py-12 text-center text-muted-foreground text-[13px]">
            Loading jobs…
          </div>
        ) : jobs.length === 0 ? (
          <Card className="p-10 text-center border-dashed border-border/60">
            <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-4 text-muted-foreground/60">
              <Activity className="w-7 h-7" />
            </div>
            <h3 className="text-[15px] font-semibold text-foreground mb-2">
              No discovery jobs yet
            </h3>
            <p className="text-[13px] text-muted-foreground mb-5 max-w-sm mx-auto leading-relaxed">
              Create your first discovery job to start finding companies from Hacker News, Product Hunt, and other sources.
            </p>
            <CreateJobButton />
          </Card>
        ) : (
          <div className="space-y-2.5">
            <AnimatedList>
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  expanded={expandedJob === job.id}
                  onToggle={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                />
              ))}
            </AnimatedList>
          </div>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Job Button
// ---------------------------------------------------------------------------

function CreateJobButton() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Create discovery job
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <CreateJobForm />
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Create Job Dialog
// ---------------------------------------------------------------------------

function CreateJobDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Create job
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <CreateJobForm onCreated={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateJobForm({ onCreated }: { onCreated?: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sourcesData } = useQuery({
    queryKey: ["sources"],
    queryFn: () => apiClient.get<{ data: SourceMeta[] }>("/sources"),
  });
  const sources = sourcesData?.data ?? [];

  const [name, setName] = React.useState("");
  const [selectedSources, setSelectedSources] = React.useState<string[]>([]);
  const [maxCompanies, setMaxCompanies] = React.useState(50);
  const [keywords, setKeywords] = React.useState("");
  const [hiringOnly, setHiringOnly] = React.useState(false);

  const createMutation = useMutation({
    mutationFn: (input: {
      name: string;
      sources: string[];
      maxCompanies: number;
      keywords: string[];
      hiringOnly: boolean;
    }) => apiClient.post<{ job: DiscoveryJob }>("/discover/jobs", input),
    onSuccess: () => {
      toast({ title: "Job created", description: "Discovery job queued — worker will start within 5 seconds." });
      queryClient.invalidateQueries({ queryKey: ["discover", "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["discover", "stats"] });
      onCreated?.();
      setName("");
      setSelectedSources([]);
      setMaxCompanies(50);
      setKeywords("");
      setHiringOnly(false);
    },
    onError: (err) => {
      toast({
        title: "Failed to create job",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const toggleSource = (id: string) => {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      sources: selectedSources,
      maxCompanies,
      keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      hiringOnly,
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-[16px] font-semibold">Create discovery job</DialogTitle>
      </DialogHeader>
      <div className="space-y-5 py-2">
        {/* Name */}
        <div className="space-y-1.5">
          <Label className="text-[12.5px] font-medium">Job name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. AI tools — Show HN + Product Hunt"
            className="h-9 text-[13px]"
          />
        </div>

        {/* Sources */}
        <div className="space-y-2">
          <Label className="text-[12.5px] font-medium">
            Sources {selectedSources.length === 0 && (
              <span className="text-muted-foreground font-normal ml-1">(all sources will be used)</span>
            )}
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {sources.map((source) => (
              <label
                key={source.id}
                className={cn(
                  "flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all duration-200",
                  selectedSources.includes(source.id)
                    ? "border-foreground/20 bg-foreground/5"
                    : "border-border/60 hover:bg-muted/30 hover:border-border"
                )}
              >
                <Checkbox
                  checked={selectedSources.includes(source.id)}
                  onCheckedChange={() => toggleSource(source.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-foreground">{source.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{source.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Max companies */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-medium">Max companies</Label>
            <Input
              type="number"
              value={maxCompanies}
              onChange={(e) => setMaxCompanies(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
              min={1}
              max={500}
              className="h-9 text-[13px]"
            />
            <p className="text-[11px] text-muted-foreground">Per job (1-500)</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-medium">Keywords (optional)</Label>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="AI, developer tools, SaaS"
              className="h-9 text-[13px]"
            />
            <p className="text-[11px] text-muted-foreground">Comma-separated</p>
          </div>
        </div>

        {/* Hiring only */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox checked={hiringOnly} onCheckedChange={(v) => setHiringOnly(v === true)} />
          <div>
            <span className="text-[12.5px] font-medium text-foreground">Hiring only</span>
            <span className="text-[11px] text-muted-foreground ml-2">Only return companies that are actively hiring</span>
          </div>
        </label>
      </div>

      <DialogFooter>
        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          className="gap-1.5"
        >
          {createMutation.isPending ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating…</>
          ) : (
            <><Plus className="w-3.5 h-3.5" />Create job</>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------
// Job Card
// ---------------------------------------------------------------------------

function JobCard({
  job,
  expanded,
  onToggle,
}: {
  job: DiscoveryJob;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["discover", "jobs"] });
    queryClient.invalidateQueries({ queryKey: ["discover", "stats"] });
  };

  const action = useMutation({
    mutationFn: async (action: "pause" | "resume" | "retry" | "cancel") => {
      if (action === "cancel") {
        return apiClient.delete(`/discover/jobs/${job.id}`);
      }
      return apiClient.post(`/discover/jobs/${job.id}/${action}`);
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
  const progressPct = job.maxCompanies > 0
    ? Math.min(100, (job.companiesFound / job.maxCompanies) * 100)
    : 0;
  const storedPct = job.companiesFound > 0
    ? (job.companiesStored / job.companiesFound) * 100
    : 0;

  return (
    <Card className={cn(
      "border-border/60 bg-card/40 overflow-hidden transition-all duration-200",
      job.status === "RUNNING" && "ring-1 ring-info/20 shadow-premium"
    )}>
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110 shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <StatusIcon status={job.status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-semibold text-foreground truncate">{job.name}</span>
            <StatusBadge status={job.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11.5px] text-muted-foreground flex-wrap">
            <span>{job.sources.length > 0 ? `${job.sources.length} source${job.sources.length === 1 ? "" : "s"}` : "All sources"}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{formatNumber(job.companiesStored)} stored</span>
            {job.duplicatesFound > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{formatNumber(job.duplicatesFound)} dupes</span>
              </>
            )}
            {job.errorsCount > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-destructive">{job.errorsCount} errors</span>
              </>
            )}
            <span className="text-muted-foreground/40">·</span>
            <span>{formatRelativeTime(job.createdAt)}</span>
            {job.lastHeartbeat && isActive && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-success flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  {formatRelativeTime(job.lastHeartbeat)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {job.status === "RUNNING" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => action.mutate("pause")}>
                  <Pause className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pause</TooltipContent>
            </Tooltip>
          )}
          {job.status === "PAUSED" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => action.mutate("resume")}>
                  <Play className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Resume</TooltipContent>
            </Tooltip>
          )}
          {(job.status === "FAILED" || job.status === "COMPLETED" || job.status === "CANCELLED") && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => action.mutate("retry")}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retry</TooltipContent>
            </Tooltip>
          )}
          {isActive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => action.mutate("cancel")}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cancel</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Progress bar (for running jobs) */}
      {isActive && job.maxCompanies > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
            <span className="font-medium">{job.currentSource ? `Source: ${job.currentSource}` : "Waiting…"}</span>
            <span className="tabular-nums font-semibold">{job.companiesFound}/{job.maxCompanies} found · {progressPct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="bg-info h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          {job.estimatedCompletion && (
            <div className="text-[10.5px] text-muted-foreground mt-1.5 font-medium">
              ETA: {formatRelativeTime(job.estimatedCompletion)}
            </div>
          )}
        </div>
      )}

      {/* Expanded: logs */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <JobLogs jobId={job.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Status Icon
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: DiscoveryJob["status"] }) {
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

// ---------------------------------------------------------------------------
// Job Logs
// ---------------------------------------------------------------------------

function JobLogs({ jobId }: { jobId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["discover", "jobs", jobId, "logs"],
    queryFn: () => apiClient.get<{ data: DiscoveryLog[] }>(`/discover/jobs/${jobId}/logs`, { limit: 100 }),
    refetchInterval: 3_000,
  });

  const logs = (data?.data ?? []).reverse(); // newest at bottom

  return (
    <div className="border-t border-border/60 bg-background/40">
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border/40">
        <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[11.5px] font-medium text-muted-foreground uppercase tracking-wide">Logs</span>
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
                {new Date(log.createdAt).toLocaleTimeString("en-US", { hour12: false })}
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
              {log.source && (
                <Badge variant="outline" className="text-[9px] py-0 h-4 shrink-0 font-mono">
                  {log.source}
                </Badge>
              )}
              <span className="text-foreground/90">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
