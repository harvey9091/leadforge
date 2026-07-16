"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { StatCard } from "@/components/common/stat-card";
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
        description="Performance, funnel and source analytics."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Companies"
          value={data?.totalCompanies ?? 0}
          format="number"
          icon={Building2}
          loading={isLoading}
        />
        <StatCard
          label="Enriched"
          value={data?.enrichedCompanies ?? 0}
          format="number"
          icon={ShieldCheck}
          loading={isLoading}
        />
        <StatCard
          label="AI Analyzed"
          value={data?.analyzedCompanies ?? 0}
          format="number"
          icon={Cpu}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="Top Industries" description="Companies by industry">
          {isLoading ? <Skeleton className="h-[260px] w-full" /> : (
            <BarsChart data={(data?.industries ?? []).map((i) => ({ label: i.name, value: i.count }))} layout="vertical" height={260} />
          )}
        </Section>
        <Section title="Top Technologies" description="Most detected technologies">
          {isLoading ? <Skeleton className="h-[260px] w-full" /> : (
            <BarsChart data={(data?.technologies ?? []).slice(0, 10).map((t) => ({ label: t.name, value: t.count }))} layout="vertical" height={260} />
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="Funding Stages" description="Distribution by funding stage">
          {isLoading ? <Skeleton className="h-[220px] w-full" /> : (
            <BarsChart data={(data?.fundingStages ?? []).map((f) => ({ label: f.name, value: f.count }))} height={220} />
          )}
        </Section>
        <Section title="Pricing Models" description="Distribution by pricing model">
          {isLoading ? <Skeleton className="h-[220px] w-full" /> : (
            <DonutChart data={(data?.pricingModels ?? []).map((p) => ({ label: p.name, value: p.count }))} height={200} />
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="Countries" description="Geographic distribution">
          {isLoading ? <Skeleton className="h-[220px] w-full" /> : (
            <BarsChart data={(data?.countries ?? []).map((c) => ({ label: c.name, value: c.count }))} layout="vertical" height={220} />
          )}
        </Section>
        <Section title="Discovery Sources" description="Where companies were found">
          {isLoading ? <Skeleton className="h-[220px] w-full" /> : (
            <DonutChart data={(data?.sources ?? []).map((s) => ({ label: s.name, value: s.count }))} height={200} />
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Section title="ICP Match Distribution" description="AI ICP match scores">
          {isLoading ? <Skeleton className="h-[200px] w-full" /> : (
            <BarsChart data={(data?.icpDistribution ?? []).filter((d) => d.score !== null).map((d) => ({ label: `${d.score}%`, value: d.count }))} height={200} />
          )}
        </Section>
        <Section title="Qualification Distribution" description="AI qualification scores">
          {isLoading ? <Skeleton className="h-[200px] w-full" /> : (
            <BarsChart data={(data?.qualificationDistribution ?? []).filter((d) => d.score !== null).map((d) => ({ label: `${d.score}`, value: d.count }))} height={200} />
          )}
        </Section>
        <Section title="Video Opportunity" description="AI video opportunity scores">
          {isLoading ? <Skeleton className="h-[200px] w-full" /> : (
            <BarsChart data={(data?.videoOpportunityDistribution ?? []).filter((d) => d.score !== null).map((d) => ({ label: `${d.score}`, value: d.count }))} height={200} />
          )}
        </Section>
      </div>

      <Section title="Average AI Confidence" description="Across all analyzed companies">
        <div className="flex items-center gap-4">
          <div className="text-[32px] font-bold tabular-nums text-foreground tracking-tight">
            {data ? `${Math.round(data.avgConfidence)}%` : "—"}
          </div>
          <div className="h-8 w-px bg-border/60" />
          <div className="text-[12.5px] text-muted-foreground leading-relaxed max-w-md">
            Measures how confident the AI is in its enrichment and analysis across the workspace.
          </div>
        </div>
      </Section>
    </div>
  );
}
