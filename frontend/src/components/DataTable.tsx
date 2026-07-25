"use client";

import { Table } from "antd";
import type { TableProps } from "antd";
import type { AnyObject } from "antd/es/_util/type";
import type { ColumnGroupType, ColumnType, ColumnsType } from "antd/es/table";
import type { ReactNode } from "react";

interface DataTableProps<T> extends TableProps<T> {
  cardTitle?: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;
}

const NAME_HINTS = ["name", "patient", "user", "admin"];
const PRICE_HINTS = ["price", "amount", "fee", "payment", "cost", "total"];

const includesAny = (text: string, hints: string[]) => hints.some((hint) => text.includes(hint));

const toSearchableText = (column: ColumnType<AnyObject> | ColumnGroupType<AnyObject>) => {
  const parts: string[] = [];

  if ("key" in column && typeof column.key === "string") parts.push(column.key);
  if ("title" in column && typeof column.title === "string") parts.push(column.title);
  if ("dataIndex" in column) {
    const { dataIndex } = column;
    if (typeof dataIndex === "string") parts.push(dataIndex);
    if (Array.isArray(dataIndex)) parts.push(dataIndex.join(" "));
  }

  return parts.join(" ").toLowerCase();
};

const mergeClassNames = (current?: string, next?: string) =>
  [current, next].filter(Boolean).join(" ");

const enhanceColumns = (columns?: ColumnsType<AnyObject>): ColumnsType<AnyObject> | undefined =>
  columns?.map((column) => {
    if ("children" in column && column.children) {
      return {
        ...column,
        children: enhanceColumns(column.children),
      };
    }

    const text = toSearchableText(column);
    const emphasisClass = includesAny(text, PRICE_HINTS)
      ? "crm-emphasis-price"
      : includesAny(text, NAME_HINTS)
        ? "crm-emphasis-name"
        : "";

    if (!emphasisClass) return column;

    const base = column as ColumnType<AnyObject>;
    const prevOnCell = base.onCell;

    return {
      ...base,
      onCell: (record, rowIndex) => {
        const cellProps = prevOnCell?.(record, rowIndex) ?? {};
        return {
          ...cellProps,
          className: mergeClassNames(cellProps.className, emphasisClass),
        };
      },
    };
  });

export const DataTable = <T extends object>({ cardTitle, subtitle, actions, filters, ...props }: DataTableProps<T>) => {
  const { className, columns, ...tableProps } = props;
  const enhancedColumns = enhanceColumns(columns as ColumnsType<AnyObject>) as typeof columns;

  return (
    <section className="overflow-hidden border border-brand-border bg-white shadow-sm">
      {(cardTitle || subtitle || actions) && (
        <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
          <div>
            {cardTitle && <h3 className="text-sm font-semibold text-slate-900">{cardTitle}</h3>}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      {filters && (
        <div className="flex items-center gap-2 flex-wrap border-b border-brand-border px-5 py-3">
          {filters}
        </div>
      )}
      <Table
        size="middle"
        pagination={{ pageSize: 5, hideOnSinglePage: true, size: "small" }}
        scroll={{ x: 720 }}
        className={["crm-table crm-table-flush", className].filter(Boolean).join(" ")}
        columns={enhancedColumns}
        {...tableProps}
      />
    </section>
  );
};
