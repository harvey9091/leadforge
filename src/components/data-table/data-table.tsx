"use client";

/**
 * Enterprise data table — premium redesign.
 *
 * Built on TanStack Table with:
 *  - Refined styling with better spacing
 *  - Smooth hover states
 *  - Better selection visualization
 *  - Improved sticky header
 *  - More polished empty state
 *  - Better pagination
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
  Minus,
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
  // Row selection (controlled, ID-based)
  enableSelection?: boolean;
  selectedIds?: string[];
  totalSelectedCount?: number;
  onSelectionChange?: (selectedIds: string[]) => void;
  onSelectAllChange?: (allSelected: boolean) => void;
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
  selectedIds = [],
  totalSelectedCount,
  onSelectionChange,
  onSelectAllChange,
  onRowClick,
  toolbarActions,
  bulkActions,
  emptyTitle = "No results",
  emptyDescription = "Try adjusting your filters or search query.",
  className,
  getRowId,
}: DataTableProps<TData, TValue>) {
  // Internal rowSelection state keyed by row IDs (not numeric indices).
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  // Tracks the last row the user Shift+Clicked from, enabling range selection.
  const lastSelectedRowIdRef = React.useRef<string | null>(null);

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  // Fast lookup: which IDs are present in the current page's data.
  const dataIdSetRef = React.useRef<Set<string>>(new Set());
  dataIdSetRef.current = new Set(
    data.map((row) => (getRowId ? getRowId(row) : (row as { id?: string }).id ?? String(row)))
  );

  // Sync internal rowSelection when selectedIds changes from outside.
  const prevSelectedIdsRef = React.useRef<string[]>([]);
  React.useEffect(() => {
    const prev = prevSelectedIdsRef.current;
    if (selectedIds.length !== prev.length || selectedIds.some((id, i) => id !== prev[i])) {
      prevSelectedIdsRef.current = selectedIds;
      const next: RowSelectionState = {};
      for (const id of selectedIds) {
        if (dataIdSetRef.current.has(id)) {
          next[id] = true;
        }
      }
      setRowSelection(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  // Notify parent of current-page selection changes.
  const updateSelection = React.useCallback(
    (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
      setRowSelection((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        const ids = Object.keys(next).filter((key) => dataIdSetRef.current.has(key));
        if (onSelectionChange) onSelectionChange(ids);
        return next;
      });
    },
    [onSelectionChange]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: sorting ?? [],
      columnVisibility,
      rowSelection,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: updateSelection,
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
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.ceil(total / pageSize),
    getRowId: getRowId
      ? (row, idx) => getRowId(row)
      : (row, idx) => (row as { id?: string }).id ?? String(idx),
    enableRowSelection: enableSelection,
    enableMultiRowSelection: true,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Rows selected on the current visible page.
  const currentPageSelectedCount = Object.keys(rowSelection).length;
  const effectiveSelectedCount = totalSelectedCount ?? selectedIds?.length ?? currentPageSelectedCount;

  return (
    <div className={cn("flex flex-col space-y-3", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {onSearchChange && (
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9 h-9 text-[13px] bg-background border-border/60"
            />
          </div>
        )}

        {/* Column visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[12.5px] border-border/60">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
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
      {effectiveSelectedCount > 0 && bulkActions && (
        <div className="flex items-center gap-3 px-3 h-11 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
          <span className="text-[12.5px] font-semibold text-foreground">
            {effectiveSelectedCount} selected
          </span>
          {effectiveSelectedCount > currentPageSelectedCount && (
            <span className="text-[10.5px] text-muted-foreground">
              ({currentPageSelectedCount} on this page)
            </span>
          )}
          <div className="w-px h-4 bg-border/60" />
          <div className="flex items-center gap-1.5">
            {bulkActions(selectedIds)}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-[11.5px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              setRowSelection({});
              if (onSelectionChange) onSelectionChange([]);
              if (onSelectAllChange) onSelectAllChange(false);
              lastSelectedRowIdRef.current = null;
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-muted/30 backdrop-blur-sm border-b border-border/60">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="h-11">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="text-left font-semibold text-[11px] uppercase tracking-wider text-muted-foreground px-4 whitespace-nowrap"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            "flex items-center gap-1.5",
                            header.column.getCanSort() && "cursor-pointer select-none hover:text-foreground transition-colors"
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
                  <tr key={i} className="border-b border-border/40 h-14">
                    {columns.map((_, j) => (
                      <td key={j} className="px-4">
                        <Skeleton className="h-4 w-full max-w-[160px]" />
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
                table.getRowModel().rows.map((row) => {
                  const isSelected = row.getIsSelected();
                  const rowId = row.id;

                  const handleRowClick = (e: React.MouseEvent) => {
                    if (!enableSelection) return;

                    const hasModifier = e.shiftKey || e.metaKey || e.ctrlKey;

                    if (hasModifier) {
                      e.stopPropagation();
                    }

                    if (e.shiftKey && lastSelectedRowIdRef.current) {
                      const allRows = table.getRowModel().rows;
                      const currentIdx = allRows.findIndex((r) => r.id === rowId);
                      const anchorIdx = allRows.findIndex((r) => r.id === lastSelectedRowIdRef.current);
                      if (currentIdx >= 0 && anchorIdx >= 0 && currentIdx !== anchorIdx) {
                        const [start, end] =
                          currentIdx < anchorIdx ? [currentIdx, anchorIdx] : [anchorIdx, currentIdx];
                        const rangeIds = allRows.slice(start, end + 1).map((r) => r.id);
                        updateSelection((prev) => {
                          const next = { ...prev };
                          rangeIds.forEach((id) => { next[id] = true; });
                          return next;
                        });
                        lastSelectedRowIdRef.current = rowId;
                        return;
                      }
                    }

                    if (e.metaKey || e.ctrlKey) {
                      updateSelection((prev) => {
                        const next = { ...prev };
                        if (next[rowId]) {
                          delete next[rowId];
                        } else {
                          next[rowId] = true;
                        }
                        return next;
                      });
                      lastSelectedRowIdRef.current = rowId;
                      return;
                    }

                    lastSelectedRowIdRef.current = rowId;
                    updateSelection({ [rowId]: true });
                    if (onRowClick) onRowClick(row.original);
                  };

                  return (
                    <tr
                      key={row.id}
                      data-state={isSelected ? "selected" : undefined}
                      className={cn(
                        "border-b border-border/40 last:border-0 transition-all duration-150 group",
                        "hover:bg-muted/30",
                        isSelected && "bg-info/[0.04]",
                        onRowClick && enableSelection && "cursor-pointer"
                      )}
                      onClick={handleRowClick}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[12.5px] text-muted-foreground tabular-nums">
          {loading ? (
            "Loading…"
          ) : total === 0 ? (
            "No results"
          ) : (
            <>
              Showing <span className="font-semibold text-foreground">{from}</span>
              {" – "}
              <span className="font-semibold text-foreground">{to}</span> of{" "}
              <span className="font-semibold text-foreground">{total.toLocaleString()}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onPageSizeChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-[12.5px] gap-1.5 border-border/60">
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
            <span className="text-[12.5px] text-muted-foreground px-2 tabular-nums font-medium">
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
    size: 40,
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllRowsSelected()}
        indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
        onChange={table.getToggleAllRowsSelectedHandler()}
        className="h-3.5 w-3.5"
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => {
      const handleClick = (e: React.MouseEvent) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          e.stopPropagation();
        }
        row.getToggleSelectedHandler()(e);
      };
      return (
        <Checkbox
          checked={row.getIsSelected()}
          onClick={handleClick}
          className="h-3.5 w-3.5"
          aria-label="Select row"
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
  };
}
