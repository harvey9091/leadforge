"use client";

/**
 * People page — contacts discovered and verified across your pipeline.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Mail, MoreHorizontal, BadgeCheck, Filter } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, selectionColumn } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiClient } from "@/lib/api-client";
import { initials, formatRelativeTime, cn } from "@/lib/utils";

interface Person {
  id: string;
  fullName: string;
  email: string | null;
  emailVerified: boolean;
  title: string | null;
  seniority: string | null;
  department: string | null;
  linkedinUrl: string | null;
  verified: boolean;
  createdAt: string;
  company: { id: string; name: string; domain: string | null; logoUrl: string | null } | null;
}

interface Paginated<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean };
}

type StatusFilter = "all" | "verified" | "unverified";

export function PeoplePage() {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const debouncedSearch = React.useDeferredValue(search);

  const { data, isLoading } = useQuery({
    queryKey: ["people", { page, pageSize, search: debouncedSearch, status: statusFilter }],
    queryFn: () =>
      apiClient.get<Paginated<Person>>("/people", {
        page,
        pageSize,
        q: debouncedSearch || undefined,
        verified: statusFilter !== "all" ? statusFilter === "verified" : undefined,
      }),
  });

  const columns: ColumnDef<Person>[] = React.useMemo(
    () => [
      selectionColumn<Person>(),
      {
        id: "fullName",
        header: "Name",
        size: 240,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="w-8 h-8 shrink-0 rounded-lg">
                <AvatarFallback className="bg-muted text-[11px] font-semibold">
                  {initials(p.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-foreground truncate flex items-center gap-1.5">
                  {p.fullName}
                  {p.verified && <BadgeCheck className="w-3.5 h-3.5 text-success shrink-0" />}
                </div>
                <div className="text-[11.5px] text-muted-foreground truncate mt-0.5">{p.title ?? "—"}</div>
              </div>
            </div>
          );
        },
      },
      {
        id: "email",
        header: "Email",
        size: 260,
        cell: ({ row }) => {
          const p = row.original;
          if (!p.email) return <span className="text-muted-foreground text-[12.5px]">—</span>;
          return (
            <span className="text-[12.5px] text-muted-foreground flex items-center gap-2 truncate">
              <Mail className="w-3.5 h-3.5 shrink-0 opacity-60" />
              <span className="truncate">{p.email}</span>
              {p.emailVerified && <BadgeCheck className="w-3 h-3 text-success shrink-0" />}
            </span>
          );
        },
      },
      {
        id: "company",
        header: "Company",
        size: 180,
        cell: ({ row }) => (
          <span className="text-[12.5px] text-muted-foreground truncate font-medium">
            {row.original.company?.name ?? "—"}
          </span>
        ),
      },
      {
        id: "title",
        header: "Title",
        size: 160,
        cell: ({ row }) => (
          <span className="text-[12.5px] text-muted-foreground truncate">
            {row.original.title ?? "—"}
          </span>
        ),
      },
      {
        id: "location",
        header: "Location",
        size: 140,
        cell: ({ row }) => (
          <span className="text-[12.5px] text-muted-foreground truncate">
            {row.original.company?.domain ?? "—"}
          </span>
        ),
      },
      {
        id: "verified",
        header: "Status",
        size: 120,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <StatusBadge
              status={p.verified ? "verified" : "unverified"}
              tone={p.verified ? "success" : "neutral"}
              label={p.verified ? "Verified" : "Unverified"}
            />
          );
        },
      },
      {
        id: "createdAt",
        header: "Discovered",
        size: 120,
        cell: ({ row }) => (
          <span className="text-[12.5px] text-muted-foreground tabular-nums">
            {formatRelativeTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 44,
        cell: () => (
          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        ),
      },
    ],
    []
  );

  const handleStatusFilterChange = (newFilter: StatusFilter) => {
    setStatusFilter(newFilter);
    setPage(1);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="People"
        description="Contacts discovered and verified across your pipeline."
        actions={
          <Button size="sm" className="gap-1.5 h-9 text-[13px] font-medium">
            <Plus className="w-3.5 h-3.5" />
            Add person
          </Button>
        }
      />

      {/* Status filter chips */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground mr-1 font-medium">
          <Filter className="w-3 h-3" />
          Status:
        </div>
        {(["all", "verified", "unverified"] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => handleStatusFilterChange(filter)}
            className={cn(
              "h-7 px-3 rounded-md text-[11.5px] font-medium border transition-all duration-200",
              statusFilter === filter
                ? "bg-foreground text-background border-foreground shadow-sm"
                : "bg-transparent text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {filter === "all" ? "All" : filter === "verified" ? "Verified" : "Unverified"}
          </button>
        ))}
        {statusFilter !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11.5px] text-muted-foreground hover:text-foreground"
            onClick={() => handleStatusFilterChange("all")}
          >
            Clear
          </Button>
        )}
      </div>

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
        searchPlaceholder="Search by name, email, or title…"
        enableSelection
        onSelectionChange={() => {}}
        emptyTitle="No people discovered yet"
        emptyDescription="People are discovered as part of company enrichment. Run an enrichment job from System."
      />
    </div>
  );
}
