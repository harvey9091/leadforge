"use client";

/**
 * Intelligence Feed page — Phase 7
 *
 * Premium redesign:
 *  - PageHeader with refined typography
 *  - Premium feed cards with status badges for signal types
 *  - Better spacing and hover states
 *  - Smooth animations with framer-motion
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  TrendingUp,
  DollarSign,
  Users2,
  Sparkles,
  ArrowRight,
  Zap,
  AlertCircle,
  CheckCircle2,
  Radio,
  Tag,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { formatRelativeTime, cn } from "@/lib/utils";
import { navigate } from "@/hooks/use-hash-route";

interface FeedItem {
  type: "signal" | "recommendation";
  id: string;
  companyId: string;
  companyName: string;
  companyDomain: string | null;
  companyLogo: string | null;
  title: string;
  description: string | null;
  importance: number;
  timestamp: string;
  signalType: string | null;
}

const SIGNAL_TYPE_META: Record<string, { label: string; tone: "info" | "success" | "warning" | "accent" | "neutral" }> = {
  pricing_change: { label: "Pricing", tone: "warning" },
  new_pricing_page: { label: "Pricing Page", tone: "warning" },
  enterprise_feature: { label: "Enterprise", tone: "accent" },
  hiring_increase: { label: "Hiring", tone: "success" },
  hiring_spike: { label: "Hiring Spike", tone: "success" },
  product_launch: { label: "Launch", tone: "info" },
  funding_announcement: { label: "Funding", tone: "success" },
  technology_change: { label: "Tech Change", tone: "accent" },
  new_hire_executive: { label: "Exec Hire", tone: "accent" },
  website_redesign: { label: "Redesign", tone: "info" },
};

const TYPE_TONE: Record<string, "info" | "success" | "accent" | "neutral"> = {
  signal: "info",
  recommendation: "accent",
};

export function FeedPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: () => apiClient.get<{ data: FeedItem[] }>("/feed"),
    refetchInterval: 15_000,
  });

  const feed = data?.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Intelligence Feed"
        description="Live feed of signals and opportunities."
        actions={
          <Badge variant="secondary" className="gap-1.5 text-[10.5px] uppercase tracking-wide font-semibold">
            <Radio className="w-3 h-3 animate-pulse" />
            Live
          </Badge>
        }
      />

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
          ))}
        </div>
      ) : feed.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-border/60">
          <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center text-muted-foreground mx-auto mb-4">
            <Radio className="w-5 h-5" />
          </div>
          <h3 className="text-[15px] font-semibold text-foreground mb-1">No recent signals</h3>
          <p className="text-[13px] text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Run discovery and enrichment to start generating signals.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {feed.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.4), ease: "easeOut" }}
            >
              <Card
                className={cn(
                  "group relative overflow-hidden cursor-pointer",
                  "border-border/60 bg-card/40",
                  "hover:bg-card/70 hover:border-border/80 hover:shadow-premium",
                  "transition-all duration-200"
                )}
                onClick={() => navigate(`#/company/${item.companyId}`)}
              >
                <div
                  className={cn(
                    "absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full",
                    item.importance >= 80
                      ? "bg-success"
                      : item.importance >= 60
                        ? "bg-info"
                        : "bg-muted"
                  )}
                />
                <div className="p-5 pl-6">
                  <div className="flex items-start gap-4">
                    <FeedIcon type={item.type} signalType={item.signalType} importance={item.importance} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className="text-[14px] font-semibold text-foreground tracking-tight">
                          {item.companyName}
                        </span>
                        {item.companyDomain && (
                          <span className="text-[12px] text-muted-foreground font-mono">{item.companyDomain}</span>
                        )}
                        <StatusBadge
                          status={item.type}
                          tone={TYPE_TONE[item.type]}
                        />
                      </div>
                      <div className="text-[13.5px] text-foreground leading-relaxed mb-1.5 group-hover:text-foreground/90 transition-colors">
                        {item.title}
                      </div>
                      {item.description && (
                        <div className="text-[12.5px] text-muted-foreground leading-relaxed line-clamp-2">
                          {item.description}
                        </div>
                      )}
                      {item.signalType && SIGNAL_TYPE_META[item.signalType] && (
                        <div className="mt-2.5">
                          <StatusBadge
                            status={item.signalType}
                            tone={SIGNAL_TYPE_META[item.signalType].tone}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
                      <div
                        className={cn(
                          "text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-md border",
                          item.importance >= 80
                            ? "text-success bg-success/8 border-success/15"
                            : item.importance >= 60
                              ? "text-info bg-info/8 border-info/15"
                              : "text-muted-foreground bg-muted/40 border-border/60"
                        )}
                      >
                        {item.importance}
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeedIcon({ type, signalType, importance }: { type: string; signalType: string | null; importance: number }) {
  const bgColor = importance >= 75 ? "bg-success/10 text-success" : importance >= 50 ? "bg-info/10 text-info" : "bg-muted/40 text-muted-foreground";

  if (type === "recommendation") {
    return (
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105", bgColor)}>
        <Zap className="w-4 h-4" />
      </div>
    );
  }

  let Icon = AlertCircle;
  switch (signalType) {
    case "pricing_change":
    case "new_pricing_page":
    case "enterprise_feature":
      Icon = DollarSign;
      break;
    case "hiring_increase":
    case "hiring_spike":
      Icon = Users2;
      break;
    case "product_launch":
    case "funding_announcement":
      Icon = TrendingUp;
      break;
    case "technology_change":
      Icon = Sparkles;
      break;
  }

  return (
    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105", bgColor)}>
      <Icon className="w-4 h-4" />
    </div>
  );
}
