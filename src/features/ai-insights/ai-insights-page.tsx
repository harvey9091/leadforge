"use client";

/**
 * AI Insights page — Phase 4: real AI intelligence data.
 *
 * Premium redesign — Linear/Vercel dashboard feel:
 *  - PageHeader with refined description
 *  - Engine status banner with live indicator + progress
 *  - StatCard KPIs with staggered animations
 *  - AnimatedItem wrappers for section reveals
 *  - Consistent premium card spacing throughout
 */

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Target,
  Video,
  ShieldCheck,
  TrendingUp,
  Search,
  Loader2,
  Brain,
  AlertCircle,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Section } from "@/components/common/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AnimatedItem } from "@/components/animations";
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

function IcpBadge({ value }: { value: number }) {
  const color = value >= 70 ? "text-success" : value >= 40 ? "text-warning" : "text-muted-foreground";
  return (
    <span className={cn("text-[12px] font-bold tabular-nums", color)}>{value}%</span>
  );
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

  const topOpportunities = React.useMemo(() => {
    if (!stats?.latestAnalyses) return [];
    return [...stats.latestAnalyses]
      .filter((a) => a.qualification !== null)
      .sort((a, b) => (b.qualification ?? 0) - (a.qualification ?? 0))
      .slice(0, 5);
  }, [stats]);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8">
      <PageHeader
        title="AI Insights"
        description="ICP fit, scoring and qualification signals."
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
      <AnimatedItem>
        <Card className={cn(
          "p-5 border-border/60 flex items-center gap-5",
          stats?.worker.running ? "bg-success/[0.03]" : "bg-warning/[0.03]"
        )}>
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            stats?.worker.running ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
          )}>
            {stats?.worker.running ? (
              <Activity className="w-[18px] h-[18px]" />
            ) : (
              <AlertCircle className="w-[18px] h-[18px]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-semibold text-foreground">
              {isLoading ? "Checking AI engine..." : stats?.worker.running
                ? "AI Intelligence Engine running"
                : "AI engine not started"}
            </div>
            <div className="text-[11.5px] text-muted-foreground mt-1">
              {stats ? (
                <>
                  {stats.llmConfig.model} · temp {stats.llmConfig.temperature} · {stats.total} companies analyzed
                  {stats.pendingAnalysis > 0 && <> · <span className="text-warning font-medium">{stats.pendingAnalysis} pending</span></>}
                </>
              ) : (
                "Loading..."
              )}
            </div>
            {stats?.worker.running && stats.activeJobCount > 0 && (
              <div className="mt-2.5 max-w-xs">
                <Progress value={65} className="h-[5px] bg-muted/40" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {stats?.circuitBreaker.isOpen && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="destructive" className="text-[10px]">Circuit breaker open</Badge>
                </TooltipTrigger>
                <TooltipContent>Circuit breaker is open — API calls are blocked</TooltipContent>
              </Tooltip>
            )}
            {stats?.worker.running && (
              <span className="flex items-center gap-1.5 text-[11px] text-success font-medium">
                <span className="relative flex h-[7px] w-[7px]">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-[7px] w-[7px] bg-success"></span>
                </span>
                Active
              </span>
            )}
          </div>
        </Card>
      </AnimatedItem>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatedItem>
          <StatCard
            label="Avg ICP Match"
            value={stats ? stats.avgIcpMatch : undefined}
            format="percent"
            icon={Target}
            loading={isLoading}
          />
        </AnimatedItem>
        <AnimatedItem>
          <StatCard
            label="Avg Qualification"
            value={stats ? stats.avgQualification : undefined}
            format="number"
            icon={TrendingUp}
            loading={isLoading}
          />
        </AnimatedItem>
        <AnimatedItem>
          <StatCard
            label="Avg Video Opportunity"
            value={stats ? stats.avgVideoOpportunity : undefined}
            format="number"
            icon={Video}
            loading={isLoading}
          />
        </AnimatedItem>
        <AnimatedItem>
          <StatCard
            label="Avg Confidence"
            value={stats ? stats.avgConfidence : undefined}
            format="percent"
            icon={ShieldCheck}
            loading={isLoading}
          />
        </AnimatedItem>
      </div>

      {/* Search */}
      <AnimatedItem>
        <Section
          title="Search"
          description="Search AI summaries, reasons, and technologies across analyzed companies"
          actions={
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to search..."
                className="pl-8 h-9 text-[13px] w-64"
              />
            </div>
          }
        >
          {searchResults && searchResults.data.length > 0 ? (
            <div className="space-y-0.5">
              {searchResults.data.slice(0, 8).map((r) => (
                <a
                  key={r.companyId}
                  href={routeHref("companies")}
                  className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center text-[11px] font-bold text-foreground/80 shrink-0 group-hover:bg-muted transition-colors">
                    {r.companyName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground truncate group-hover:text-foreground/90">{r.companyName}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{r.summaryOneLine ?? "No summary available"}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.icpMatch !== null && (
                      <Badge variant="outline" className="text-[10px] font-normal tabular-nums">ICP {r.icpMatch}%</Badge>
                    )}
                    {r.qualification !== null && (
                      <Badge variant="outline" className="text-[10px] font-normal tabular-nums">Q {r.qualification}</Badge>
                    )}
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </a>
              ))}
            </div>
          ) : search.length > 1 ? (
            <p className="text-[12.5px] text-muted-foreground py-6 text-center">No results found for "{search}"</p>
          ) : (
            <p className="text-[12.5px] text-muted-foreground py-6 text-center">Start typing to search AI summaries across all analyzed companies</p>
          )}
        </Section>
      </AnimatedItem>

      {/* Industries + Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatedItem>
          <Section title="Industries" description="AI-detected industry distribution" actions={
            stats && stats.industries.length > 0 ? (
              <span className="text-[11px] text-muted-foreground tabular-nums">{stats.industries.length} industries</span>
            ) : null
          }>
            {isLoading ? (
              <div className="space-y-2.5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[18px] w-full" />)}</div>
            ) : stats && stats.industries.length > 0 ? (
              <div className="space-y-0.5">
                {stats.industries.map((ind) => (
                  <div key={ind.name} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors">
                    <span className="text-[12.5px] text-foreground flex-1 truncate">{ind.name}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums font-medium w-8 text-right">{ind.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-muted-foreground py-6 text-center">No analyses yet</p>
            )}
          </Section>
        </AnimatedItem>

        <AnimatedItem>
          <Section title="Categories" description="AI-detected product categories" actions={
            stats && stats.categories.length > 0 ? (
              <span className="text-[11px] text-muted-foreground tabular-nums">{stats.categories.length} categories</span>
            ) : null
          }>
            {isLoading ? (
              <div className="space-y-2.5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[18px] w-full" />)}</div>
            ) : stats && stats.categories.length > 0 ? (
              <div className="space-y-0.5">
                {stats.categories.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors">
                    <span className="text-[12.5px] text-foreground flex-1 truncate">{cat.name}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums font-medium w-8 text-right">{cat.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-muted-foreground py-6 text-center">No analyses yet</p>
            )}
          </Section>
        </AnimatedItem>
      </div>

      {/* Top opportunities */}
      {topOpportunities.length > 0 && (
        <AnimatedItem>
          <Section
            title="Top Opportunities"
            description="Highest qualification scores across analyzed companies"
            actions={
              <Badge variant="outline" className="text-[10px] font-normal gap-1">
                <ArrowUpRight className="w-3 h-3" />
                Top 5
              </Badge>
            }
          >
            <div className="space-y-0.5">
              {topOpportunities.map((a) => (
                <a
                  key={a.companyId}
                  href={routeHref("companies")}
                  className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center text-[12px] font-bold text-foreground/80 shrink-0 group-hover:bg-muted transition-colors">
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
                  <div className="flex items-center gap-3 shrink-0">
                    {a.icpMatch !== null && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] uppercase text-muted-foreground font-medium">ICP</span>
                        <IcpBadge value={a.icpMatch} />
                      </div>
                    )}
                    {a.qualification !== null && (
                      <div className="flex items-center gap-1 w-14">
                        <span className="text-[10px] uppercase text-muted-foreground font-medium">Q</span>
                        <span className="text-[12px] font-semibold tabular-nums text-foreground">{a.qualification}</span>
                      </div>
                    )}
                    {a.confidence !== null && (
                      <div className="flex items-center gap-1 w-14">
                        <span className="text-[10px] uppercase text-muted-foreground font-medium">Conf</span>
                        <span className="text-[12px] font-semibold tabular-nums text-foreground">{a.confidence}%</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10.5px] text-muted-foreground hidden md:inline tabular-nums w-16 text-right shrink-0">
                    {formatRelativeTime(a.analyzedAt)}
                  </span>
                </a>
              ))}
            </div>
          </Section>
        </AnimatedItem>
      )}

      {/* Latest analyses */}
      <AnimatedItem>
        <Section
          title="Latest Analyses"
          description="Most recently analyzed companies"
          actions={
            stats && stats.latestAnalyses.length > 0 ? (
              <span className="text-[11px] text-muted-foreground tabular-nums">{stats.latestAnalyses.length} total</span>
            ) : null
          }
        >
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[52px] w-full" />)}</div>
          ) : !stats || stats.latestAnalyses.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                <Brain className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-[13.5px] text-foreground/80 font-medium mb-1">No analyses yet</p>
              <p className="text-[12px] text-muted-foreground max-w-xs mx-auto">
                Run "Analyze all" to start AI intelligence processing across your company database.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {stats.latestAnalyses.map((a) => (
                <a
                  key={a.companyId}
                  href={routeHref("companies")}
                  className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center text-[12px] font-bold text-foreground/80 shrink-0 group-hover:bg-muted transition-colors">
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
                  <div className="flex items-center gap-3 shrink-0">
                    {a.icpMatch !== null && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] uppercase text-muted-foreground font-medium">ICP</span>
                        <IcpBadge value={a.icpMatch} />
                      </div>
                    )}
                    {a.qualification !== null && (
                      <div className="flex items-center gap-1 w-14">
                        <span className="text-[10px] uppercase text-muted-foreground font-medium">Q</span>
                        <span className="text-[12px] font-semibold tabular-nums text-foreground">{a.qualification}</span>
                      </div>
                    )}
                    {a.confidence !== null && (
                      <div className="flex items-center gap-1 w-14">
                        <span className="text-[10px] uppercase text-muted-foreground font-medium">Conf</span>
                        <span className="text-[12px] font-semibold tabular-nums text-foreground">{a.confidence}%</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10.5px] text-muted-foreground hidden md:inline tabular-nums w-16 text-right shrink-0">
                    {formatRelativeTime(a.analyzedAt)}
                  </span>
                </a>
              ))}
            </div>
          )}
        </Section>
      </AnimatedItem>
    </div>
  );
}
