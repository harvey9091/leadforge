"use client";

/**
 * Companies page — premium redesign.
 *
 * Features:
 *  - Full-text search (name, domain, description, tags)
 *  - Filter by source, country, industry, status
 *  - Sort by discovered date, name, etc.
 *  - Grid view + table view
 *  - Pagination
 *  - Add company dialog
 */

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Plus, LayoutGrid, List, MapPin, Calendar, Filter, Globe, Download, Search as SearchIcon, X } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, selectionColumn } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";
import { formatRelativeTime, formatDate, cn, initials } from "@/lib/utils";
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
  score?: number | null;
  technologies?: string[];
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
  const [statusFilter, setStatusFilter] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);

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

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filteredData = React.useMemo(() => {
    const currentData = data?.data;
    if (!currentData) return [];
    if (!statusFilter) return currentData;
    return currentData.filter((c) => c.status === statusFilter);
  }, [data?.data, statusFilter]);

  const allStatuses = React.useMemo(() => {
    const statuses = new Set<string>();
    (data?.data ?? []).forEach((c) => { if (c.status) statuses.add(c.status); });
    return Array.from(statuses).sort();
  }, [data?.data]);

  const addMutation = useMutation({
    mutationFn: async (input: { name: string; website?: string; industry?: string; country?: string; description?: string }) => {
      return apiClient.post<{ id: string }>("/companies", {
        name: input.name,
        website: input.website,
        industry: input.industry,
        country: input.country,
        description: input.description,
        source: "Manual",
        tags: "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Company added", description: "The company has been created." });
      setAddDialogOpen(false);
    },
    onError: (err) => {
      toast({ title: "Failed to add company", description: err instanceof Error ? err.message : "", variant: "destructive" });
    },
  });

  const columns: ColumnDef<Company>[] = React.useMemo(
    () => [
      selectionColumn<Company>(),
      {
        id: "name",
        header: "Company",
        size: 260,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-8 w-8 rounded-md shrink-0">
                {c.logoUrl && <AvatarImage src={c.logoUrl} alt={c.name} />}
                <AvatarFallback className="rounded-md text-[11px] font-semibold bg-muted/60 text-foreground">
                  {initials(c.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground truncate">{c.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{c.domain ?? "—"}</div>
              </div>
            </div>
          );
        },
      },
      {
        id: "domain",
        header: "Domain",
        size: 160,
        cell: ({ row }) => (
          <span className="text-[12.5px] text-muted-foreground truncate block max-w-[160px]">{row.original.domain ?? "—"}</span>
        ),
      },
      {
        id: "industry",
        header: "Industry",
        size: 130,
        cell: ({ row }) => (
          <span className="text-[12.5px] text-muted-foreground">{row.original.industry ?? "—"}</span>
        ),
      },
      {
        id: "score",
        header: "Score",
        size: 120,
        cell: ({ row }) => {
          const score = (row.original as any).score ?? (row.original as any).qualification?.score ?? null;
          const numericScore = typeof score === "number" ? score : null;
          return (
            <div className="flex items-center gap-2.5 min-w-[100px]">
              <Progress value={numericScore ?? 0} className="h-1.5 flex-1 bg-muted/60 [&_[data-slot=progress-indicator]]:bg-foreground/80" />
              <span className="text-[11.5px] text-muted-foreground tabular-nums w-8 text-right">
                {numericScore !== null ? `${Math.round(numericScore)}` : "—"}
              </span>
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
        id: "technologies",
        header: "Technologies",
        size: 200,
        cell: ({ row }) => {
          const techs = row.original.technologies ?? row.original.tags ?? [];
          if (!techs || techs.length === 0) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-1 flex-wrap">
              {techs.slice(0, 3).map((t: string, i: number) => (
                <Badge key={i} variant="outline" className="text-[10px] font-normal h-5">{t}</Badge>
              ))}
              {techs.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{techs.length - 3}</span>
              )}
            </div>
          );
        },
      },
      {
        id: "discoveredAt",
        header: "Discovered",
        size: 110,
        cell: ({ row }) => (
          <span className="text-[12.5px] text-muted-foreground tabular-nums">
            {formatDate(row.original.discoveredAt, { month: "short", day: "numeric" })}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Companies"
        description="Every discovered company in the database."
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

      {/* Status filter chips */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {allStatuses.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter((prev) => (prev === status ? null : status))}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-all duration-150",
              statusFilter === status
                ? "bg-foreground/10 text-foreground shadow-sm"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            {status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        ))}
        {statusFilter && (
          <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setStatusFilter(null)}>
            Clear
          </Button>
        )}
      </div>

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
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
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
        {(sourceFilter || countryFilter || industryFilter || statusFilter) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => { setSourceFilter(null); setCountryFilter(null); setIndustryFilter(null); setStatusFilter(null); setPage(1); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mb-4">
          <BulkActionsBar selectedIds={selected} onClear={() => setSelected([])} />
        </div>
      )}

      {view === "table" ? (
        <DataTable
          columns={columns}
          data={filteredData}
          loading={isLoading}
          page={page}
          pageSize={pageSize}
          total={data?.pagination.total ?? 0}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
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
          toolbarActions={
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 h-8">
                  <Plus className="w-3.5 h-3.5" />
                  Add Company
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-[15px]">Add Company</DialogTitle>
                </DialogHeader>
                <AddCompanyForm onSuccess={() => setAddDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          }
        />
      ) : (
        <CompanyGrid companies={data?.data ?? []} loading={isLoading} total={data?.pagination.total ?? 0} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Company Form
// ---------------------------------------------------------------------------

function AddCompanyForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [description, setDescription] = React.useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      return apiClient.post<{ id: string }>("/companies", {
        name: name.trim(),
        website: website.trim() || undefined,
        industry: industry.trim() || undefined,
        country: country.trim() || undefined,
        description: description.trim() || undefined,
        source: "Manual",
        tags: "",
      });
    },
    onSuccess: () => {
      toast({ title: "Company added", description: `${name} has been created.` });
      onSuccess();
    },
    onError: (err) => {
      toast({ title: "Failed to add company", description: err instanceof Error ? err.message : "", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Name required", description: "Please enter a company name.", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label className="text-[12px] font-medium">Name <span className="text-destructive">*</span></Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." className="h-8 text-[13px]" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px] font-medium">Website</Label>
        <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" className="h-8 text-[13px]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[12px] font-medium">Industry</Label>
          <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="SaaS" className="h-8 text-[13px]" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px] font-medium">Country</Label>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="USA" className="h-8 text-[13px]" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px] font-medium">Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description…" className="text-[13px] min-h-[80px]" />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onSuccess}>Cancel</Button>
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating…" : "Create Company"}
        </Button>
      </DialogFooter>
    </form>
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
        <Button variant="outline" size="sm" className={cn("h-7 text-[11.5px] gap-1", value && "border-foreground/40")}>
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
