"use client";

/**
 * Dashboard page — real discovery data from the database.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Zap,
  Activity,
  CheckCircle2,
  ArrowUpRight,
  Clock,
  Loader2,
  Compass,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Section } from "@/components/common/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarsChart } from "@/components/charts";
import { AnimatedGrid, AnimatedItem, AnimatedList } from "@/components/animations";
import { apiClient } from "@/lib/api-client";
import { formatRelativeTime, formatNumber, cn } from "@/lib/utils";
import { routeHref } from "@/lib/routes";

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

interface EnrichStats {
  companies: { total: number; enriched: number; pending: number };
  jobs: { total: number; running: number; completed: number; failed: number; queued: number };
  avgCrawlMs: number;
  successRate: number;
  firecrawl: { configured: boolean; available: boolean; latencyMs?: number; error?: string };
  topTechnologies: Array<{ name: string; category: string; count: number }>;
  recentEnrichments: Array<{
    id: string; name: string; domain: string | null; logoUrl: string | null;
    lastEnrichedAt: string; enrichmentPages: number | null;
  }>;
}

interface AIStats {
  total: number;
  avgIcpMatch: number;
  avgQualification: number;
  avgVideoOpportunity: number;
  avgConfidence: number;
  pendingAnalysis: number;
  worker: { running: boolean; activeJobCount: number };
  latestAnalyses: Array<{
    companyId: string; companyName: string; companyDomain: string | null;
    icpMatch: number | null; qualification: number | null; confidence: number | null;
    industry: string | null; analyzedAt: string;
  }>;
}

const SOURCE_LABELS: Record<string, string> = {
  HACKER_NEWS: "Hacker News",
  PRODUCT_HUNT: "Product Hunt",
  YC: "Y Combinator",
  BETALIST: "BetaList",
  DEVHUNT: "DevHunt",
  UNEED: "Uneed",
  GITHUB_TRENDING: "GitHub Trending",
  PEERLIST: "Peerlist",
  INDIE_HACKERS: "Indie Hackers",
  MICROLAUNCH: "MicroLaunch",
  SEC_EDGAR: "SEC EDGAR",
  GREENHOUSE: "Greenhouse",
  LEVER: "Lever",
  ASHBY: "Ashby",
  MANUAL: "Manual",
  API: "API",
};

export function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["discover", "stats"],
    queryFn: () => apiClient.get<DiscoverStats>("/discover/stats"),
    refetchInterval: 10_000,
  });

  const { data: enrichStats, isLoading: enrichLoading } = useQuery({
    queryKey: ["enrich", "stats"],
    queryFn: () => apiClient.get<EnrichStats>("/enrich/stats"),
    refetchInterval: 10_000,
  });

  const { data: aiStats, isLoading: aiLoading } = useQuery({
    queryKey: ["ai", "stats"],
    queryFn: () => apiClient.get<AIStats>("/ai/stats"),
    refetchInterval: 10_000,
  });

  const sourceData = React.useMemo(() => {
    if (!stats) return [];
    return stats.sourceDistribution
      .map((s) => ({ label: SOURCE_LABELS[s.source] ?? s.source, value: s.count }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Dashboard"
        description="Real-time discovery metrics from your lead pipeline."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={routeHref("discover")}>
              <Compass className="w-3.5 h-3.5" />
              New discovery
            </a>
          </Button>
        }
      />

      <AnimatedGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="Companies Discovered" value={stats?.companies.total ?? 0} format="compact" icon={Building2} loading={isLoading} />
        <StatCard label="Discovered Today" value={stats?.companies.today ?? 0} format="compact" icon={Zap} loading={isLoading} />
        <StatCard label="Running Jobs" value={stats?.jobs.running ?? 0} format="raw" icon={stats?.jobs.running ? Loader2 : Activity} loading={isLoading} />
        <StatCard label="Completed Jobs" value={stats?.jobs.completed ?? 0} format="compact" icon={CheckCircle2} loading={isLoading} />
      </AnimatedGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <AnimatedItem index={0} className="lg:col-span-2">
          <Card className="p-5 border-border/60 bg-card/40">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-[14px] font-semibold text-foreground">Source Distribution</h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">Companies discovered per source</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-[11.5px]" asChild>
                <a href={routeHref("companies")}>
                  View all <ArrowUpRight className="w-3 h-3 ml-1" />
                </a>
              </Button>
            </div>
            {isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : sourceData.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-[13px] text-muted-foreground">No data yet — run a discovery job to see metrics</div>
            ) : (
              <BarsChart data={sourceData} layout="vertical" height={240} />
            )}
          </Card>
        </AnimatedItem>

        <AnimatedItem index={1}>
          <Card className="p-5 border-border/60 bg-card/40">
            <div className="mb-4">
              <h3 className="text-[14px] font-semibold text-foreground">Job Status</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">Discovery pipeline</p>
            </div>
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
            ) : (
              <div className="space-y-3">
                <StatRow label="Total jobs" value={stats?.jobs.total ?? 0} icon={Activity} />
                <StatRow label="Queued" value={stats?.jobs.queued ?? 0} icon={Clock} tone="info" />
                <StatRow label="Running" value={stats?.jobs.running ?? 0} icon={Loader2} tone="info" />
                <StatRow label="Completed" value={stats?.jobs.completed ?? 0} icon={CheckCircle2} tone="success" />
                <StatRow label="Failed" value={stats?.jobs.failed ?? 0} icon={Activity} tone="danger" />
                <div className="pt-3 mt-3 border-t border-border/60">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-muted-foreground">Avg runtime</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {stats && stats.avgRuntimeMs > 0 ? formatDuration(stats.avgRuntimeMs) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </AnimatedItem>

        <AnimatedItem index={2}>
          <Card className="p-5 border-border/60 bg-card/40">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-foreground">Enrichment</h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">Website crawling pipeline</p>
              </div>
              <a href={routeHref("enrich")}>
                <Button variant="ghost" size="sm" className="h-7 text-[11.5px] gap-1">
                  <Zap className="w-3 h-3" /> Enrich
                </Button>
              </a>
            </div>
            {enrichLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
            ) : (
              <div className="space-y-3">
                <StatRow label="Enriched" value={enrichStats?.companies.enriched ?? 0} icon={CheckCircle2} tone="success" />
                <StatRow label="Pending" value={enrichStats?.companies.pending ?? 0} icon={Clock} tone="info" />
                <StatRow label="Running jobs" value={enrichStats?.jobs.running ?? 0} icon={Loader2} tone="info" />
                <StatRow label="Avg crawl time" value={enrichStats && enrichStats.avgCrawlMs > 0 ? enrichStats.avgCrawlMs / 1000 : 0} icon={Activity} formatter={(v) => v > 0 ? `${v.toFixed(1)}s` : "—"} />
                <div className="pt-3 mt-3 border-t border-border/60">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-muted-foreground">Firecrawl</span>
                    <span className={cn("font-medium", enrichStats?.firecrawl.available ? "text-success" : "text-warning")}>
                      {enrichStats?.firecrawl.available ? "Connected" : "Direct mode"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </AnimatedItem>
      </div>

      {enrichStats && enrichStats.topTechnologies.length > 0 && (
        <AnimatedItem index={3}>
          <Card className="p-5 border-border/60 bg-card/40 mb-6">
            <div className="mb-4">
              <h3 className="text-[14px] font-semibold text-foreground">Top Technologies Detected</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">From enriched company websites</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {enrichStats.topTechnologies.slice(0, 15).map((tech) => (
                <span key={tech.name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/40 text-[11.5px]">
                  <span className="text-muted-foreground uppercase text-[9px] tracking-wide">{tech.category}</span>
                  <span className="font-medium text-foreground">{tech.name}</span>
                  <span className="text-muted-foreground tabular-nums">{tech.count}</span>
                </span>
              ))}
            </div>
          </Card>
        </AnimatedItem>
      )}

      {aiStats && aiStats.total > 0 && (
        <AnimatedItem index={4}>
          <Card className="p-5 border-border/60 bg-card/40 mb-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> AI Intelligence
                </h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {aiStats.total} companies analyzed · {aiStats.pendingAnalysis} pending
                </p>
              </div>
              <a href={routeHref("ai-insights")}>
                <Button variant="ghost" size="sm" className="h-7 text-[11.5px] gap-1">View insights</Button>
              </a>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <AIMetric label="Avg ICP Match" value={`${aiStats.avgIcpMatch}%`} tone={aiStats.avgIcpMatch >= 60 ? "success" : "neutral"} />
              <AIMetric label="Avg Qualification" value={`${aiStats.avgQualification}`} tone={aiStats.avgQualification >= 60 ? "success" : "neutral"} />
              <AIMetric label="Avg Video Opp" value={String(aiStats.avgVideoOpportunity)} tone="info" />
              <AIMetric label="Avg Confidence" value={`${aiStats.avgConfidence}%`} tone={aiStats.avgConfidence >= 70 ? "success" : "warning"} />
            </div>
            {aiStats.latestAnalyses.length > 0 && (
              <div className="space-y-1 pt-3 border-t border-border/60">
                {aiStats.latestAnalyses.slice(0, 5).map((a) => (
                  <div key={a.companyId} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/30">
                    <div className="w-6 h-6 rounded bg-muted/60 flex items-center justify-center text-[9px] font-semibold shrink-0">
                      {a.companyName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-[12px] font-medium text-foreground flex-1 truncate">{a.companyName}</span>
                    {a.industry && <Badge variant="outline" className="text-[9px] font-normal shrink-0">{a.industry}</Badge>}
                    {a.icpMatch !== null && <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">ICP {a.icpMatch}%</span>}
                    {a.qualification !== null && <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">Q {a.qualification}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </AnimatedItem>
      )}

      <AnimatedItem index={5}>
        <Card className="p-5 border-border/60 bg-card/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">Recent Discoveries</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">Latest companies stored</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-[11.5px]" asChild>
              <a href={routeHref("companies")}>View all</a>
            </Button>
          </div>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !stats || stats.recentDiscoveries.length === 0 ? (
            <div className="py-10 text-center">
              <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-[13px] text-muted-foreground">
                No companies discovered yet. <a href={routeHref("discover")} className="text-foreground font-medium hover:underline">Create a discovery job</a> to get started.
              </p>
            </div>
          ) : (
            <AnimatedList>
              {stats.recentDiscoveries.map((c) => (
                <a key={c.id} href={routeHref("companies")} className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/40 transition-colors group">
                  <div className="w-8 h-8 rounded-md bg-muted/60 flex items-center justify-center text-[11px] font-semibold text-foreground shrink-0">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground truncate">{c.name}</div>
                    <div className="text-[11.5px] text-muted-foreground truncate">
                      {c.domain ?? "—"} {c.industry && <>· {c.industry}</>} {c.country && <>· {c.country}</>}
                    </div>
                  </div>
                  {c.source && (
                    <span className="text-[10px] uppercase font-medium tracking-wide text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40 shrink-0">
                      {SOURCE_LABELS[c.source] ?? c.source}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground hidden sm:inline tabular-nums w-12 text-right">
                    {formatRelativeTime(c.discoveredAt)}
                  </span>
                </a>
              ))}
            </AnimatedList>
          )}
        </Card>
      </AnimatedItem>
    </div>
  );
}

function StatRow({ label, value, icon: Icon, tone = "neutral", formatter }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone?: "neutral" | "info" | "success" | "warning" | "danger"; formatter?: (v: number) => string }) {
  const toneColor = { neutral: "text-muted-foreground", info: "text-info", success: "text-success", warning: "text-warning", danger: "text-destructive" }[tone];
  return (
    <div className="flex items-center gap-3">
      <Icon className={cn("w-4 h-4", toneColor)} />
      <span className="text-[12.5px] text-muted-foreground flex-1">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums text-foreground">{formatter ? formatter(value) : formatNumber(value)}</span>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

function AIMetric({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "info" | "neutral" }) {
  const toneClass = { success: "text-success", warning: "text-warning", info: "text-info", neutral: "text-foreground" }[tone];
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</div>
      <div className={cn("text-[20px] font-semibold tabular-nums", toneClass)}>{value}</div>
    </div>
  );
}
