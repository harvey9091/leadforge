"use client";

/**
 * Company Detail Workspace — Phase 5
 *
 * Full company intelligence with tabbed sections:
 *  - Overview (summary, key facts, scores)
 *  - AI Intelligence (analysis, evidence, confidence)
 *  - Technologies (detected tech stack)
 *  - Pricing (pricing signals, model, budget)
 *  - People (contacts)
 *  - Timeline (discovery, enrichment, AI analysis history)
 *  - Evidence (all AI evidence with sources)
 *  - Notes (user notes)
 */

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ExternalLink,
  Sparkles,
  Code2,
  DollarSign,
  Users2,
  Clock,
  ShieldCheck,
  FileText,
  Tag as TagIcon,
  Pin,
  PinOff,
  Plus,
  Trash2,
  Loader2,
  Brain,
  TrendingUp,
  Video,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, GradeBadge } from "@/components/common/status-badge";
import { apiClient } from "@/lib/api-client";
import { cn, formatRelativeTime, formatNumber } from "@/lib/utils";
import { navigate } from "@/hooks/use-hash-route";
import { useToast } from "@/hooks/use-toast";

interface CompanyDetail {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  description: string | null;
  industry: string | null;
  country: string | null;
  headquarters: string | null;
  foundedYear: number | null;
  fundingStage: string | null;
  employeeEstimate: string | null;
  logoUrl: string | null;
  headline: string | null;
  pricingModel: string | null;
  pricingDetected: boolean;
  trialDetected: boolean;
  freemiumDetected: boolean;
  enterpriseDetected: boolean;
  callToAction: string | null;
  supportEmail: string | null;
  contactEmail: string | null;
  phone: string | null;
  address: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  websiteHttps: boolean | null;
  websiteStatus: number | null;
  websiteSpeedMs: number | null;
  lastEnrichedAt: string | null;
  discoveredAt: string;
  sources: Array<{ type: string; url: string | null }>;
  tags: Array<{ tag: { name: string; slug: string } }>;
}

interface AIInsight {
  id: string;
  status: string;
  summaryOneLine: string | null;
  summaryParagraph: string | null;
  summaryDetailed: string | null;
  productCategory: string | null;
  subCategory: string | null;
  industry: string | null;
  targetMarket: string | null;
  targetCustomer: string | null;
  customerProfile: unknown;
  pricingModel: string | null;
  pricingEstimate: string | null;
  budgetCategory: string | null;
  companyStage: string | null;
  stageConfidence: number | null;
  hiringStatus: string | null;
  hiringTrend: string | null;
  teamComposition: string | null;
  remoteFirst: boolean | null;
  productMaturity: string | null;
  websiteQuality: { overall: number | null; visualQuality: number | null; ux: number | null; copywriting: number | null; brand: number | null; performance: number | null; professionalism: number | null; modernity: number | null };
  videoOpportunity: { overall: number | null; productVideo: number | null; explainer: number | null; homepageAnimation: number | null; demoVideo: number | null; launchTrailer: number | null; onboarding: number | null; featureUpdates: number | null; socialContent: number | null };
  icpMatch: { matchPct: number | null; reasons: string[]; missingRequirements: string[]; strengths: string[]; weaknesses: string[] };
  qualification: { score: number | null; reasons: string[] };
  riskFactors: string[];
  opportunityFactors: string[];
  overallConfidence: number | null;
  tokensUsed: number | null;
  durationMs: number | null;
  analyzedAt: string;
  evidence: Array<{ field: string; value: string; confidence: number; source: string; evidence: string; reasoning: string | null }>;
}

