"use client";

/**
 * System page — Phase 3: live Firecrawl, discovery + enrichment worker status.
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
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import { formatRelativeTime, cn } from "@/lib/utils";

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

export function SystemPage() {
  const { data: health, isLoading, refetch } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient.get<HealthResponse>("/health"),
    refetchInterval: 5_000,
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="System"
        description="Live status of all services, workers, and the enrichment pipeline."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
            <span className="text-[11.5px] text-muted-foreground">Auto-refreshes every 5s</span>
          </>
        }
      />

      {/* Health summary */}
      <Card
        className={cn(
          "p-5 mb-6 border-border/60 flex items-center gap-4",
          health?.status === "healthy" && "bg-success/[0.04]",
          health?.status === "degraded" && "bg-warning/[0.04]",
          health?.status === "unhealthy" && "bg-destructive/[0.04]"
        )}
      >
        {isLoading ? (
          <Skeleton className="w-10 h-10 rounded-full" />
        ) : health?.status === "healthy" ? (
          <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-warning">
            <AlertCircle className="w-5 h-5" />
          </div>
        )}
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-foreground">
            {isLoading ? "Checking system status…" : health?.status === "healthy" ? "All systems operational" : "System is degraded"}
          </div>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            {health
              ? `Version ${health.version} · Uptime ${formatUptime(health.uptime)} · Last checked ${formatRelativeTime(health.timestamp)}`
              : "Loading…"}
          </div>
        </div>
      </Card>

      {/* Worker details */}
      {health?.workers && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Discovery worker */}
          <Card className="p-5 border-border/60 bg-card/40">
            <Section title="Discovery Worker" description="Background worker for company discovery">
              <div className="grid grid-cols-2 gap-4">
                <WorkerStat label="Worker ID" value={health.workers.discovery.workerId} mono />
                <WorkerStat
                  label="Status"
                  value={health.workers.discovery.running ? "Running" : "Stopped"}
                  tone={health.workers.discovery.running ? "success" : "danger"}
                />
                <WorkerStat label="Active Jobs" value={String(health.workers.discovery.activeJobCount)} />
                <WorkerStat label="Queue Size" value={String(health.workers.discovery.queueSize)} />
                <WorkerStat label="Current Job" value={health.workers.discovery.currentJob ?? "—"} mono={!!health.workers.discovery.currentJob} />
                <WorkerStat
                  label="Last Heartbeat"
                  value={health.workers.discovery.lastHeartbeat ? formatRelativeTime(health.workers.discovery.lastHeartbeat) : "—"}
                />
                <WorkerStat label="Memory (RSS)" value={formatBytes(health.workers.discovery.memory.rss)} />
                <WorkerStat label="Heap Used" value={formatBytes(health.workers.discovery.memory.heapUsed)} />
              </div>
              {health.workers.discovery.activeJobs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/60">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Active Job IDs</div>
                  <div className="space-y-1">
                    {health.workers.discovery.activeJobs.map((jobId) => (
                      <div key={jobId} className="text-[11.5px] font-mono text-foreground flex items-center gap-2">
                        <Clock className="w-3 h-3 text-info animate-pulse" />
                        {jobId}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          </Card>

          {/* Enrichment worker */}
          <Card className="p-5 border-border/60 bg-card/40">
            <Section title="Enrichment Worker" description="Background worker for website enrichment">
              <div className="grid grid-cols-2 gap-4">
                <WorkerStat label="Worker ID" value={health.workers.enrichment.workerId} mono />
                <WorkerStat
                  label="Status"
                  value={health.workers.enrichment.running ? "Running" : "Stopped"}
                  tone={health.workers.enrichment.running ? "success" : "danger"}
                />
                <WorkerStat label="Active Jobs" value={String(health.workers.enrichment.activeJobCount)} />
                <WorkerStat label="Queue Size" value={String(health.workers.enrichment.queueSize)} />
                <WorkerStat label="Current Job" value={health.workers.enrichment.currentJob ?? "—"} mono={!!health.workers.enrichment.currentJob} />
                <WorkerStat
                  label="Last Heartbeat"
                  value={health.workers.enrichment.lastHeartbeat ? formatRelativeTime(health.workers.enrichment.lastHeartbeat) : "—"}
                />
                <WorkerStat label="Memory (RSS)" value={formatBytes(health.workers.enrichment.memory.rss)} />
                <WorkerStat label="Heap Used" value={formatBytes(health.workers.enrichment.memory.heapUsed)} />
              </div>
              {health.workers.enrichment.activeJobs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/60">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Active Job IDs</div>
                  <div className="space-y-1">
                    {health.workers.enrichment.activeJobs.map((jobId) => (
                      <div key={jobId} className="text-[11.5px] font-mono text-foreground flex items-center gap-2">
                        <Clock className="w-3 h-3 text-info animate-pulse" />
                        {jobId}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          </Card>
        </div>
      )}

      {/* Service cards */}
      <Section title="Services" className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(SERVICE_META).map(([key, meta], i) => {
            const service = health?.services[key];
            const Icon = meta.icon;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
              >
                <Card className="p-4 border-border/60 bg-card/40">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-8 h-8 rounded-md bg-muted/40 flex items-center justify-center text-foreground">
                      <Icon className="w-4 h-4" />
                    </div>
                    {isLoading ? (
                      <Skeleton className="w-12 h-5" />
                    ) : (
                      <StatusBadge status={service?.status ?? "pending"} />
                    )}
                  </div>
                  <div className="text-[13.5px] font-semibold text-foreground">{meta.label}</div>
                  <div className="text-[11.5px] text-muted-foreground">{meta.description}</div>
                  {service?.latencyMs !== undefined && (
                    <div className="mt-2 text-[10.5px] text-muted-foreground tabular-nums">
                      {service.latencyMs}ms latency
                    </div>
                  )}
                  {service?.details && (
                    <div className="mt-1 text-[10.5px] text-muted-foreground">{service.details}</div>
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
      <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</div>
      <div className={cn("text-[13px] font-semibold truncate", toneClass, mono && "font-mono text-[11.5px]")}>
        {value}
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
