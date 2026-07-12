"use client";

/**
 * AI Insights page — Phase 4: real AI intelligence data.
 *
 * Displays:
 *  - Average ICP Match, Qualification, Video Opportunity, Confidence
 *  - Industries + Categories distribution
 *  - Top opportunities (highest qualification scores)
 *  - Latest analyses
 *  - Search AI summaries
 */

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Sparkles,
  Target,
  Video,
  ShieldCheck,
  TrendingUp,
  Search,
  Loader2,
  Zap,
  Brain,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Section } from "@/components/common/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import { formatRelativeTime, cn } from "@/lib/utils";
import { routeHref } from "@/lib/routes";
import { useToast } from "@/hooks/use-toast";

interface AIStats {
  total: number;
  avgIcpMatch: number;
  avgQualification: number;
  avgVideoOpportunity: number;
  avgConfidence: number;
  industries: Array<{ name: string; count: number }>;
  categories: Array<{ name: string; count: number }>;
  totalCompanies: number;
  enrichedCompanies: number;
  pendingAnalysis: number;
  jobs: { pending: number; completed: number };
  worker: { running: boolean; activeJobCount: number };
  circuitBreaker: { isOpen: boolean };
  llmConfig: { model: string; temperature: number; maxTokens: number };
  latestAnalyses: Array<{
    companyId: string;
    companyName: string;
    companyDomain: string | null;
    companyLogo: string | null;
    icpMatch: number | null;
    qualification: number | null;
    videoOpportunity: number | null;
    confidence: number | null;
    industry: string | null;
    category: string | null;
    analyzedAt: string;
  }>;
}

interface SearchResult {
  data: Array<{
    companyId: string;
    companyName: string;
    companyDomain: string | null;
    summaryOneLine: string | null;
    industry: string | null;
    productCategory: string | null;
    icpMatch: number | null;
    qualification: number | null;
    analyzedAt: string;
  }>;
}

