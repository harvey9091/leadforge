"use client";

/**
 * Intelligence Feed page — Phase 7
 *
 * Live feed of important events:
 *  - Signals (product launches, pricing changes, hiring spikes, funding)
 *  - Recommendations (high priority, needs review, export now)
 *  - Trend summary
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
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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

export function FeedPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: () => apiClient.get<{ data: FeedItem[] }>("/feed"),
    refetchInterval: 15_000,
  });

  const feed = data?.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-[1000px] mx-auto">
      <PageHeader
        title="Intelligence Feed"
        description="Live feed of important signals, opportunities, and recommendations."
        actions={
          <Badge variant="secondary" className="gap-1 text-[10.5px] uppercase tracking-wide font-semibold">
            <Radio className="w-3 h-3 animate-pulse" />
            Live
          </Badge>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : feed.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Radio className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-[14px] font-semibold text-foreground mb-1">No recent signals</h3>
          <p className="text-[12.5px] text-muted-foreground">
            Run discovery and enrichment to start generating signals.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {feed.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
            >
              <Card
                className="p-4 border-border/60 bg-card/40 hover:bg-card/60 hover:border-border/80 transition-colors cursor-pointer"
                onClick={() => navigate(`#/company/${item.companyId}`)}
              >
                <div className="flex items-start gap-3">
                  <FeedIcon type={item.type} signalType={item.signalType} importance={item.importance} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-semibold text-foreground">{item.companyName}</span>
                      {item.companyDomain && (
                        <span className="text-[11px] text-muted-foreground truncate">{item.companyDomain}</span>
                      )}
                    </div>
                    <div className="text-[12.5px] text-foreground mb-1">{item.title}</div>
                    {item.description && (
                      <div className="text-[11.5px] text-muted-foreground line-clamp-2">{item.description}</div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] font-semibold",
                        item.importance >= 80 ? "text-success border-success/30" :
                        item.importance >= 60 ? "text-info border-info/30" :
                        "text-muted-foreground"
                      )}
                    >
                      {item.importance}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {formatRelativeTime(item.timestamp)}
                    </span>
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
  const iconClass = cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0", importance >= 75 ? "bg-success/10 text-success" : importance >= 50 ? "bg-info/10 text-info" : "bg-muted/40 text-muted-foreground");

  if (type === "recommendation") {
    return <div className={iconClass}><Zap className="w-4 h-4" /></div>;
  }

  switch (signalType) {
    case "pricing_change":
    case "new_pricing_page":
    case "enterprise_feature":
      return <div className={iconClass}><DollarSign className="w-4 h-4" /></div>;
    case "hiring_increase":
    case "hiring_spike":
      return <div className={iconClass}><Users2 className="w-4 h-4" /></div>;
    case "product_launch":
    case "funding_announcement":
      return <div className={iconClass}><TrendingUp className="w-4 h-4" /></div>;
    case "technology_change":
      return <div className={iconClass}><Sparkles className="w-4 h-4" /></div>;
    default:
      return <div className={iconClass}><AlertCircle className="w-4 h-4" /></div>;
  }
}
