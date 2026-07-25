"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Form, Input, Modal, Select, Space, Tag, Tooltip, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd";
import { Plus, Trash2, UploadCloud } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { AttachmentCell } from "@/components/AttachmentView";
import { supportService } from "@/services/support.service";
import type { SupportTicket } from "@/utils/types";
import { MAX_UPLOAD_LABEL, beforeUploadWithSizeLimit } from "@/utils/fileSize";
import { formatDateTime } from "@/lib/utils";

const STATUS_COLOR: Record<SupportTicket["status"], string> = {
  open:        "blue",
  in_progress: "orange",
  resolved:    "green",
  closed:      "default",
};

const STATUS_LABEL: Record<SupportTicket["status"], string> = {
  open:        "Open",
  in_progress: "In Progress",
  resolved:    "Resolved",
  closed:      "Closed",
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/api$/, "");

export default function AppSupportPage() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [tickets, setTickets]         = useState<SupportTicket[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [modalOpen, setModalOpen]     = useState(false);
  const [fileList, setFileList]       = useState<UploadFile[]>([]);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tickets.filter((t) => {
      const matchSearch = !q || t.subject.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q);
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
      void message.error("Failed to load support tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openModal = () => {
    form.resetFields();
    setFileList([]);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const attachment = fileList[0]?.originFileObj ?? null;
      await supportService.create({
        subject:     values.subject as string,
        description: values.description as string | undefined,
        attachment,
      });
      void message.success("Support ticket raised successfully.");
      setModalOpen(false);
      form.resetFields();
      setFileList([]);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) void message.error(msg);
    } finally {
      setSaving(false);
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
      title: "Attachment",
      dataIndex: "attachment",
      render: (file: string | null) => (
        <AttachmentCell filePath={file} baseUrl={`${API_BASE}/uploads/support`} />
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: SupportTicket["status"]) => (
        <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>
      ),
    },
    {
      title: "Raised By",
      key: "raised_by",
      render: (_: unknown, record: SupportTicket) =>
        record.CreatedByUser ? (
          <span className="text-sm">{record.CreatedByUser.full_name}</span>
        ) : (
          <span className="text-slate-400">—</span>
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
        eyebrow="Clinic CRM"
        title="Support"
        description="Raise a support ticket and track its resolution status."
      />

      <DataTable
        cardTitle="My Tickets"
        subtitle="Tickets you have raised. Super admin will review and update the status."
        actions={
          <Button type="primary" icon={<Plus size={14} />} onClick={openModal}>
            Raise Ticket
          </Button>
        }
        filters={
          <div className="flex items-center gap-2">
            <Select
              placeholder="All Statuses"
              allowClear
              value={statusFilter}
              onChange={(val) => setStatusFilter(val ?? null)}
              style={{ width: 160 }}
              options={[
                { value: "open",        label: "Open"        },
                { value: "in_progress", label: "In Progress" },
                { value: "resolved",    label: "Resolved"    },
                { value: "closed",      label: "Closed"      },
              ]}
            />
            <Input.Search
              placeholder="Search tickets..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
          </div>
        }
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
      />

      <Modal
        title="Raise Support Ticket"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        okText="Submit Ticket"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="subject"
            label="Subject"
            rules={[{ required: true, message: "Subject is required." }]}
          >
            <Input placeholder="Brief summary of your issue" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea
              rows={4}
              placeholder="Describe the issue in detail..."
            />
          </Form.Item>

          <Form.Item label="Attachment (optional)" help={`Max size: ${MAX_UPLOAD_LABEL}.`}>
            <Upload
              fileList={fileList}
              beforeUpload={beforeUploadWithSizeLimit}
              onChange={({ fileList: list }) => setFileList(list.slice(-1))}
              accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
              maxCount={1}
              listType="picture"
            >
              {fileList.length === 0 && (
                <Button icon={<UploadCloud size={14} />}>Select file</Button>
              )}
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
