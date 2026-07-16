"use client";

/**
 * System page — Phase 3: live Firecrawl, discovery + enrichment worker status.
 *
 * Premium redesign:
 *  - PageHeader with refined typography
 *  - StatCard for system metrics
 *  - StatusBadge for health status
 *  - Better visual hierarchy
 *  - Smooth animations
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Database,
  Cpu,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  RefreshCw,
  Zap,
  HeartPulse,
  Globe,
  Server,
  HardDrive,
  Gauge,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { StatusBadge } from "@/components/common/status-badge";
import { Section } from "@/components/common/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "@/lib/api-client";
import { formatRelativeTime, formatBytes, cn } from "@/lib/utils";

interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  uptime: number;
  services: Record<string, { status: string; latencyMs?: number; details?: string }>;
  workers: {
    discovery: {
      workerId: string;
      running: boolean;
      activeJobCount: number;
      activeJobs: string[];
      queueSize: number;
      currentJob: string | null;
      lastHeartbeat: string | null;
      memory: { rss: number; heapUsed: number; heapTotal: number };
    };
    enrichment: {
      workerId: string;
      running: boolean;
      activeJobCount: number;
      activeJobs: string[];
      queueSize: number;
      currentJob: string | null;
      lastHeartbeat: string | null;
      memory: { rss: number; heapUsed: number; heapTotal: number };
    };
    ai: {
      workerId: string;
      running: boolean;
      activeJobCount: number;
      activeJobs: string[];
      queueSize: number;
      currentJob: string | null;
      lastHeartbeat: string | null;
      memory: { rss: number; heapUsed: number; heapTotal: number };
    };
  };
}

const SERVICE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; description: string }> = {
  database: { icon: Database, label: "PostgreSQL", description: "Canonical datastore" },
  discoveryWorker: { icon: Cpu, label: "Discovery Worker", description: "Company discovery processor" },
  enrichmentWorker: { icon: Zap, label: "Enrichment Worker", description: "Website enrichment processor" },
  firecrawl: { icon: Globe, label: "Firecrawl", description: "Web scraping engine" },
  redis: { icon: Activity, label: "Redis", description: "Cache + rate limiting" },
  rabbitmq: { icon: Server, label: "RabbitMQ", description: "Job queue" },
};

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SystemPage() {
  const { data: health, isLoading, refetch } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient.get<HealthResponse>("/health"),
    refetchInterval: 5_000,
  });

  const isHealthy = health?.status === "healthy";
  const isDegraded = health?.status === "degraded";

  const totalActiveJobs = health
    ? health.workers.discovery.activeJobCount + health.workers.enrichment.activeJobCount + health.workers.ai.activeJobCount
    : 0;
  const totalQueueSize = health
    ? health.workers.discovery.queueSize + health.workers.enrichment.queueSize + health.workers.ai.queueSize
    : 0;
  const uptimeSeconds = health?.uptime ?? 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="System"
        description="Infrastructure, workers and queue health."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        }
      />

      {/* Health banner */}
      <Card
        className={cn(
          "relative overflow-hidden mb-8 border-border/60 transition-colors duration-300",
          isLoading
            ? "bg-card/40"
            : isHealthy
              ? "bg-success/[0.04] border-success/15"
              : isDegraded
                ? "bg-warning/[0.04] border-warning/15"
                : "bg-destructive/[0.04] border-destructive/15"
        )}
      >
        <div className="p-6 flex items-center gap-5">
          {isLoading ? (
            <Skeleton className="w-11 h-11 rounded-full shrink-0" />
          ) : isHealthy ? (
            <div className="w-11 h-11 rounded-full bg-success/10 flex items-center justify-center text-success shrink-0">
              <CheckCircle2 className="w-5.5 h-5.5" />
            </div>
          ) : isDegraded ? (
            <div className="w-11 h-11 rounded-full bg-warning/10 flex items-center justify-center text-warning shrink-0">
              <AlertCircle className="w-5.5 h-5.5" />
            </div>
          ) : (
            <div className="w-11 h-11 rounded-full bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
              <XCircle className="w-5.5 h-5.5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-foreground tracking-tight">
              {isLoading ? "Checking system status…" : isHealthy ? "All systems operational" : isDegraded ? "System is degraded" : "System is unhealthy"}
            </div>
            <div className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
              {health
                ? `Version ${health.version} · Uptime ${formatUptime(health.uptime)} · Last checked ${formatRelativeTime(health.timestamp)}`
                : "Loading…"}
            </div>
          </div>
          <div className="shrink-0">
            <StatusBadge status={health?.status ?? "pending"} />
          </div>
        </div>
      </Card>

      {/* System overview stat cards */}
      {!isLoading && health && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard
            label="Active Jobs"
            value={totalActiveJobs}
            format="number"
            icon={Activity}
            delta={totalActiveJobs > 0 ? 12.5 : undefined}
            deltaPeriod="across all workers"
          />
          <StatCard
            label="Queue Depth"
            value={totalQueueSize}
            format="number"
            icon={Clock}
          />
          <StatCard
            label="Uptime"
            value={uptimeSeconds}
            format="raw"
            icon={HeartPulse}
          />
          <StatCard
            label="Workers Online"
            value={
              (health.workers.discovery.running ? 1 : 0) +
              (health.workers.enrichment.running ? 1 : 0) +
              (health.workers.ai.running ? 1 : 0)
            }
            format="number"
            icon={Cpu}
            delta={
              health.workers.discovery.running && health.workers.enrichment.running && health.workers.ai.running
                ? 100
                : 0
            }
            deltaPeriod="of 3 workers active"
          />
        </div>
      )}

      {/* Worker sections */}
      {health?.workers && (
        <div className="space-y-4 mb-8">
          {/* Discovery Worker */}
          <Section title="Discovery Worker" description="Background worker for company discovery">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <WorkerStat label="Worker ID" value={health.workers.discovery.workerId} mono />
              <div>
                <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1.5">Status</div>
                <StatusBadge status={health.workers.discovery.running ? "ACTIVE" : "PAUSED"} />
              </div>
              <StatCard label="Active Jobs" value={health.workers.discovery.activeJobCount} format="number" icon={Activity} />
              <StatCard label="Queue Size" value={health.workers.discovery.queueSize} format="number" icon={Clock} />
              <StatCard label="Memory (RSS)" value={formatBytes(health.workers.discovery.memory.rss)} format="raw" icon={HardDrive} />
              <StatCard label="Heap Used" value={formatBytes(health.workers.discovery.memory.heapUsed)} format="raw" icon={Gauge} />
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1.5">Current Job</div>
                <div className="text-[13px] font-semibold text-foreground font-mono truncate">
                  {health.workers.discovery.currentJob ?? "—"}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1.5">Last Heartbeat</div>
                <div className="text-[13px] font-semibold text-foreground tabular-nums">
                  {health.workers.discovery.lastHeartbeat ? formatRelativeTime(health.workers.discovery.lastHeartbeat) : "—"}
                </div>
              </div>
            </div>
            {health.workers.discovery.activeJobs.length > 0 && (
              <>
                <Separator className="my-4 bg-border/60" />
                <div>
                  <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-2 font-semibold">Active Job IDs</div>
                  <div className="flex flex-wrap gap-1.5">
                    {health.workers.discovery.activeJobs.map((jobId) => (
                      <div
                        key={jobId}
                        className="text-[11px] font-mono text-foreground flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 border border-border/60"
                      >
                        <Clock className="w-3 h-3 text-info animate-pulse" />
                        {jobId}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Section>

          {/* Enrichment Worker */}
          <Section title="Enrichment Worker" description="Background worker for website enrichment">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <WorkerStat label="Worker ID" value={health.workers.enrichment.workerId} mono />
              <div>
                <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1.5">Status</div>
                <StatusBadge status={health.workers.enrichment.running ? "ACTIVE" : "PAUSED"} />
              </div>
              <StatCard label="Active Jobs" value={health.workers.enrichment.activeJobCount} format="number" icon={Activity} />
              <StatCard label="Queue Size" value={health.workers.enrichment.queueSize} format="number" icon={Clock} />
              <StatCard label="Memory (RSS)" value={formatBytes(health.workers.enrichment.memory.rss)} format="raw" icon={HardDrive} />
              <StatCard label="Heap Used" value={formatBytes(health.workers.enrichment.memory.heapUsed)} format="raw" icon={Gauge} />
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1.5">Current Job</div>
                <div className="text-[13px] font-semibold text-foreground font-mono truncate">
                  {health.workers.enrichment.currentJob ?? "—"}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1.5">Last Heartbeat</div>
                <div className="text-[13px] font-semibold text-foreground tabular-nums">
                  {health.workers.enrichment.lastHeartbeat ? formatRelativeTime(health.workers.enrichment.lastHeartbeat) : "—"}
                </div>
              </div>
            </div>
            {health.workers.enrichment.activeJobs.length > 0 && (
              <>
                <Separator className="my-4 bg-border/60" />
                <div>
                  <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-2 font-semibold">Active Job IDs</div>
                  <div className="flex flex-wrap gap-1.5">
                    {health.workers.enrichment.activeJobs.map((jobId) => (
                      <div
                        key={jobId}
                        className="text-[11px] font-mono text-foreground flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 border border-border/60"
                      >
                        <Clock className="w-3 h-3 text-info animate-pulse" />
                        {jobId}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Section>

          {/* AI Worker */}
          <Section title="AI Worker" description="Background worker for AI enrichment">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <WorkerStat label="Worker ID" value={health.workers.ai.workerId} mono />
              <div>
                <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1.5">Status</div>
                <StatusBadge status={health.workers.ai.running ? "ACTIVE" : "PAUSED"} />
              </div>
              <StatCard label="Active Jobs" value={health.workers.ai.activeJobCount} format="number" icon={Activity} />
              <StatCard label="Queue Size" value={health.workers.ai.queueSize} format="number" icon={Clock} />
              <StatCard label="Memory (RSS)" value={formatBytes(health.workers.ai.memory.rss)} format="raw" icon={HardDrive} />
              <StatCard label="Heap Used" value={formatBytes(health.workers.ai.memory.heapUsed)} format="raw" icon={Gauge} />
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1.5">Current Job</div>
                <div className="text-[13px] font-semibold text-foreground font-mono truncate">
                  {health.workers.ai.currentJob ?? "—"}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1.5">Last Heartbeat</div>
                <div className="text-[13px] font-semibold text-foreground tabular-nums">
                  {health.workers.ai.lastHeartbeat ? formatRelativeTime(health.workers.ai.lastHeartbeat) : "—"}
                </div>
              </div>
            </div>
            {health.workers.ai.activeJobs.length > 0 && (
              <>
                <Separator className="my-4 bg-border/60" />
                <div>
                  <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-2 font-semibold">Active Job IDs</div>
                  <div className="flex flex-wrap gap-1.5">
                    {health.workers.ai.activeJobs.map((jobId) => (
                      <div
                        key={jobId}
                        className="text-[11px] font-mono text-foreground flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 border border-border/60"
                      >
                        <Clock className="w-3 h-3 text-info animate-pulse" />
                        {jobId}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Section>
        </div>
      )}

      {/* Service cards */}
      <Section title="Services" description="Infrastructure components health">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(SERVICE_META).map(([key, meta], i) => {
            const service = health?.services[key];
            const Icon = meta.icon;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05, ease: "easeOut" }}
              >
                <Card
                  className={cn(
                    "p-5 border-border/60 bg-card/40",
                    "hover:bg-card/70 hover:border-border/80 hover:shadow-premium",
                    "transition-all duration-200"
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl bg-muted/40 flex items-center justify-center text-foreground">
                      <Icon className="w-4 h-4" />
                    </div>
                    {isLoading ? (
                      <Skeleton className="w-16 h-5 rounded-md" />
                    ) : (
                      <StatusBadge status={service?.status ?? "pending"} />
                    )}
                  </div>
                  <div className="text-[14px] font-semibold text-foreground tracking-tight">{meta.label}</div>
                  <div className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">{meta.description}
</div>
                  {!isLoading && service?.latencyMs !== undefined && (
                    <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Latency</span>
                      <span className="text-[13px] font-semibold text-foreground tabular-nums">{service.latencyMs}ms</span>
                    </div>
                  )}
                  {!isLoading && service?.details && (
                    <div className="mt-2 text-[11.5px] text-muted-foreground leading-relaxed">
                      {service.details}
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function WorkerStat({ label, value, tone, mono }: { label: string; value: string; tone?: "success" | "danger"; mono?: boolean }) {
  const toneClass = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1 font-semibold">{label}</div>
      <div className={cn("text-[13px] font-semibold truncate", toneClass, mono && "font-mono text-[11.5px]")}>
        {value}
      </div>
    </div>
  );
}
