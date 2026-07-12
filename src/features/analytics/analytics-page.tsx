"use client";

/**
 * Analytics page — Phase 5: intelligence-focused analytics.
 *
 * Shows real data from /api/v1/workspace/analytics:
 *  - Top industries, technologies, funding stages, pricing models, countries
 *  - ICP distribution, qualification distribution, video opportunity distribution
 *  - Average confidence
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarsChart, DonutChart } from "@/components/charts";
import { apiClient } from "@/lib/api-client";
import { Building2, Cpu, DollarSign, Globe, TrendingUp, Target, ShieldCheck, Video } from "lucide-react";

interface AnalyticsData {
  totalCompanies: number;
  enrichedCompanies: number;
  analyzedCompanies: number;
  industries: Array<{ name: string; count: number }>;
  technologies: Array<{ name: string; category: string; count: number }>;
  fundingStages: Array<{ name: string; count: number }>;
  pricingModels: Array<{ name: string; count: number }>;
  countries: Array<{ name: string; count: number }>;
  sources: Array<{ name: string; count: number }>;
  icpDistribution: Array<{ score: number | null; count: number }>;
  qualificationDistribution: Array<{ score: number | null; count: number }>;
  avgConfidence: number;
  videoOpportunityDistribution: Array<{ score: number | null; count: number }>;
}

export function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["workspace", "analytics"],
    queryFn: () => apiClient.get<AnalyticsData>("/workspace/analytics"),
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Analytics"
        description="Lead intelligence analytics — industries, technologies, funding, and AI scores."
      />

      {/* Top stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4 border-border/60 bg-card/40">
          <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1">Total Companies</div>
          <div className="text-[22px] font-semibold tabular-nums">{data?.totalCompanies ?? "—"}</div>
        </Card>
        <Card className="p-4 border-border/60 bg-card/40">
          <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1">Enriched</div>
          <div className="text-[22px] font-semibold tabular-nums">{data?.enrichedCompanies ?? "—"}</div>
        </Card>
        <Card className="p-4 border-border/60 bg-card/40">
          <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1">AI Analyzed</div>
          <div className="text-[22px] font-semibold tabular-nums">{data?.analyzedCompanies ?? "—"}</div>
        </Card>
      </div>

      {/* Top row: Industries + Technologies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 border-border/60 bg-card/40">
          <Section title="Top Industries" description="Companies by industry">
            {isLoading ? <Skeleton className="h-[260px] w-full" /> : (
              <BarsChart data={(data?.industries ?? []).map((i) => ({ label: i.name, value: i.count }))} layout="vertical" height={260} />
            )}
          </Section>
        </Card>
        <Card className="p-5 border-border/60 bg-card/40">
          <Section title="Top Technologies" description="Most detected technologies">
            {isLoading ? <Skeleton className="h-[260px] w-full" /> : (
              <BarsChart data={(data?.technologies ?? []).slice(0, 10).map((t) => ({ label: t.name, value: t.count }))} layout="vertical" height={260} />
            )}
          </Section>
        </Card>
      </div>

      {/* Second row: Funding + Pricing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 border-border/60 bg-card/40">
          <Section title="Funding Stages" description="Distribution by funding stage">
            {isLoading ? <Skeleton className="h-[220px] w-full" /> : (
              <BarsChart data={(data?.fundingStages ?? []).map((f) => ({ label: f.name, value: f.count }))} height={220} />
            )}
          </Section>
        </Card>
        <Card className="p-5 border-border/60 bg-card/40">
          <Section title="Pricing Models" description="Distribution by pricing model">
            {isLoading ? <Skeleton className="h-[220px] w-full" /> : (
              <DonutChart data={(data?.pricingModels ?? []).map((p) => ({ label: p.name, value: p.count }))} height={200} />
            )}
          </Section>
        </Card>
      </div>

      {/* Third row: Countries + Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 border-border/60 bg-card/40">
          <Section title="Countries" description="Geographic distribution">
            {isLoading ? <Skeleton className="h-[220px] w-full" /> : (
              <BarsChart data={(data?.countries ?? []).map((c) => ({ label: c.name, value: c.count }))} layout="vertical" height={220} />
            )}
          </Section>
        </Card>
        <Card className="p-5 border-border/60 bg-card/40">
          <Section title="Discovery Sources" description="Where companies were found">
            {isLoading ? <Skeleton className="h-[220px] w-full" /> : (
              <DonutChart data={(data?.sources ?? []).map((s) => ({ label: s.name, value: s.count }))} height={200} />
            )}
          </Section>
        </Card>
      </div>

      {/* AI Intelligence row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 border-border/60 bg-card/40">
          <Section title="ICP Match Distribution" description="AI ICP match scores">
            {isLoading ? <Skeleton className="h-[200px] w-full" /> : (
              <BarsChart data={(data?.icpDistribution ?? []).filter((d) => d.score !== null).map((d) => ({ label: `${d.score}%`, value: d.count }))} height={200} />
            )}
          </Section>
        </Card>
        <Card className="p-5 border-border/60 bg-card/40">
          <Section title="Qualification Distribution" description="AI qualification scores">
            {isLoading ? <Skeleton className="h-[200px] w-full" /> : (
              <BarsChart data={(data?.qualificationDistribution ?? []).filter((d) => d.score !== null).map((d) => ({ label: `${d.score}`, value: d.count }))} height={200} />
            )}
          </Section>
        </Card>
        <Card className="p-5 border-border/60 bg-card/40">
          <Section title="Video Opportunity" description="AI video opportunity scores">
            {isLoading ? <Skeleton className="h-[200px] w-full" /> : (
              <BarsChart data={(data?.videoOpportunityDistribution ?? []).filter((d) => d.score !== null).map((d) => ({ label: `${d.score}`, value: d.count }))} height={200} />
            )}
          </Section>
        </Card>
      </div>

      {/* Avg confidence */}
      <Card className="p-5 border-border/60 bg-card/40 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-semibold text-foreground">Average AI Confidence</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Across all analyzed companies</div>
          </div>
          <div className="text-[28px] font-bold tabular-nums text-foreground">
            {data ? `${Math.round(data.avgConfidence)}%` : "—"}
          </div>
        </div>
      </Card>
    </div>
  );
}
