"use client";

/**
 * Companies page — Phase 2: real discovered companies.
 *
 * Features:
 *  - Full-text search (name, domain, description, tags)
 *  - Filter by source, country, industry
 *  - Sort by discovered date, name, etc.
 *  - Grid view + table view
 *  - Pagination
 */

import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Plus, LayoutGrid, List, MoreHorizontal, MapPin, Calendar, Filter, Globe, Download, Search as SearchIcon, X } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, selectionColumn } from "@/components/data-table/data-table";
import { GradeBadge, StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api-client";
import { formatRelativeTime, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Company {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  description: string | null;
  logoUrl: string | null;
  industry: string | null;
  country: string | null;
  headquarters: string | null;
  foundedYear: number | null;
  fundingStage: string | null;
  employeeEstimate: string | null;
  status: string;
  discoveredAt: string;
  createdAt: string;
  sources: Array<{ type: string; url: string | null }>;
  tags: string[];
}

interface Paginated<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean };
}

interface FilterOptions {
  countries: string[];
  industries: string[];
  sources: string[];
}

const SOURCE_LABELS: Record<string, string> = {
  HACKER_NEWS: "Hacker News",
  PRODUCT_HUNT: "Product Hunt",
  YC: "Y Combinator",
  BETALIST: "BetaList",
  DEVHUNT: "DevHunt",
  UNEED: "Uneed",
};

