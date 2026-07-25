import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  label: string;
  render?: (_item: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (_item: T) => string;
  emptyMessage?: string;
  className?: string;
}

export default function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No data found",
  className,
}: TableProps<T>) {
  const isNameColumn = (key: string, label: string) => {
    const value = `${key} ${label}`.toLowerCase();
    return ["name", "patient", "user", "admin"].some((hint) => value.includes(hint));
  };

  const isPriceColumn = (key: string, label: string) => {
    const value = `${key} ${label}`.toLowerCase();
    return ["price", "amount", "fee", "payment", "cost", "total"].some((hint) => value.includes(hint));
  };

  return (
    <div className={cn("overflow-x-auto rounded-none border border-slate-200 bg-white", className)}>
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-5 py-3 text-left text-[12px] font-semibold text-slate-900",
                  col.className
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center text-sm text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr key={keyExtractor(item)} className="transition-colors hover:bg-slate-50/60">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-5 py-4 align-middle text-sm text-slate-700",
                      isPriceColumn(col.key, col.label) && "font-bold text-slate-900",
                      isNameColumn(col.key, col.label) && "font-semibold text-slate-900",
                      col.className
                    )}
                  >
                    {col.render ? col.render(item) : (item as Record<string, unknown>)[col.key] as ReactNode}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