interface Note {
  id: string;
  content: string;
  authorName: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

type Tab = "overview" | "ai" | "technologies" | "pricing" | "people" | "timeline" | "evidence" | "notes";

export function CompanyDetailPage({ companyId }: { companyId: string }) {
  const [tab, setTab] = React.useState<Tab>("overview");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => apiClient.get<{ company: CompanyDetail }>(`/companies/${companyId}`).then((r) => r.company),
  });

  const { data: aiInsight } = useQuery({
    queryKey: ["ai", "insights", companyId],
    queryFn: () => apiClient.get<{ analysis: AIInsight | null }>(`/ai/insights/${companyId}`).then((r) => r.analysis),
  });

  const { data: technologies } = useQuery({
    queryKey: ["company", companyId, "technologies"],
    queryFn: () => apiClient.get<{ data: Array<{ technology: { name: string; category: string } }> }>(`/companies/${companyId}/technologies`).then((r) => r.data).catch(() => []),
  });

  const { data: notes } = useQuery({
    queryKey: ["notes", companyId],
    queryFn: () => apiClient.get<{ data: Note[] }>(`/workspace/notes?companyId=${companyId}`).then((r) => r.data).catch(() => []),
  });

  const analyzeMutation = useMutation({
    mutationFn: () => apiClient.post("/ai/analyze", { companyId }),
    onSuccess: () => {
      toast({ title: "AI analysis started", description: "Results will appear in a few minutes." });
      queryClient.invalidateQueries({ queryKey: ["ai", "insights", companyId] });
    },
  });

  const pinMutation = useMutation({
    mutationFn: (action: "pin" | "unpin") => apiClient.post("/workspace/pinned", { companyId, action }),
    onSuccess: () => {
      toast({ title: "Updated" });
      queryClient.invalidateQueries({ queryKey: ["pinned"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("#/companies")} className="gap-1.5 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to companies
        </Button>
        <p className="text-[13px] text-muted-foreground">Company not found.</p>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "overview", label: "Overview", icon: TrendingUp },
    { id: "ai", label: "AI Intelligence", icon: Brain },
    { id: "technologies", label: "Technologies", icon: Code2 },
    { id: "pricing", label: "Pricing", icon: DollarSign },
    { id: "people", label: "People", icon: Users2 },
    { id: "timeline", label: "Timeline", icon: Clock },
    { id: "evidence", label: "Evidence", icon: ShieldCheck },
    { id: "notes", label: "Notes", icon: FileText },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("#/companies")} className="gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Companies
        </Button>
      </div>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-lg bg-muted/60 flex items-center justify-center text-[18px] font-semibold shrink-0">
          {company.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{company.name}</h1>
            {company.domain && (
              <a
                href={`https://${company.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              >
                {company.domain} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2">
            {company.headline || company.description || "No description available"}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            {company.industry && <Badge variant="secondary" className="text-[10px]">{company.industry}</Badge>}
            {company.country && <Badge variant="outline" className="text-[10px]">{company.country}</Badge>}
            {company.fundingStage && <Badge variant="outline" className="text-[10px]">{company.fundingStage}</Badge>}
            {aiInsight && aiInsight.icpMatch.matchPct !== null && (
              <Badge variant="outline" className={cn("text-[10px] font-semibold", aiInsight.icpMatch.matchPct >= 70 ? "text-success" : aiInsight.icpMatch.matchPct >= 40 ? "text-warning" : "text-muted-foreground")}>
                ICP {aiInsight.icpMatch.matchPct}%
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => pinMutation.mutate("pin")}>
            <Pin className="w-3.5 h-3.5" /> Pin
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending}>
            {analyzeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiInsight ? "Re-analyze" : "Analyze"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === t.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === "notes" && notes && notes.length > 0 && (
                <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{notes.length}</span>
              )}
              {t.id === "evidence" && aiInsight?.evidence && aiInsight.evidence.length > 0 && (
                <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{aiInsight.evidence.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {tab === "overview" && <OverviewTab company={company} ai={aiInsight} />}
          {tab === "ai" && <AITab ai={aiInsight} />}
          {tab === "technologies" && <TechnologiesTab technologies={technologies ?? []} />}
          {tab === "pricing" && <PricingTab company={company} ai={aiInsight} />}
          {tab === "people" && <PeopleTab companyId={companyId} />}
          {tab === "timeline" && <TimelineTab company={company} ai={aiInsight} />}
          {tab === "evidence" && <EvidenceTab ai={aiInsight} />}
          {tab === "notes" && <NotesTab companyId={companyId} notes={notes ?? []} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------
function OverviewTab({ company, ai }: { company: CompanyDetail; ai: AIInsight | null }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-5 border-border/60 bg-card/40">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">Company Facts</h3>
        <dl className="space-y-2 text-[12px]">
          <FactRow label="Industry" value={company.industry} />
          <FactRow label="Country" value={company.country} />
          <FactRow label="Founded" value={company.foundedYear?.toString()} />
          <FactRow label="Funding" value={company.fundingStage} />
          <FactRow label="Employees" value={company.employeeEstimate} />
          <FactRow label="Pricing" value={company.pricingModel} />
          <FactRow label="HTTPS" value={company.websiteHttps === null ? null : company.websiteHttps ? "Yes" : "No"} />
          <FactRow label="Status" value={company.websiteStatus?.toString()} />
          <FactRow label="Speed" value={company.websiteSpeedMs ? `${company.websiteSpeedMs}ms` : null} />
        </dl>
      </Card>

      <Card className="p-5 border-border/60 bg-card/40">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">AI Scores</h3>
        {ai && ai.status === "completed" ? (
          <div className="space-y-3">
            <ScoreBar label="ICP Match" value={ai.icpMatch.matchPct} max={100} suffix="%" />
            <ScoreBar label="Qualification" value={ai.qualification.score} max={100} />
            <ScoreBar label="Confidence" value={ai.overallConfidence} max={100} suffix="%" />
            <ScoreBar label="Video Opportunity" value={ai.videoOpportunity.overall} max={100} />
            <ScoreBar label="Website Quality" value={ai.websiteQuality.overall} max={100} />
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground py-4 text-center">No AI analysis yet. Click "Analyze" to generate.</p>
        )}
      </Card>

      <Card className="p-5 border-border/60 bg-card/40">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">Contact</h3>
        <dl className="space-y-2 text-[12px]">
          <FactRow label="Support Email" value={company.supportEmail} />
          <FactRow label="Contact Email" value={company.contactEmail} />
          <FactRow label="Phone" value={company.phone} />
          <FactRow label="Address" value={company.address} />
          <FactRow label="LinkedIn" value={company.linkedinUrl} />
          <FactRow label="Twitter" value={company.twitterUrl} />
          <FactRow label="CTA" value={company.callToAction} />
        </dl>
        {company.tags.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/60">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Tags</div>
            <div className="flex items-center gap-1 flex-wrap">
              {company.tags.map((t) => (
                <Badge key={t.tag.slug} variant="outline" className="text-[10px] font-normal">
                  <TagIcon className="w-2.5 h-2.5 mr-1" />
                  {t.tag.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {ai && ai.summaryDetailed && (
        <Card className="lg:col-span-3 p-5 border-border/60 bg-card/40">
          <h3 className="text-[13px] font-semibold text-foreground mb-2">Business Summary</h3>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">{ai.summaryDetailed}</p>
          {ai.opportunityFactors.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/60">
              <div className="text-[10px] uppercase tracking-wide text-success mb-1.5 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Opportunity Factors
              </div>
              <ul className="space-y-1">
                {ai.opportunityFactors.map((f, i) => (
                  <li key={i} className="text-[12px] text-foreground flex items-start gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-success mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ai.riskFactors.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wide text-destructive mb-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Risk Factors
              </div>
              <ul className="space-y-1">
                {ai.riskFactors.map((f, i) => (
                  <li key={i} className="text-[12px] text-foreground flex items-start gap-1.5">
                    <AlertCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-foreground font-medium text-right truncate max-w-[60%]">{value}</dd>
    </div>
  );
}

function ScoreBar({ label, value, max, suffix }: { label: string; value: number | null; max: number; suffix?: string }) {
  if (value === null) return null;
  const pct = (value / max) * 100;
  const color = value >= 70 ? "bg-success" : value >= 40 ? "bg-warning" : "bg-destructive";
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground tabular-nums">{value}{suffix}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Tab
// ---------------------------------------------------------------------------
function AITab({ ai }: { ai: AIInsight | null }) {
  if (!ai || ai.status !== "completed") {
    return (
      <Card className="p-10 border-border/60 bg-card/40 text-center">
        <Brain className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-[14px] font-semibold text-foreground mb-1">No AI analysis yet</h3>
        <p className="text-[12.5px] text-muted-foreground">Click "Analyze" to generate intelligence.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 border-border/60 bg-card/40">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">Business Intelligence</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-[12px]">
          <FactRow label="Category" value={ai.productCategory} />
          <FactRow label="Sub-category" value={ai.subCategory} />
          <FactRow label="Industry" value={ai.industry} />
          <FactRow label="Target Market" value={ai.targetMarket} />
          <FactRow label="Target Customer" value={ai.targetCustomer} />
          <FactRow label="Company Stage" value={ai.companyStage} />
          <FactRow label="Product Maturity" value={ai.productMaturity} />
          <FactRow label="Hiring" value={ai.hiringStatus} />
          <FactRow label="Hiring Trend" value={ai.hiringTrend} />
          <FactRow label="Team" value={ai.teamComposition} />
          <FactRow label="Remote First" value={ai.remoteFirst === null ? null : ai.remoteFirst ? "Yes" : "No"} />
          <FactRow label="Pricing Model" value={ai.pricingModel} />
        </div>
      </Card>

      <Card className="p-5 border-border/60 bg-card/40">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">ICP Match</h3>
        {ai.icpMatch.matchPct !== null && (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "text-[28px] font-bold tabular-nums",
                ai.icpMatch.matchPct >= 70 ? "text-success" : ai.icpMatch.matchPct >= 40 ? "text-warning" : "text-muted-foreground"
              )}>
                {ai.icpMatch.matchPct}%
              </div>
              <div className="text-[11px] text-muted-foreground">match score</div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {ai.icpMatch.reasons.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-success mb-1">Reasons</div>
                  <ul className="space-y-1">
                    {ai.icpMatch.reasons.map((r, i) => (
                      <li key={i} className="text-[11.5px] text-foreground flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-success mt-0.5 shrink-0" /> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {ai.icpMatch.strengths.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-info mb-1">Strengths</div>
                  <ul className="space-y-1">
                    {ai.icpMatch.strengths.map((s, i) => (
                      <li key={i} className="text-[11.5px] text-foreground">• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {ai.icpMatch.weaknesses.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-warning mb-1">Weaknesses</div>
                  <ul className="space-y-1">
                    {ai.icpMatch.weaknesses.map((w, i) => (
                      <li key={i} className="text-[11.5px] text-foreground">• {w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {ai.icpMatch.missingRequirements.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-destructive mb-1">Missing Requirements</div>
                  <ul className="space-y-1">
                    {ai.icpMatch.missingRequirements.map((m, i) => (
                      <li key={i} className="text-[11.5px] text-foreground flex items-start gap-1.5">
                        <AlertCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" /> {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 border-border/60 bg-card/40">
          <h3 className="text-[13px] font-semibold text-foreground mb-3">Website Quality</h3>
          <div className="space-y-2">
            <ScoreBar label="Overall" value={ai.websiteQuality.overall} max={100} />
            <ScoreBar label="Visual Quality" value={ai.websiteQuality.visualQuality} max={100} />
            <ScoreBar label="UX" value={ai.websiteQuality.ux} max={100} />
            <ScoreBar label="Copywriting" value={ai.websiteQuality.copywriting} max={100} />
            <ScoreBar label="Brand" value={ai.websiteQuality.brand} max={100} />
            <ScoreBar label="Performance" value={ai.websiteQuality.performance} max={100} />
            <ScoreBar label="Professionalism" value={ai.websiteQuality.professionalism} max={100} />
            <ScoreBar label="Modernity" value={ai.websiteQuality.modernity} max={100} />
          </div>
        </Card>

        <Card className="p-5 border-border/60 bg-card/40">
          <h3 className="text-[13px] font-semibold text-foreground mb-3">Video Opportunity</h3>
          <div className="space-y-2">
            <ScoreBar label="Overall" value={ai.videoOpportunity.overall} max={100} />
            <ScoreBar label="Product Video" value={ai.videoOpportunity.productVideo} max={100} />
            <ScoreBar label="Explainer" value={ai.videoOpportunity.explainer} max={100} />
            <ScoreBar label="Homepage Animation" value={ai.videoOpportunity.homepageAnimation} max={100} />
            <ScoreBar label="Demo Video" value={ai.videoOpportunity.demoVideo} max={100} />
            <ScoreBar label="Launch Trailer" value={ai.videoOpportunity.launchTrailer} max={100} />
            <ScoreBar label="Onboarding" value={ai.videoOpportunity.onboarding} max={100} />
            <ScoreBar label="Feature Updates" value={ai.videoOpportunity.featureUpdates} max={100} />
            <ScoreBar label="Social Content" value={ai.videoOpportunity.socialContent} max={100} />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Technologies Tab
// ---------------------------------------------------------------------------
function TechnologiesTab({ technologies }: { technologies: Array<{ technology: { name: string; category: string } }> }) {
  if (technologies.length === 0) {
    return (
      <Card className="p-10 border-border/60 bg-card/40 text-center">
        <Code2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-[12.5px] text-muted-foreground">No technologies detected yet. Enrich the company to detect technologies.</p>
      </Card>
    );
  }

  const byCategory = new Map<string, string[]>();
  for (const t of technologies) {
    const cat = t.technology.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(t.technology.name);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from(byCategory.entries()).sort().map(([category, techs]) => (
        <Card key={category} className="p-5 border-border/60 bg-card/40">
          <h3 className="text-[12px] font-semibold text-foreground uppercase tracking-wide mb-2">{category}</h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {techs.map((tech) => (
              <Badge key={tech} variant="outline" className="text-[11px] font-normal">{tech}</Badge>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pricing Tab
// ---------------------------------------------------------------------------
function PricingTab({ company, ai }: { company: CompanyDetail; ai: AIInsight | null }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5 border-border/60 bg-card/40">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">Pricing Signals</h3>
        <div className="space-y-2">
          <SignalRow label="Pricing Page Detected" value={company.pricingDetected} />
          <SignalRow label="Free Trial" value={company.trialDetected} />
          <SignalRow label="Freemium" value={company.freemiumDetected} />
          <SignalRow label="Enterprise Pricing" value={company.enterpriseDetected} />
        </div>
      </Card>

      <Card className="p-5 border-border/60 bg-card/40">
        <h3 className="text-[13px] font-semibold text-foreground mb-3">AI Pricing Intelligence</h3>
        {ai && ai.status === "completed" ? (
          <dl className="space-y-2 text-[12px]">
            <FactRow label="Pricing Model" value={ai.pricingModel} />
            <FactRow label="Pricing Estimate" value={ai.pricingEstimate} />
            <FactRow label="Budget Category" value={ai.budgetCategory} />
          </dl>
        ) : (
          <p className="text-[12px] text-muted-foreground">Run AI analysis for pricing intelligence.</p>
        )}
      </Card>
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      {value ? (
        <Badge variant="secondary" className="text-[10px] bg-success/10 text-success border-success/20">Yes</Badge>
      ) : (
        <Badge variant="outline" className="text-[10px] text-muted-foreground">No</Badge>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// People Tab
// ---------------------------------------------------------------------------
function PeopleTab({ companyId }: { companyId: string }) {
  return (
    <Card className="p-10 border-border/60 bg-card/40 text-center">
      <Users2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
      <p className="text-[12.5px] text-muted-foreground">People data is managed in the People page.</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Timeline Tab
// ---------------------------------------------------------------------------
function TimelineTab({ company, ai }: { company: CompanyDetail; ai: AIInsight | null }) {
  const events: Array<{ date: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { date: company.discoveredAt, label: "Discovered", icon: TrendingUp },
  ];
  if (company.lastEnrichedAt) events.push({ date: company.lastEnrichedAt, label: "Enriched", icon: Code2 });
  if (ai?.analyzedAt) events.push({ date: ai.analyzedAt, label: "AI Analyzed", icon: Brain });

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Card className="p-5 border-border/60 bg-card/40">
      <h3 className="text-[13px] font-semibold text-foreground mb-4">Timeline</h3>
      <div className="space-y-3">
        {events.map((event, i) => {
          const Icon = event.icon;
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-muted/40 flex items-center justify-center text-foreground shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-medium text-foreground">{event.label}</div>
                <div className="text-[11px] text-muted-foreground">{formatRelativeTime(event.date)}</div>
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">{new Date(event.date).toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Evidence Tab
// ---------------------------------------------------------------------------
function EvidenceTab({ ai }: { ai: AIInsight | null }) {
  if (!ai || !ai.evidence || ai.evidence.length === 0) {
    return (
      <Card className="p-10 border-border/60 bg-card/40 text-center">
        <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-[12.5px] text-muted-foreground">No evidence yet. Run AI analysis to generate evidence.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {ai.evidence.map((ev, i) => (
        <Card key={i} className="p-4 border-border/60 bg-card/40">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-[9px] uppercase tracking-wide font-medium">{ev.field}</Badge>
                <span className="text-[12.5px] font-medium text-foreground">{ev.value}</span>
              </div>
              <p className="text-[12px] text-muted-foreground">{ev.evidence}</p>
              {ev.reasoning && <p className="text-[11px] text-muted-foreground mt-1 italic">Reasoning: {ev.reasoning}</p>}
              <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                <span>Source: {ev.source}</span>
                <span>·</span>
                <span className={cn("font-medium", ev.confidence >= 80 ? "text-success" : ev.confidence >= 50 ? "text-warning" : "text-destructive")}>
                  {ev.confidence}% confidence
                </span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes Tab
// ---------------------------------------------------------------------------
function NotesTab({ companyId, notes }: { companyId: string; notes: Note[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = React.useState("");

  const createMutation = useMutation({
    mutationFn: (content: string) => apiClient.post("/workspace/notes", { companyId, content, authorName: "You" }),
    onSuccess: () => {
      toast({ title: "Note added" });
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["notes", companyId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/workspace/notes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", companyId] });
    },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 border-border/60 bg-card/40">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a note... (Markdown supported)"
          className="min-h-[80px] text-[13px] resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10.5px] text-muted-foreground">Markdown supported</span>
          <Button size="sm" disabled={!content.trim() || createMutation.isPending} onClick={() => createMutation.mutate(content)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add note
          </Button>
        </div>
      </Card>

      {notes.length === 0 ? (
        <Card className="p-10 border-border/60 bg-card/40 text-center">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-[12.5px] text-muted-foreground">No notes yet.</p>
        </Card>
      ) : (
        notes.map((note) => (
          <Card key={note.id} className="p-4 border-border/60 bg-card/40">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="text-[11px] text-muted-foreground">
                {note.authorName ?? "Unknown"} · {formatRelativeTime(note.createdAt)}
                {note.version > 1 && <span> · v{note.version}</span>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => deleteMutation.mutate(note.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-[12.5px] text-foreground whitespace-pre-wrap">{note.content}</p>
          </Card>
        ))
      )}
    </div>
  );
}
