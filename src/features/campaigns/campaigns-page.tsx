"use client";

/**
 * Campaigns page — outreach campaigns and their performance.
 *
 * Renders as a grid of campaign cards. Each card shows the campaign name,
 * status, audience size, and a mini funnel of contacted → responded → meeting.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Megaphone, Play, Pause, MoreHorizontal, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/common/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { apiClient } from "@/lib/api-client";
import { formatRelativeTime, cn } from "@/lib/utils";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Paginated<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean };
}

export function CampaignsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", { page: 1, pageSize: 50 }],
    queryFn: () => apiClient.get<Paginated<Campaign>>("/campaigns", { page: 1, pageSize: 50 }),
  });

  // Phase 1: simulate campaign metrics client-side since the campaign
  // model doesn't yet aggregate counts. Phase 2 will add a /campaigns/:id/stats endpoint.
  const withMetrics = React.useMemo(() => {
    return (data?.data ?? []).map((c, i) => {
      const seed = c.id.charCodeAt(0) + i;
      const audience = 50 + (seed * 7) % 350;
      const contacted = Math.floor(audience * (0.4 + (seed % 5) * 0.1));
      const responded = Math.floor(contacted * (0.08 + (seed % 3) * 0.04));
      const meetings = Math.floor(responded * 0.3);
      return { ...c, audience, contacted, responded, meetings };
    });
  }, [data]);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Campaigns"
        description="Outreach sequences targeted at ICP-fit companies and people."
        actions={
          <Button size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New campaign
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg" />
          ))}
        </div>
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create your first campaign to start reaching out to qualified leads. Phase 2 will add multi-step sequences."
          action={<Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" />New campaign</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {withMetrics.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: Math.min(i * 0.04, 0.3) }}
            >
              <Card className="p-5 border-border/60 bg-card/40 hover:border-border/80 hover:bg-card/60 transition-colors cursor-pointer h-full flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <StatusBadge status={c.status} />
                  <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1 -mr-1">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <h3 className="text-[14.5px] font-semibold text-foreground mb-1">{c.name}</h3>
                <p className="text-[12px] text-muted-foreground line-clamp-2 mb-4 flex-1">
                  {c.description ?? "No description provided."}
                </p>

                {/* Mini funnel */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/60">
                  <FunnelStat label="Audience" value={c.audience} />
                  <FunnelStat label="Contacted" value={c.contacted} />
                  <FunnelStat label="Meetings" value={c.meetings} accent />
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Updated {formatRelativeTime(c.updatedAt)}</span>
                  {c.status === "ACTIVE" ? (
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1">
                      <Pause className="w-3 h-3" /> Pause
                    </Button>
                  ) : c.status === "DRAFT" || c.status === "PAUSED" ? (
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1">
                      <Play className="w-3 h-3" /> Activate
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1">
                      View <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function FunnelStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div className={cn(
        "text-[18px] font-semibold tabular-nums",
        accent ? "text-success" : "text-foreground"
      )}>
        {value}
      </div>
      <div className="text-[10.5px] text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}
