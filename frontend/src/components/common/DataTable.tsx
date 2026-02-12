import React, { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  /** The field key to access data from the row. Use `accessor` or `key` (alias). */
  accessor?: keyof T | string;
  /** Alias for accessor - for backward compatibility */
  key?: keyof T | string;
  /**
   * Custom cell render function.
   * Supports two signatures:
   *   - (row: T) => ReactNode -- receives the full row
   *   - (value: unknown, row: T, index: number) => ReactNode -- receives extracted value, row, and index
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render?: (...args: any[]) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  /** Alias for loading (backward compatibility) */
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  keyExtractor?: (row: T, index: number) => string;
  /** Default field name for row keys (backward compatibility) */
  rowKeyField?: string;
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function SkeletonRow({ colCount }: { colCount: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 rounded bg-gray-200"
            style={{ width: `${60 + Math.random() * 30}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

function resolveAccessor<T>(col: Column<T>): string | undefined {
  const field = col.accessor ?? col.key;
  return field != null ? String(field) : undefined;
}

export default function DataTable<T>({
  columns,
  data,
  loading,
  isLoading,
  onRowClick,
  emptyMessage = 'No records found.',
  keyExtractor,
  rowKeyField,
}: DataTableProps<T>) {
  const isLoadingResolved = loading ?? isLoading ?? false;
  const headerRow = (
    <thead className="bg-gray-50">
      <tr>
        {columns.map((col, i) => (
          <th
            key={i}
            className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 ${col.headerClassName ?? ''} ${col.className ?? ''}`}
          >
            {col.header}
          </th>
        ))}
      </tr>
    </thead>
  );

  if (isLoadingResolved) {
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          {headerRow}
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} colCount={columns.length} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          {headerRow}
        </table>
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <svg
            className="mb-3 h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-sm font-medium">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        {headerRow}
        <tbody className="divide-y divide-gray-100">
          {data.map((row, rowIndex) => {
            const key = keyExtractor
              ? keyExtractor(row, rowIndex)
              : String(
                  (row as Record<string, unknown>)[rowKeyField ?? 'id'] ?? rowIndex
                );
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors ${
                  onRowClick
                    ? 'cursor-pointer hover:bg-primary-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                {columns.map((col, colIndex) => {
                  const accessor = resolveAccessor(col);
                  const value = accessor ? getNestedValue(row, accessor) : undefined;

                  let content: ReactNode;
                  if (col.render) {
                    // Detect calling convention by function arity:
                    // 0–1 args: render(row) style
                    // 2+ args: render(value, row, index) style
                    content = col.render.length <= 1
                      ? col.render(row)
                      : col.render(value, row, rowIndex);
                  } else {
                    content = (value as ReactNode) ?? '\u2014';
                  }

                  return (
                    <td
                      key={colIndex}
                      className={`whitespace-nowrap px-4 py-3 text-sm text-gray-700 ${col.className ?? ''}`}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
