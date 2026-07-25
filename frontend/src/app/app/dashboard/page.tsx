"use client";

import { Skeleton, Tag, Tooltip } from "antd";
import { Info } from "lucide-react";
import { useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { KpiCard } from "@/components/KpiCard";
import { PageSection } from "@/components/PageSection";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { formatDate, formatDateTime } from "@/lib/utils";
import { fetchTenantDashboard } from "@/store/slices/dashboardSlice";
import type { TenantDashboardMetric } from "@/utils/types";

const FUNNEL_COLORS = ["bg-sky-600", "bg-sky-500", "bg-sky-400", "bg-sky-300", "bg-indigo-400"];

const STAGE_COLOR: Record<string, string> = {
  new: "blue",
  qualified: "cyan",
  discussion: "orange",
  won: "green",
  lost: "red",
};

export default function TenantDashboardPage() {
  const dispatch  = useAppDispatch();
  const dashboard = useAppSelector((state) => state.dashboard.tenant);
  const status    = useAppSelector((state) => state.dashboard.status);

  useEffect(() => {
    void dispatch(fetchTenantDashboard());
  }, [dispatch]);

  if (!dashboard || status === "loading") {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  const maxFunnel = Math.max(...dashboard.funnel.map((f) => f.value), 1);

  return (
    <div className="space-y-6 lg:space-y-7">
      <PageSection
        eyebrow="Clinic CRM"
        title={dashboard.tenantName || "Clinic Dashboard"}
        description="Monitor lead flow, conversions, support tickets, and team activity."
      />

      {/* KPI cards */}
      <div className={`grid gap-5 sm:grid-cols-2 ${dashboard.metrics.length <= 2 ? "xl:grid-cols-2" : "xl:grid-cols-4"}`}>
        {dashboard.metrics.map((metric: TenantDashboardMetric, i: number) => (
          <div key={metric.label} className="relative">
            {metric._static && (
              <Tooltip title="This metric uses placeholder data. Backend API is not yet available.">
                <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600 cursor-help">
                  <Info size={10} />
                  Static
                </div>
              </Tooltip>
            )}
            <KpiCard metric={metric} index={i} />
          </div>
        ))}
      </div>

      {/* Funnel + Recent Leads */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Lead funnel */}
        <div className="crm-card p-5">
          <h3 className="text-[15px] font-semibold text-slate-900">Lead Funnel</h3>
          <p className="mt-0.5 text-xs text-slate-400">Current pipeline distribution</p>
          <div className="mt-5 space-y-4">
            {dashboard.funnel.map((item, i) => {
              const pct = Math.round((item.value / maxFunnel) * 100);
              return (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full transition-all ${FUNNEL_COLORS[i % FUNNEL_COLORS.length]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Leads */}
        <DataTable
          cardTitle="Recent Leads"
          subtitle="Latest incoming leads"
          rowKey="id"
          dataSource={dashboard.recentLeads}
          columns={[
            { title: "Name", dataIndex: "name" },
            { title: "Source", dataIndex: "source" },
            {
              title: "Stage",
              dataIndex: "stage",
              render: (stage: string) => (
                <Tag color={STAGE_COLOR[stage] ?? "default"} className="capitalize">{stage}</Tag>
              ),
            },
            {
              title: "Date",
              dataIndex: "date",
              render: (v: string) => v ? formatDate(v) : "—",
            },
          ]}
        />
      </div>

      {/* Support Tickets */}
      <DataTable
        cardTitle="Recent Support Tickets"
        subtitle="Latest clinic support requests"
        rowKey="id"
        dataSource={dashboard.recentTickets}
        columns={[
          { title: "Subject", dataIndex: "subject" },
          {
            title: "Status",
            dataIndex: "status",
            render: (s: string) => (
              <Tag
                color={
                  s === "open" ? "blue" : s === "in_progress" ? "orange" : s === "resolved" ? "green" : "default"
                }
                className="capitalize"
              >
                {s.replace("_", " ")}
              </Tag>
            ),
          },
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
