"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Download, ExternalLink, FileText } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { wonLeadsService, type GeneratedInvoice, type WonLead } from "@/services/wonLeads.service";
import { downloadWonLeadsInvoice } from "@/utils/invoiceDownload";
import { useThemeColors } from "@/providers/ThemeProvider";

export default function SuperAdminWonLeadsPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const { platformFullName } = useThemeColors();

  const [wonLeads, setWonLeads] = useState<WonLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [clinicFilter, setClinicFilter] = useState<number | "all">("all");

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [targetLead, setTargetLead] = useState<WonLead | null>(null);
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

  const clinicOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const lead of wonLeads) {
      if (lead.tenant_id != null) {
        seen.set(lead.tenant_id, lead.clinic_name ?? String(lead.tenant_id));
      }
    }
    return [
      { value: "all" as const, label: "All Clinics" },
      ...Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name })),
    ];
  }, [wonLeads]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return wonLeads.filter((lead) => {
      if (clinicFilter !== "all" && lead.tenant_id !== clinicFilter) return false;
      if (!q) return true;
      return [lead.name, lead.phone, lead.email, lead.clinic_name, String(lead.id)].some(
        (v) => v && v.toLowerCase().includes(q)
      );
    });
  }, [wonLeads, clinicFilter, searchQuery]);

  const openInvoiceModal = (lead: WonLead) => {
    setTargetLead(lead);
    form.resetFields();
    form.setFieldsValue({ currency: "USD", amount: 30 });
    setInvoiceModalOpen(true);
  };

  const handleGenerateInvoice = async () => {
    if (!targetLead) return;
    try {
      const values = await form.validateFields();
      setInvoiceSubmitting(true);
      const res = await wonLeadsService.generateInvoice(targetLead.id, {
        amount: values.amount as number,
        currency: values.currency as string,
        notes: values.notes as string | undefined,
      });
      const inv = res.data?.data;
      if (inv) {
        setGeneratedInvoices((prev) => ({
          ...prev,
          [targetLead.id]: [...(prev[targetLead.id] ?? []), inv],
        }));
      }
      void message.success(`Invoice ${inv?.invoice_number ?? ""} generated successfully.`);
      setInvoiceModalOpen(false);
      setTargetLead(null);
    } catch {
      void message.error("Failed to generate invoice.");
    } finally {
      setInvoiceSubmitting(false);
    }
  };

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
      title: "Clinic",
      dataIndex: "clinic_name",
      render: (v: string | undefined) =>
        v ? <Tag color="purple">{v}</Tag> : <span className="text-slate-400">—</span>,
    },
    {
      title: "Conversation",
      dataIndex: "latest_conversation_id",
      render: (convId: number | null, record: WonLead) => {
        if (!convId) return <span className="text-slate-400">No conversation</span>;
        return (
          <Tooltip title={`Open conversation #${convId}`}>
            <a
              href={`/super-admin/conversations/${convId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              <ExternalLink size={14} />
              #{convId}
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
        if (invs.length === 0) return <span className="text-slate-400">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {invs.map((inv) => (
              <Tooltip key={inv.id} title={`Download ${inv.invoice_number} · ${inv.currency} ${Number(inv.amount).toLocaleString()}`}>
                <Button
                  size="small"
                  icon={<Download size={12} />}
                  onClick={() => downloadWonLeadsInvoice(inv, platformFullName)}
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
    {
      title: "Action",
      key: "action",
      render: (_: unknown, record: WonLead) => (
        <Button
          size="small"
          type="primary"
          icon={<FileText size={14} />}
          onClick={() => openInvoiceModal(record)}
        >
          Generate Invoice
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageSection
        eyebrow="Super Admin"
        title="Won Leads & Bookings"
        description="All won leads across clinics. Generate invoices for tenants."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Space size={8} wrap>
          <Select
            value={clinicFilter}
            onChange={(v) => setClinicFilter(v)}
            style={{ width: 220 }}
            options={clinicOptions}
            showSearch
            optionFilterProp="label"
            placeholder="All Clinics"
          />
        </Space>
        <Input.Search
          placeholder="Search by name, phone, ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          className="w-72"
        />
      </div>

      <DataTable rowKey="id" loading={loading} dataSource={filtered} columns={columns} />

      <Modal
        title={`Generate Invoice — ${targetLead?.name ?? ""}`}
        open={invoiceModalOpen}
        onCancel={() => {
          setInvoiceModalOpen(false);
          setTargetLead(null);
          form.resetFields();
        }}
        onOk={() => void handleGenerateInvoice()}
        okText="Generate"
        confirmLoading={invoiceSubmitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="amount"
            label="Amount"
            rules={[{ required: true, message: "Amount is required." }]}
          >
            <InputNumber min={0} className="w-full" precision={2} placeholder="0.00" />
          </Form.Item>
          <Form.Item name="currency" label="Currency" initialValue="INR">
            <Select
              options={[
                { value: "USD", label: "USD — US Dollar" },
                { value: "TRY", label: "TRY — Turkish Lira" },
                { value: "INR", label: "INR — Indian Rupee" },
                { value: "EUR", label: "EUR — Euro" },
                { value: "GBP", label: "GBP — British Pound" },
              ]}
            />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Optional invoice notes..." maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
