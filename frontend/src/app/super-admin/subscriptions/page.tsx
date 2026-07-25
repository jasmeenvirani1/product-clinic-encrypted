"use client";

import { useEffect, useMemo, useState } from "react";
import { Input, Select, Tag } from "antd";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { superadminService } from "@/services/superadmin.service";
import type { SubscriptionRecord } from "@/utils/types";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active:   { color: "#22C55E", label: "Active"   },
  trial:    { color: "#2563EB", label: "Trial"    },
  past_due: { color: "#EF4444", label: "Past Due" },
  paid:     { color: "#22C55E", label: "Paid"     },
  pending:  { color: "#64748B", label: "Pending"  },
  failed:   { color: "#EF4444", label: "Failed"   },
  refunded: { color: "#2563EB", label: "Refunded" },
};

const renderStatusClean = (status: string) => {
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
};

export default function SubscriptionsPage() {
  const [rows, setRows] = useState<SubscriptionRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    void superadminService.getSubscriptions().then(setRows);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const matchSearch =
        !q ||
        (r.userName ?? "").toLowerCase().includes(q) ||
        (r.userEmail ?? "").toLowerCase().includes(q) ||
        (r.planName ?? "").toLowerCase().includes(q);
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rows, search, statusFilter]);

  return (
    <div>
      <PageSection
        title="Subscriptions"
        description="Track which users/admins purchased which plan and their latest subscription status."
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
                { value: "active",   label: "Active"   },
                { value: "trial",    label: "Trial"    },
                { value: "past_due", label: "Past Due" },
                { value: "paid",     label: "Paid"     },
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
          { title: "Period",       dataIndex: "period", render: (v: string | null) => v ?? "—" },
          { title: "Purchased On", dataIndex: "purchaseDate" },
          { title: "Expires On",   dataIndex: "planExpiresAt" },
          { title: "Latest Payment", dataIndex: "latestPaymentStatus", render: renderStatusClean },
          { title: "Status",       dataIndex: "status", render: renderStatusClean },
        ]}
      />
    </div>
  );
}