export function CompaniesPage() {
  const [view, setView] = React.useState<"table" | "grid">("table");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [search, setSearch] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "discoveredAt", desc: true }]);
  const [sourceFilter, setSourceFilter] = React.useState<string | null>(null);
  const [countryFilter, setCountryFilter] = React.useState<string | null>(null);
  const [industryFilter, setIndustryFilter] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);

  const debouncedSearch = React.useDeferredValue(search);

  const sortParam = sorting[0] ? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}` : "discoveredAt:desc";

  const { data, isLoading } = useQuery({
    queryKey: ["companies", { page, pageSize, search: debouncedSearch, sort: sortParam, source: sourceFilter, country: countryFilter, industry: industryFilter }],
    queryFn: () =>
      apiClient.get<Paginated<Company>>("/companies", {
        page,
        pageSize,
        q: debouncedSearch || undefined,
        source: sourceFilter ?? undefined,
        country: countryFilter ?? undefined,
        industry: industryFilter ?? undefined,
        sort: sortParam,
      }),
  });

  const { data: filterOptions } = useQuery({
    queryKey: ["companies", "filter-options"],
    queryFn: () => apiClient.get<FilterOptions>("/companies/filters"),
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
          <span className="text-[12.5px] text-muted-foreground">{row.original.industry ?? "—"}</span>
        ),
      },
      {
        id: "country",
        header: "Country",
        size: 120,
        cell: ({ row }) => (
          <span className="text-[12px] text-muted-foreground flex items-center gap-1">
            {row.original.country ? <><MapPin className="w-3 h-3" />{row.original.country}</> : "—"}
          </span>
        ),
      },
      {
        id: "sources",
        header: "Sources",
        size: 120,
        cell: ({ row }) => {
          const sources = row.original.sources ?? [];
          if (sources.length === 0) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-1 flex-wrap">
              {sources.slice(0, 2).map((s, i) => (
                <Badge key={i} variant="outline" className="text-[9.5px] py-0 h-4 font-normal">
                  {SOURCE_LABELS[s.type] ?? s.type}
                </Badge>
              ))}
              {sources.length > 2 && (
                <span className="text-[10px] text-muted-foreground">+{sources.length - 2}</span>
              )}
            </div>
          );
        },
      },
      {
        id: "fundingStage",
        header: "Funding",
        size: 100,
        cell: ({ row }) => (
          <span className="text-[12px] text-muted-foreground">{row.original.fundingStage ?? "—"}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        size: 110,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "discoveredAt",
        header: "Discovered",
        size: 110,
        cell: ({ row }) => (
          <span className="text-[12px] text-muted-foreground tabular-nums">
            {formatRelativeTime(row.original.discoveredAt)}
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
        title="Companies"
        description="Real discovered companies from all sources."
        actions={
          <>
            <div className="flex items-center rounded-md border border-border p-0.5">
              <Button variant={view === "table" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setView("table")}>
                <List className="w-3.5 h-3.5" />
              </Button>
              <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setView("grid")}>
                <LayoutGrid className="w-3.5 h-3.5" />
              </Button>
            </div>
            <ExportDialog selectedIds={selected} filters={{ q: debouncedSearch }} />
          </>
        }
      />

      {/* Advanced search bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder='Search… (use "quotes", AND, OR, -exclude, industry:AI)'
            className="pl-8 h-9 text-[12.5px] font-mono"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {selected.length > 0 && (
          <BulkActionsBar selectedIds={selected} onClear={() => setSelected([])} />
        )}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
          <Filter className="w-3 h-3" />
        </div>
        <FilterDropdown
          label="Source"
          value={sourceFilter}
          options={filterOptions?.sources.map((s) => ({ value: s, label: SOURCE_LABELS[s] ?? s })) ?? []}
          onChange={(v) => { setSourceFilter(v); setPage(1); }}
        />
        <FilterDropdown
          label="Country"
          value={countryFilter}
          options={filterOptions?.countries.map((c) => ({ value: c, label: c })) ?? []}
          onChange={(v) => { setCountryFilter(v); setPage(1); }}
        />
        <FilterDropdown
          label="Industry"
          value={industryFilter}
          options={filterOptions?.industries.map((i) => ({ value: i, label: i })) ?? []}
          onChange={(v) => { setIndustryFilter(v); setPage(1); }}
        />
        {(sourceFilter || countryFilter || industryFilter) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => { setSourceFilter(null); setCountryFilter(null); setIndustryFilter(null); setPage(1); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {view === "table" ? (
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
          searchPlaceholder="Search by name, domain, description…"
          sorting={sorting}
          onSortingChange={setSorting}
          enableSelection
          selectedIds={selected}
          totalSelectedCount={selected.length}
          onSelectionChange={setSelected}
          onSelectAllChange={(allSelected) => {
            if (allSelected) {
              const allCurrentIds = (data?.data ?? []).map((c) => c.id);
              setSelected((prev) => Array.from(new Set([...prev, ...allCurrentIds])));
            } else {
              setSelected([]);
            }
          }}
          emptyTitle="No companies found"
          emptyDescription="No companies match your filters. Try adjusting your search or create a discovery job."
        />
      ) : (
        <CompanyGrid companies={data?.data ?? []} loading={isLoading} total={data?.pagination.total ?? 0} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter Dropdown
// ---------------------------------------------------------------------------

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string | null) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-7 text-[11.5px] gap-1", value && "border-foreground")}>
          {label}{value && <span className="text-muted-foreground">: {value}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-[12px] cursor-pointer" onClick={() => onChange(null)}>
          All {label.toLowerCase()}
        </DropdownMenuItem>
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            className="text-[12px] cursor-pointer"
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Grid View
// ---------------------------------------------------------------------------

function CompanyGrid({ companies, loading, total }: { companies: Company[]; loading: boolean; total: number }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="p-5 h-44 border-border/60">
            <div className="animate-pulse space-y-3">
              <div className="h-7 w-7 rounded-md bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
              <div className="h-2.5 w-full rounded bg-muted" />
              <div className="h-2.5 w-1/2 rounded bg-muted" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <Card className="p-10 text-center border-dashed">
        <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-[14px] font-semibold text-foreground mb-1">No companies found</h3>
        <p className="text-[12.5px] text-muted-foreground">
          {total === 0
            ? "Run a discovery job to find companies."
            : "Try adjusting your filters or search."}
        </p>
      </Card>
    );
  }

  return (
    <div>
      <div className="text-[12px] text-muted-foreground mb-3">
        {total.toLocaleString()} companies
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {companies.map((c) => (
          <Card key={c.id} className="p-5 border-border/60 bg-card/40 hover:border-border/80 hover:bg-card/60 transition-colors cursor-pointer">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-md bg-muted/60 flex items-center justify-center text-[12px] font-semibold text-foreground">
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              {c.sources[0] && (
                <Badge variant="outline" className="text-[9px] font-normal">
                  {SOURCE_LABELS[c.sources[0].type] ?? c.sources[0].type}
                </Badge>
              )}
            </div>
            <div className="text-[14px] font-semibold text-foreground truncate">{c.name}</div>
            <div className="text-[12px] text-muted-foreground truncate mb-2">{c.domain ?? "—"}</div>
            <p className="text-[12px] text-muted-foreground line-clamp-2 mb-3">
              {c.description ?? "No description available."}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {c.industry && <Badge variant="secondary" className="text-[10px] font-normal">{c.industry}</Badge>}
              {c.country && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />{c.country}
                </span>
              )}
              {c.foundedYear && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                  <Calendar className="w-2.5 h-2.5" />{c.foundedYear}
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export Dialog
// ---------------------------------------------------------------------------
function ExportDialog({ selectedIds, filters }: { selectedIds: string[]; filters: Record<string, unknown> }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [format, setFormat] = React.useState<"csv" | "json" | "xlsx">("csv");
  const [preview, setPreview] = React.useState<{ totalRows: number; estimatedSizeBytes: number; warnings: string[] } | null>(null);

  const exportMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post<{ fileUrl?: string; totalRows?: number }>("/workspace/exports", {
        format,
        selectedIds: selectedIds.length > 0 ? selectedIds : undefined,
        filters: selectedIds.length > 0 ? undefined : filters,
        preview: false,
      });
    },
    onSuccess: (data: { fileUrl?: string; totalRows?: number }) => {
      toast({
        title: "Export complete",
        description: `${data.totalRows ?? 0} rows exported`,
      });
      setOpen(false);
    },
    onError: (err) => {
      toast({ title: "Export failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post<{ preview: { totalRows: number; estimatedSizeBytes: number; warnings: string[] } }>("/workspace/exports", {
        format,
        selectedIds: selectedIds.length > 0 ? selectedIds : undefined,
        filters: selectedIds.length > 0 ? undefined : filters,
        preview: true,
      });
    },
    onSuccess: (data: { preview: { totalRows: number; estimatedSizeBytes: number; warnings: string[] } }) => {
      setPreview(data.preview);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="w-3.5 h-3.5" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Export companies</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1.5 block">Format</label>
            <div className="flex items-center gap-2">
              {(["csv", "json", "xlsx"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors uppercase",
                    format === f ? "border-foreground bg-foreground/5" : "border-border hover:bg-muted/40"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[12px] text-muted-foreground">
            {selectedIds.length > 0
              ? `Exporting ${selectedIds.length} selected companies`
              : "Exporting all companies matching current filters"}
          </div>

          {preview && (
            <Card className="p-3 border-border/60 bg-muted/20">
              <div className="text-[11px] space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Rows:</span><span className="font-medium">{preview.totalRows}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Est. size:</span><span className="font-medium">{(preview.estimatedSizeBytes / 1024).toFixed(1)} KB</span></div>
              </div>
              {preview.warnings.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/40 text-[10.5px] text-warning">
                  {preview.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                </div>
              )}
            </Card>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
            Preview
          </Button>
          <Button size="sm" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending} className="gap-1.5">
            {exportMutation.isPending ? "Exporting..." : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Bulk Actions Bar
// ---------------------------------------------------------------------------
function BulkActionsBar({ selectedIds, onClear }: { selectedIds: string[]; onClear: () => void }) {
  const { toast } = useToast();
  const [tagInput, setTagInput] = React.useState("");

  const bulkMutation = useMutation({
    mutationFn: async (action: { action: string; data?: unknown }) => {
      return apiClient.post<{ message?: string }>("/workspace/bulk", { ...action, companyIds: selectedIds });
    },
    onSuccess: (data: { message?: string }) => {
      toast({ title: "Bulk action complete", description: data.message });
      onClear();
    },
    onError: (err) => {
      toast({ title: "Bulk action failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    },
  });

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card/60">
      <span className="text-[11px] font-medium text-foreground">{selectedIds.length} selected</span>
      <div className="w-px h-4 bg-border mx-0.5" />
      <input
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        placeholder="tag name..."
        className="h-7 px-1.5 text-[11px] bg-transparent border border-border rounded w-24"
        onKeyDown={(e) => {
          if (e.key === "Enter" && tagInput.trim()) {
            bulkMutation.mutate({ action: "tag", data: tagInput.trim() });
            setTagInput("");
          }
        }}
      />
      <Button variant="ghost" size="sm" className="h-7 text-[10.5px] px-2" onClick={() => bulkMutation.mutate({ action: "reanalyze" })}>
        Re-analyze
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-[10.5px] px-2" onClick={() => bulkMutation.mutate({ action: "reenrich" })}>
        Re-enrich
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-[10.5px] px-2" onClick={() => bulkMutation.mutate({ action: "pin" })}>
        Pin
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-[10.5px] px-2 text-muted-foreground" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
