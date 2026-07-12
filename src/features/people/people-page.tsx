"use client";

/**
 * People page — contacts discovered and verified across all companies.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Mail, Linkedin, MoreHorizontal, BadgeCheck } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, selectionColumn } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function PeoplePage() {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = React.useDeferredValue(search);

  const { data, isLoading } = useQuery({
    queryKey: ["people", { page, pageSize, search: debouncedSearch }],
    queryFn: () =>
      apiClient.get<Paginated<Person>>("/people", {
        page,
        pageSize,
        q: debouncedSearch || undefined,
      }),
  });

  const columns: ColumnDef<Person>[] = React.useMemo(
    () => [
      selectionColumn<Person>(),
      {
        id: "fullName",
        header: "Name",
        size: 220,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarFallback className="bg-muted text-[10.5px] font-medium">
                  {initials(p.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground truncate flex items-center gap-1">
                  {p.fullName}
                  {p.verified && <BadgeCheck className="w-3 h-3 text-info" />}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{p.title ?? "—"}</div>
              </div>
            </div>
          );
        },
      },
      {
        id: "company",
        header: "Company",
        size: 180,
        cell: ({ row }) => (
          <span className="text-[12.5px] text-muted-foreground truncate">
            {row.original.company?.name ?? "—"}
          </span>
        ),
      },
      {
        id: "email",
        header: "Email",
        size: 240,
        cell: ({ row }) => {
          const p = row.original;
          if (!p.email) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3 h-3" />
              <span className="truncate">{p.email}</span>
              {p.emailVerified && <BadgeCheck className="w-3 h-3 text-success shrink-0" />}
            </span>
          );
        },
      },
      {
        id: "department",
        header: "Department",
        size: 130,
        cell: ({ row }) => (
          <span className="text-[12px] text-muted-foreground">{row.original.department ?? "—"}</span>
        ),
      },
      {
        id: "seniority",
        header: "Seniority",
        size: 110,
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10.5px] font-normal">
            {row.original.seniority ?? "—"}
          </Badge>
        ),
      },
      {
        id: "linkedinUrl",
        header: "LinkedIn",
        size: 80,
        cell: ({ row }) =>
          row.original.linkedinUrl ? (
            <a href={row.original.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
              <Linkedin className="w-3.5 h-3.5" />
            </a>
          ) : (
            "—"
          ),
      },
      {
        id: "createdAt",
        header: "Added",
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
        cell: () => (
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="People"
        description="Contacts discovered, verified, and tracked across all companies."
        actions={
          <Button size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add person
          </Button>
        }
      />
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
