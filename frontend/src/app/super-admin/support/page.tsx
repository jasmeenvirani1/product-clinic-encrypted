"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Input, Select, Space, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Trash2 } from "lucide-react";
import { AttachmentCell } from "@/components/AttachmentView";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { supportService } from "@/services/support.service";
import { formatDateTime } from "@/lib/utils";
import type { SupportTicket } from "@/utils/types";

const STATUS_OPTIONS: { value: SupportTicket["status"]; label: string; color: string }[] = [
  { value: "open",        label: "Open",        color: "blue"   },
  { value: "in_progress", label: "In Progress", color: "orange" },
  { value: "resolved",    label: "Resolved",    color: "green"  },
  { value: "closed",      label: "Closed",      color: "default"},
];

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/api$/, "");

export default function SupportPage() {
  const { message, modal } = App.useApp();
  const [tickets, setTickets]           = useState<SupportTicket[]>([]);
  const [loading, setLoading]           = useState(true);
  const [updating, setUpdating]         = useState<number | null>(null);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tickets.filter((t) => {
      const matchSearch =
        !q ||
        t.subject.toLowerCase().includes(q) ||
        (t.CreatedByUser?.full_name ?? "").toLowerCase().includes(q) ||
        (t.CreatedByUser?.email ?? "").toLowerCase().includes(q);
      const matchStatus = !statusFilter || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tickets, search, statusFilter]);

  const load = async () => {
    try {
      setLoading(true);
      const data = await supportService.getAll();
      setTickets(data);
    } catch {
      void message.error("Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = async (ticket: SupportTicket, status: SupportTicket["status"]) => {
    try {
      setUpdating(ticket.id);
      const updated = await supportService.updateStatus(ticket.id, status);
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, status: updated.status } : t)));
      void message.success("Status updated.");
    } catch {
      void message.error("Failed to update status.");
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = (ticket: SupportTicket) => {
    modal.confirm({
      title: `Delete ticket "${ticket.subject}"?`,
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await supportService.delete(ticket.id);
          setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
          void message.success("Ticket deleted.");
        } catch {
          void message.error("Failed to delete ticket.");
        }
      },
    });
  };

  const columns: ColumnsType<SupportTicket> = [
    {
      title: "Subject",
      dataIndex: "subject",
      render: (value: string, record: SupportTicket) => (
        <div>
          <div className="font-medium">{value}</div>
          {record.description && (
            <div className="text-xs text-slate-400 truncate max-w-xs">{record.description}</div>
          )}
        </div>
      ),
    },
    {
      title: "Raised By",
      key: "raised_by",
      render: (_: unknown, record: SupportTicket) =>
        record.CreatedByUser ? (
          <div>
            <div className="text-sm font-medium">{record.CreatedByUser.full_name}</div>
            <div className="text-xs text-slate-400">{record.CreatedByUser.email}</div>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      title: "Attachment",
      dataIndex: "attachment",
      render: (file: string | null) => (
        <AttachmentCell filePath={file} baseUrl={`${API_BASE}/uploads/support`} />
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: SupportTicket["status"], record: SupportTicket) => (
        <Select
          value={status}
          size="small"
          variant="borderless"
          style={{ minWidth: 130 }}
          loading={updating === record.id}
          disabled={updating === record.id}
          onChange={(val) => void handleStatusChange(record, val)}
          options={STATUS_OPTIONS.map(({ value, label, color }) => ({
            value,
            label: <Tag color={color}>{label}</Tag>,
          }))}
        />
      ),
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      render: (v: string, r: SupportTicket) => {
        const d = v || (r as unknown as { created_at?: string }).created_at;
        return d ? formatDateTime(d) : "—";
      },
    },
    {
      title: "Updated",
      dataIndex: "updatedAt",
      render: (v: string, r: SupportTicket) => {
        const d = v || (r as unknown as { updated_at?: string }).updated_at;
        return d ? formatDateTime(d) : "—";
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 60,
      render: (_: unknown, record: SupportTicket) => (
        <Space size={4}>
          <Tooltip title="Delete ticket">
            <Button
              type="text"
              size="small"
              icon={<Trash2 size={14} className="!text-red-500" />}
              className="!rounded-lg hover:!bg-red-50"
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="">
      <PageSection
        eyebrow="Super Admin"
        title="Support Tickets"
        description="Review clinic support requests and update their resolution status."
      />
      <DataTable
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        actions={
          <div className="flex items-center gap-2">
            <Select
              placeholder="All Statuses"
              allowClear
              value={statusFilter}
              onChange={(val) => setStatusFilter(val ?? null)}
              style={{ width: 160 }}
              options={STATUS_OPTIONS.map(({ value, label }) => ({ value, label }))}
            />
            <Input.Search
              placeholder="Search by subject or user..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 260 }}
            />
          </div>
        }
      />
    </div>
  );
}
