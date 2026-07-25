"use client";

import { Skeleton } from "antd";
import { useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { KpiCard } from "@/components/KpiCard";
import { PageSection } from "@/components/PageSection";
import { renderStatus } from "@/components/ui/StatusTag";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { fetchSuperAdminDashboard } from "@/store/slices/dashboardSlice";

export default function SuperAdminDashboardPage() {
  const dispatch = useAppDispatch();
  const { superAdmin, status } = useAppSelector((state) => state.dashboard);

  useEffect(() => {
    void dispatch(fetchSuperAdminDashboard());
  }, [dispatch]);

  if (!superAdmin || status === "loading") {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  const metrics = superAdmin.metrics
    .filter((metric) => metric.label !== "Churn Risk")
    .slice(0, 4)
    .map((metric) =>
      metric.label === "Total Booked"
        ? { ...metric, change: "Won Leads" }
        : metric,
    );

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageSection
        eyebrow="Super Admin"
        title="Platform Dashboard"
        description="High-level KPIs across tenants, revenue, payment health, and usage signals."
      />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, i) => (
          <KpiCard key={metric.label} metric={metric} index={i} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <DataTable
          cardTitle="Recent tenants"
          rowKey="id"
          dataSource={superAdmin.tenants}
          columns={[
            { title: "Name", dataIndex: "name" },
            { title: "Email", dataIndex: "email" },
            { title: "Plan", dataIndex: "plan" },
            { title: "Status", dataIndex: "status", render: renderStatus },
          ]}
        />
        <DataTable
          cardTitle="Recent payments"
          rowKey="id"
          dataSource={superAdmin.recentPayments}
          columns={[
            { title: "Clinic", dataIndex: "tenantName" },
            { title: "Amount", dataIndex: "amount", render: (value: number) => formatCurrency(value) },
            { title: "Method", dataIndex: "method" },
            { title: "Status", dataIndex: "status", render: renderStatus },
            {
              title: "Date",
              dataIndex: "date",
              render: (v: string) => v ? formatDate(v) : "—",
            },
          ]}
        />
      </div>
      <DataTable
        cardTitle="Recent tickets"
        rowKey="id"
        dataSource={superAdmin.recentTickets}
        columns={[
          { title: "Subject", dataIndex: "subject" },
          { title: "Status", dataIndex: "status", render: renderStatus },
          { title: "Raised By", dataIndex: "createdBy" },
          {
            title: "Created",
            dataIndex: "createdDate",
            render: (v: string, r: { date?: string }) => {
              const d = v || r.date;
              return d ? formatDateTime(d) : "—";
            },
          },
          {
            title: "Updated",
            dataIndex: "updatedDate",
            render: (v: string) => v ? formatDateTime(v) : "—",
          },
        ]}
      />
    </div>
  );
}
