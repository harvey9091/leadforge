"use client";

/**
 * Leads page — the primary workspace for sales teams.
 *
 * Premium redesign:
 *  - Refined filter chips with better states
 *  - Cleaner table toolbar
 *  - Better action buttons
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue } from "react";
import { type ColumnDef, type SortingState } from "@tanstack/react-table";
import {
  Download,
  Plus,
  MoreHorizontal,
  ExternalLink,
  Mail,
  Star,
  Trash2,
  Filter,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, selectionColumn } from "@/components/data-table/data-table";
import { GradeBadge, StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api-client";
import { formatRelativeTime, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { AddLeadDialog } from "@/features/leads/add-lead-dialog";

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  headquarters: string | null;
  grade: string | null;
  score: number | null;
  status: string;
  stage: string | null;
  createdAt: string;
  technologies: string[];
}

interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const STATUS_FILTERS = [
  { value: "NEW", label: "New" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "RESPONDED", label: "Responded" },
  { value: "MEETING_BOOKED", label: "Meeting" },
];

export function LeadsPage() {
  const { toast } = useToast();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string | null>(null);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [selected, setSelected] = React.useState<string[]>([]);

  // Debounce search
  const debouncedSearch = useDeferredValue(search);

  const sortParam = sorting[0]
    ? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`
    : "createdAt:desc";

  const { data, isLoading } = useQuery({
    queryKey: ["companies", { page, pageSize, search: debouncedSearch, status: statusFilter, sort: sortParam }],
    queryFn: () =>
      apiClient.get<Paginated<Company>>("/companies", {
        page,
        pageSize,
        q: debouncedSearch || undefined,
        status: statusFilter ?? undefined,
        sort: sortParam,
      }),
  });

  const columns: ColumnDef<Company>[] = React.useMemo(
    () => [
      selectionColumn<Company>(),
      {
        id: "name",
        header: "Company",
        size: 240,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-md bg-muted/60 flex items-center justify-center text-[10.5px] font-semibold text-foreground shrink-0">
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground truncate">{c.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{c.domain ?? "—"}</div>
              </div>
            </div>
          );
        },
      },
      {
        id: "industry",
        header: "Industry",
        size: 140,
        cell: ({ row }) => (
          <span className="text-[12.5px] text-muted-foreground truncate">
            {row.original.industry ?? "—"}
          </span>
        ),
      },
      {
        id: "stage",
        header: "Stage",
        size: 110,
        cell: ({ row }) => (
          <span className="text-[12px] text-muted-foreground">
            {row.original.stage ? row.original.stage.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : "—"}
          </span>
        ),
      },
      {
        id: "grade",
        header: "Grade",
        size: 70,
        cell: ({ row }) => (row.original.grade ? <GradeBadge grade={row.original.grade} /> : "—"),
      },
      {
        id: "score",
        header: "Score",
        size: 80,
        cell: ({ row }) => {
          const score = row.original.score;
          if (score === null) return "—";
          return (
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    score >= 80 ? "bg-success" : score >= 60 ? "bg-warning" : "bg-destructive"
                  )}
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className="text-[11.5px] font-medium tabular-nums text-foreground">{score}</span>
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        size: 120,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "createdAt",
        header: "Discovered",
        size: 110,
        cell: ({ row }) => (
          <span className="text-[12px] text-muted-foreground tabular-nums">
            {formatRelativeTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 40,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem className="text-[12.5px]">
                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[12.5px]">
                <Mail className="w-3.5 h-3.5 mr-2" />
                Contact
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[12.5px]">
                <Star className="w-3.5 h-3.5 mr-2" />
                Star
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-[12.5px] text-destructive">
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Disqualify
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    []
  );

  const onExport = () => {
    toast({
      title: "Export queued",
      description: `${selected.length || "All"} leads will be exported to CSV. (Phase 2)`,
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Leads"
        description="Qualified companies and people in your active pipeline."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5 border-border/60" onClick={onExport}>
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            <AddLeadDialog />
          </>
        }
      />

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        <div className="flex items-center gap-1 text-[11.5px] text-muted-foreground mr-1 font-medium">
          <Filter className="w-3 h-3" />
          Status:
        </div>
        <FilterChip
          active={statusFilter === null}
          onClick={() => { setStatusFilter(null); setPage(1); }}
        >
          All
        </FilterChip>
        {STATUS_FILTERS.map((s) => (
          <FilterChip
            key={s.value}
            active={statusFilter === s.value}
            onClick={() => { setStatusFilter(s.value); setPage(1); }}
          >
            {s.label}
          </FilterChip>
        ))}
      </div>

      {isLoading && !data ? (
        <Skeleton className="h-[600px] w-full rounded-lg" />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          page={page}
          pageSize={pageSize}
          total={data?.pagination.total ?? 0}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder="Search by name or domain…"
          sorting={sorting}
          onSortingChange={setSorting}
          enableSelection
          onSelectionChange={setSelected}
          bulkActions={(ids) => (
            <>
              <Button variant="outline" size="sm" className="h-7 text-[11.5px]" onClick={onExport}>
                <Download className="w-3 h-3 mr-1" />
                Export ({ids.length})
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[11.5px]">
                <Mail className="w-3 h-3 mr-1" />
                Contact
              </Button>
            </>
          )}
          emptyTitle="No leads yet"
          emptyDescription="Discovery workers haven't found any leads matching your filters. Try adjusting or run a discovery job from the System page."
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 px-2.5 rounded-md text-[11.5px] font-medium border transition-all duration-200",
        active
          ? "bg-foreground text-background border-foreground shadow-sm"
          : "bg-transparent text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
