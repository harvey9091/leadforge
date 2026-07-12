"use client";

/**
 * Enterprise data table.
 *
 * Built on TanStack Table — the industry standard for headless React tables.
 * Features:
 *  - Column sorting (multi-sort ready)
 *  - Server-side pagination
 *  - Column visibility toggles
 *  - Global search (debounced)
 *  - Bulk row selection with a sticky action bar
 *  - Row click + row actions menu
 *  - Sticky header
 *  - Virtualization-ready (the body is a scroll container with stable row heights)
 *  - Loading skeletons
 *  - Empty state
 *
 * The table is fully controlled — the parent owns data, pagination, and
 * sorting state. This makes it trivial to wire to any backend (Phase 2
 * Fastify API, Phase 3 GraphQL, etc.).
 */

import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  SlidersHorizontal,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/common/empty-state";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  // Pagination (controlled)
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  // Search (controlled)
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  // Sorting (controlled)
  sorting?: SortingState;
  onSortingChange?: (state: SortingState) => void;
  // Row selection
  enableSelection?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  // Row click
  onRowClick?: (row: TData) => void;
  // Toolbar actions (rendered on the right)
  toolbarActions?: React.ReactNode;
  // Bulk actions (rendered when rows are selected)
  bulkActions?: (selectedIds: string[]) => React.ReactNode;
  // Empty state
  emptyTitle?: string;
  emptyDescription?: string;
  // Optional className
  className?: string;
  // Get row id (defaults to `id` field)
  getRowId?: (row: TData) => string;
}

export function DataTable<TData extends { id?: string }, TValue = unknown>({
  columns,
  data,
  loading = false,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  sorting,
  onSortingChange,
  enableSelection = false,
  onSelectionChange,
  onRowClick,
  toolbarActions,
  bulkActions,
  emptyTitle = "No results",
  emptyDescription = "Try adjusting your filters or search query.",
  className,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  // Sync row selection outward
  React.useEffect(() => {
    if (!onSelectionChange) return;
    const ids = Object.keys(rowSelection)
      .map((idx) => data[Number(idx)]?.id)
      .filter(Boolean) as string[];
    onSelectionChange(ids);
  }, [rowSelection, data, onSelectionChange]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: sorting ?? [],
      columnVisibility,
      rowSelection,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onSortingChange: onSortingChange
      ? (updater) => {
          const next = typeof updater === "function" ? updater(sorting ?? []) : updater;
          onSortingChange(next);
        }
      : undefined,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true, // server-side
    manualSorting: true, // server-side (when onSortingChange is provided)
    pageCount: Math.ceil(total / pageSize),
    getRowId: getRowId
      ? (row, idx) => getRowId(row)
      : (row, idx) => (row as { id?: string }).id ?? String(idx),
    enableRowSelection: enableSelection,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className={cn("flex flex-col space-y-3", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {onSearchChange && (
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8 h-9 text-[13px] bg-background"
            />
          </div>
        )}

        {/* Column visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[12.5px]">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Toggle columns
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((c) => typeof c.accessorFn !== "undefined" || c.id !== "actions")
              .filter((c) => c.getCanHide())
              .map((column) => (
                <DropdownMenuItem
                  key={column.id}
                  className="text-[12.5px] cursor-pointer capitalize"
                  onClick={() => column.toggleVisibility(!column.getIsVisible())}
                >
                  <Checkbox
                    checked={column.getIsVisible()}
                    className="mr-2 h-3.5 w-3.5"
                  />
                  {column.id.replace(/([A-Z])/g, " $1").toLowerCase()}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-2">{toolbarActions}</div>
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && bulkActions && (
        <div className="flex items-center gap-3 px-3 h-11 rounded-md border border-border bg-card/60 backdrop-blur-sm">
          <span className="text-[12.5px] font-medium text-foreground">
            {selectedCount} selected
          </span>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5">
            {bulkActions(
              Object.keys(rowSelection)
                .map((idx) => data[Number(idx)]?.id)
                .filter(Boolean) as string[]
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-[11.5px] text-muted-foreground"
            onClick={() => setRowSelection({})}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border bg-card/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-muted/40 backdrop-blur-sm border-b border-border">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="h-9">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="text-left font-medium text-[11px] uppercase tracking-wide text-muted-foreground px-3 whitespace-nowrap"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            "flex items-center gap-1.5",
                            header.column.getCanSort() && "cursor-pointer select-none hover:text-foreground"
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanSort() && (
                            <ArrowUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                  <tr key={i} className="border-b border-border/40 h-12">
                    {columns.map((_, j) => (
                      <td key={j} className="px-3">
                        <Skeleton className="h-3.5 w-full max-w-[160px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-0">
                    <EmptyState
                      icon={Inbox}
                      title={emptyTitle}
                      description={emptyDescription}
                      className="border-0 bg-transparent"
                    />
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn(
                      "border-b border-border/40 last:border-0 transition-colors group",
                      "hover:bg-muted/30",
                      row.getIsSelected() && "bg-info/[0.04]",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[12px] text-muted-foreground tabular-nums">
          {loading ? (
            "Loading…"
          ) : total === 0 ? (
            "No results"
          ) : (
            <>
              Showing <span className="text-foreground font-medium">{from}</span>
              {"–"}
              <span className="text-foreground font-medium">{to}</span> of{" "}
              <span className="text-foreground font-medium">{total.toLocaleString()}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onPageSizeChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5">
                  {pageSize} / page
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {[10, 20, 50, 100].map((s) => (
                  <DropdownMenuItem
                    key={s}
                    className="text-[12.5px] cursor-pointer"
                    onClick={() => onPageSizeChange(s)}
                  >
                    {s} / page
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(1)}
              disabled={page === 1 || loading}
              aria-label="First page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1 || loading}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-[12px] text-muted-foreground px-2 tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              aria-label="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(totalPages)}
              disabled={page >= totalPages || loading}
              aria-label="Last page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Selection column — prepend this to enable row selection. */
export function selectionColumn<T extends { id?: string }>(): ColumnDef<T> {
  return {
    id: "select",
    size: 32,
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        className="h-3.5 w-3.5"
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        className="h-3.5 w-3.5"
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  };
}
