"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Input, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Download, ExternalLink } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { wonLeadsService, type GeneratedInvoice, type WonLead } from "@/services/wonLeads.service";
import { downloadWonLeadsInvoice } from "@/utils/invoiceDownload";

export default function WonLeadsPage() {
  const { message } = App.useApp();

  const [wonLeads, setWonLeads] = useState<WonLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [generatedInvoices, setGeneratedInvoices] = useState<Record<number, GeneratedInvoice[]>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const [leadsRes, invoicesRes] = await Promise.all([
          wonLeadsService.getWonLeads(),
          wonLeadsService.getInvoices(),
        ]);
        setWonLeads(leadsRes.data?.data ?? []);

        const byLead: Record<number, GeneratedInvoice[]> = {};
        for (const inv of invoicesRes.data?.data ?? []) {
          if (!byLead[inv.lead_id]) byLead[inv.lead_id] = [];
          byLead[inv.lead_id].push(inv);
        }
        setGeneratedInvoices(byLead);
      } catch {
        void message.error("Failed to load won leads.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [message]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return wonLeads;
    return wonLeads.filter((lead) =>
      [lead.name, lead.phone, lead.email, String(lead.id)].some(
        (v) => v && v.toLowerCase().includes(q)
      )
    );
  }, [wonLeads, searchQuery]);

  const columns: ColumnsType<WonLead> = [
    {
      title: "Name",
      dataIndex: "name",
      render: (v: string) => <span className="font-medium">{v}</span>,
    },
    {
      title: "Phone",
      dataIndex: "phone",
      render: (v: string | null) => v ?? <span className="text-slate-400">—</span>,
    },
    {
      title: "Conversation",
      dataIndex: "latest_conversation_id",
      render: (convId: number | null) => {
        if (!convId) return <span className="text-slate-400">No conversation</span>;
        return (
          <Tooltip title={`Open conversation #${convId}`}>
            <a
              href={`/app/conversations/${convId}`}
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              <ExternalLink size={14} />
              {`View Chat #${convId}`}
            </a>
          </Tooltip>
        );
      },
    },
    {
      title: "Invoices",
      key: "invoices",
      render: (_: unknown, record: WonLead) => {
        const invs = generatedInvoices[record.id] ?? [];
        if (invs.length === 0) return <span className="text-slate-400">No invoices yet</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {invs.map((inv) => (
              <Tooltip
                key={inv.id}
                title={`Download ${inv.invoice_number} · ${inv.currency} ${Number(inv.amount).toLocaleString()}`}
              >
                <Button
                  size="small"
                  icon={<Download size={12} />}
                  onClick={() => downloadWonLeadsInvoice(inv)}
                  className="flex items-center gap-1 border-teal-200 text-teal-700 hover:border-teal-400 hover:text-teal-800"
                >
                  {inv.invoice_number}
                </Button>
              </Tooltip>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageSection
        eyebrow="Clinic"
        title="Won Leads & Bookings"
        description="All leads that were successfully booked or converted."
      />

      <div className="mb-4 flex justify-end">
        <Input.Search
          placeholder="Search by name, phone, ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          className="w-72"
        />
      </div>

      <DataTable rowKey="id" loading={loading} dataSource={filtered} columns={columns} />
    </div>
  );
}