export function AiInsightsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const debouncedSearch = React.useDeferredValue(search);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["ai", "stats"],
    queryFn: () => apiClient.get<AIStats>("/ai/stats"),
    refetchInterval: 10_000,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["ai", "search", debouncedSearch],
    queryFn: () => {
      if (!debouncedSearch) return { data: [] } as SearchResult;
      return apiClient.get<SearchResult>("/ai/search", { q: debouncedSearch });
    },
    enabled: debouncedSearch.length > 1,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => apiClient.post("/ai/batch", { limit: 50 }),
    onSuccess: (data: { message?: string }) => {
      toast({ title: "Batch analysis started", description: data.message ?? "Processing..." });
      queryClient.invalidateQueries({ queryKey: ["ai"] });
    },
    onError: (err) => {
      toast({ title: "Failed to start analysis", description: err instanceof Error ? err.message : "", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="AI Insights"
        description="Lead intelligence powered by FreeLLM — every company analyzed with traceable evidence."
        actions={
          <>
            <Badge variant="secondary" className="gap-1 text-[10.5px] uppercase tracking-wide font-semibold">
              <Sparkles className="w-3 h-3" />
              Phase 4
            </Badge>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
            >
              {analyzeMutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Starting...</>
              ) : (
                <><Brain className="w-3.5 h-3.5" />Analyze all</>
              )}
            </Button>
          </>
        }
      />

      {/* AI engine status banner */}
      <Card className={cn(
        "p-4 mb-6 border-border/60 flex items-center gap-4",
        stats?.worker.running ? "bg-success/[0.04]" : "bg-warning/[0.04]"
      )}>
        <div className={cn(
          "w-9 h-9 rounded-md flex items-center justify-center",
          stats?.worker.running ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
        )}>
          {stats?.worker.running ? <Brain className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-medium text-foreground">
            {isLoading ? "Checking AI engine..." : stats?.worker.running
              ? "AI Intelligence Engine running"
              : "AI engine not started"}
          </div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">
            {stats ? `Model: ${stats.llmConfig.model} · Temp: ${stats.llmConfig.temperature} · ${stats.total} companies analyzed` : "Loading..."}
          </div>
        </div>
        {stats?.circuitBreaker.isOpen && (
          <Badge variant="destructive" className="text-[10px]">Circuit breaker open</Badge>
        )}
        {stats && stats.pendingAnalysis > 0 && (
          <Badge variant="outline" className="text-[10px] font-normal">
            {stats.pendingAnalysis} pending
          </Badge>
        )}
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0 }}>
          <StatCard label="Avg ICP Match" value={stats ? `${stats.avgIcpMatch}%` : "—"} format="raw" icon={Target} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.04 }}>
          <StatCard label="Avg Qualification" value={stats ? `${stats.avgQualification}` : "—"} format="raw" icon={TrendingUp} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.08 }}>
          <StatCard label="Avg Video Opportunity" value={stats ? `${stats.avgVideoOpportunity}` : "—"} format="raw" icon={Video} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.12 }}>
          <StatCard label="Avg Confidence" value={stats ? `${stats.avgConfidence}%` : "—"} format="raw" icon={ShieldCheck} loading={isLoading} />
        </motion.div>
      </div>

      {/* Search */}
      <Card className="p-5 border-border/60 bg-card/40 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search AI summaries, reasons, technologies..."
            className="pl-8 h-9 text-[13px]"
          />
        </div>
        {searchResults && searchResults.data.length > 0 && (
          <div className="mt-4 space-y-1">
            {searchResults.data.slice(0, 8).map((r) => (
              <a
                key={r.companyId}
                href={routeHref("companies")}
                className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/40 transition-colors"
              >
                <div className="w-7 h-7 rounded-md bg-muted/60 flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {r.companyName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-foreground truncate">{r.companyName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.summaryOneLine ?? "No summary"}</div>
                </div>
                {r.icpMatch !== null && (
                  <Badge variant="outline" className="text-[9px] font-normal shrink-0">ICP {r.icpMatch}%</Badge>
                )}
                {r.qualification !== null && (
                  <Badge variant="outline" className="text-[9px] font-normal shrink-0">Q {r.qualification}</Badge>
                )}
              </a>
            ))}
          </div>
        )}
      </Card>

      {/* Industries + Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 border-border/60 bg-card/40">
          <Section title="Industries" description="AI-detected industry distribution">
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
            ) : stats && stats.industries.length > 0 ? (
              <div className="space-y-2">
                {stats.industries.map((ind) => (
                  <div key={ind.name} className="flex items-center gap-3">
                    <span className="text-[12px] text-foreground flex-1 truncate">{ind.name}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{ind.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground py-4 text-center">No analyses yet</p>
            )}
          </Section>
        </Card>

        <Card className="p-5 border-border/60 bg-card/40">
          <Section title="Categories" description="AI-detected product categories">
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
            ) : stats && stats.categories.length > 0 ? (
              <div className="space-y-2">
                {stats.categories.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <span className="text-[12px] text-foreground flex-1 truncate">{cat.name}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{cat.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground py-4 text-center">No analyses yet</p>
            )}
          </Section>
        </Card>
      </div>

      {/* Latest analyses / Top opportunities */}
      <Card className="p-5 border-border/60 bg-card/40">
        <div className="mb-4">
          <h3 className="text-[14px] font-semibold text-foreground">Latest Analyses</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">Most recently analyzed companies</p>
        </div>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : !stats || stats.latestAnalyses.length === 0 ? (
          <div className="py-10 text-center">
            <Brain className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground mb-4">
              No companies analyzed yet. Run "Analyze all" to start AI intelligence.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {stats.latestAnalyses.map((a) => (
              <a
                key={a.companyId}
                href={routeHref("companies")}
                className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/40 transition-colors"
              >
                <div className="w-8 h-8 rounded-md bg-muted/60 flex items-center justify-center text-[11px] font-semibold shrink-0">
                  {a.companyName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground truncate">{a.companyName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {a.companyDomain ?? "—"}
                    {a.industry && <> · {a.industry}</>}
                    {a.category && <> · {a.category}</>}
                  </div>
                </div>
                {a.icpMatch !== null && (
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] uppercase text-muted-foreground">ICP</span>
                    <span className={cn(
                      "text-[12px] font-semibold tabular-nums",
                      a.icpMatch >= 70 ? "text-success" : a.icpMatch >= 40 ? "text-warning" : "text-muted-foreground"
                    )}>{a.icpMatch}%</span>
                  </div>
                )}
                {a.qualification !== null && (
                  <div className="flex items-center gap-1 shrink-0 w-14">
                    <span className="text-[10px] uppercase text-muted-foreground">Q</span>
                    <span className="text-[12px] font-semibold tabular-nums">{a.qualification}</span>
                  </div>
                )}
                {a.confidence !== null && (
                  <div className="flex items-center gap-1 shrink-0 w-14">
                    <span className="text-[10px] uppercase text-muted-foreground">Conf</span>
                    <span className="text-[12px] font-semibold tabular-nums">{a.confidence}%</span>
                  </div>
                )}
                <span className="text-[10.5px] text-muted-foreground hidden sm:inline tabular-nums w-12 text-right">
                  {formatRelativeTime(a.analyzedAt)}
                </span>
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
