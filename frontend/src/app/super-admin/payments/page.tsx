"use client";

import { useEffect, useMemo, useState } from "react";
import { Input, Select, Tag } from "antd";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { superadminService } from "@/services/superadmin.service";
import { formatCurrency } from "@/lib/utils";
import type { PaymentRecord } from "@/utils/types";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  paid:     { color: "#22C55E", label: "Paid"     },
  success:  { color: "#22C55E", label: "Success"  },
  pending:  { color: "#64748B", label: "Pending"  },
  failed:   { color: "#EF4444", label: "Failed"   },
  refunded: { color: "#2563EB", label: "Refunded" },
};

export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    void superadminService.getPayments().then(setRows);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const matchSearch =
        !q ||
        (r.userName ?? "").toLowerCase().includes(q) ||
        (r.userEmail ?? "").toLowerCase().includes(q) ||
        (r.planName ?? "").toLowerCase().includes(q) ||
        (r.transactionId ?? "").toLowerCase().includes(q);
      const matchStatus = !statusFilter || r.status?.toLowerCase() === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rows, search, statusFilter]);

  return (
    <div>
      <PageSection
        title="Payment records"
        description="Review payment activity of all users/admins and transaction health."
      />
      <DataTable
        rowKey="id"
        dataSource={filtered}
        actions={
          <div className="flex items-center gap-2">
            <Select
              placeholder="All Statuses"
              allowClear
              value={statusFilter}
              onChange={(val) => setStatusFilter(val ?? null)}
              style={{ width: 150 }}
              options={[
                { value: "paid",     label: "Paid"     },
                { value: "success",  label: "Success"  },
                { value: "pending",  label: "Pending"  },
                { value: "failed",   label: "Failed"   },
                { value: "refunded", label: "Refunded" },
              ]}
            />
            <Input.Search
              placeholder="Search by user, email or plan..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 260 }}
            />
          </div>
        }
        columns={[
          { title: "User / Admin", dataIndex: "userName" },
          { title: "Email",        dataIndex: "userEmail" },
          { title: "Role",         dataIndex: "role" },
          { title: "Plan",         dataIndex: "planName" },
          {
            title: "Amount",
            dataIndex: "amount",
            render: (value: number) => formatCurrency(value),
          },
          { title: "Date",   dataIndex: "date" },
          { title: "Method", dataIndex: "method" },
          {
            title: "Status",
            dataIndex: "status",
            render: (status: string) => {
              const cfg = STATUS_CONFIG[status?.toLowerCase()] ?? { color: "#64748b", label: status };
              return (
                <Tag
                  style={{
                    color: cfg.color,
                    background: `${cfg.color}18`,
                    borderColor: `${cfg.color}40`,
                    fontWeight: 500,
                    borderRadius: 6,
                  }}
                >
                  {cfg.label}
                </Tag>
              );
            },
          },
        ]}
      />
    </div>
  );
}
