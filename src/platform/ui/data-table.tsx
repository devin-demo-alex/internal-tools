"use client";

import {
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { useId, useMemo, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DataTableValue = string | number | boolean | null | undefined;

export type DataTableColumn<TRow extends RowData> = {
  id: string;
  header: string;
  /** Value used for sorting and filtering. Defaults to `row[id]`. */
  value?: (row: TRow) => DataTableValue;
  /** Custom cell content. Defaults to the value as text. */
  cell?: (row: TRow) => ReactNode;
  sortable?: boolean;
};

export type DataTableProps<TRow extends RowData> = {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  getRowId?: (row: TRow) => string;
  emptyMessage?: string;
  /** Shows a text filter above the table that searches every column value. */
  filter?: { label: string; placeholder?: string };
};

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
});

function compareValues(a: DataTableValue, b: DataTableValue) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function readValue<TRow extends RowData>(column: DataTableColumn<TRow>, row: TRow) {
  if (column.value) return column.value(row);
  return (row as Record<string, DataTableValue>)[column.id];
}

export function DataTable<TRow extends RowData>({
  columns,
  rows,
  getRowId,
  emptyMessage = "Nothing to show.",
  filter,
}: DataTableProps<TRow>) {
  const filterId = useId();

  const columnDefs = useMemo(
    () =>
      columns.map(
        (column): ColumnDef<typeof features, TRow> => ({
          id: column.id,
          header: column.header,
          accessorFn: (row) => readValue(column, row),
          cell: (context) =>
            column.cell
              ? column.cell(context.row.original)
              : String(context.getValue<DataTableValue>() ?? ""),
          enableSorting: column.sortable ?? true,
          sortDescFirst: false,
          sortFn: (a, b, columnId) =>
            compareValues(
              a.getValue<DataTableValue>(columnId),
              b.getValue<DataTableValue>(columnId),
            ),
        }),
      ),
    [columns],
  );

  const table = useTable({
    features,
    columns: columnDefs,
    data: rows,
    getRowId,
    getColumnCanGlobalFilter: () => true,
    globalFilterFn: (row, columnId, filterValue) =>
      String(row.getValue<DataTableValue>(columnId) ?? "")
        .toLowerCase()
        .includes(String(filterValue).trim().toLowerCase()),
  });

  const visibleRows = table.getRowModel().rows;
  const filterValue = String(table.state.globalFilter ?? "");

  return (
    <div className="flex flex-col gap-3">
      {filter ? (
        <div className="flex max-w-sm flex-col gap-1.5">
          <Label htmlFor={filterId}>{filter.label}</Label>
          <Input
            id={filterId}
            type="search"
            value={filterValue}
            placeholder={filter.placeholder}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
          />
        </div>
      ) : null}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const SortIcon =
                    sorted === "asc"
                      ? ArrowUpIcon
                      : sorted === "desc"
                        ? ArrowDownIcon
                        : ChevronsUpDownIcon;
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <table.FlexRender header={header} />
                          <SortIcon
                            aria-hidden
                            className={
                              sorted
                                ? "size-3.5"
                                : "size-3.5 text-muted-foreground"
                            }
                          />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={Math.max(columns.length, 1)}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
