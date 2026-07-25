"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Form, Input, Modal, Select, Space, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { SquarePen, Plus, Trash2 } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { AppSwitch } from "@/components/ui/AppSwitch";
import { api } from "@/utils/API";

interface FAQ {
  id: number;
  question: string;
  answer: string;
  is_active: boolean;
}

const fetchFAQs = () => api.get("/faqs").then((r) => r.data.data as FAQ[]);

export default function FAQPage() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();

  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FAQ | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return faqs.filter((f) => {
      const matchSearch = !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
      const matchActive = activeFilter === null || (activeFilter === "active" ? f.is_active : !f.is_active);
      return matchSearch && matchActive;
    });
  }, [faqs, search, activeFilter]);

  const load = async () => {
    try {
      setFaqs(await fetchFAQs());
    } catch {
      void message.error("Failed to load FAQs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
    setModalOpen(true);
  };

  const openEdit = (faq: FAQ) => {
    setEditing(faq);
    form.setFieldsValue({ question: faq.question, answer: faq.answer, is_active: faq.is_active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) {
        await api.put(`/faqs/${editing.id}`, values);
        void message.success("FAQ updated.");
      } else {
        await api.post("/faqs", values);
        void message.success("FAQ created.");
      }
      setModalOpen(false);
      form.resetFields();
      setLoading(true);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) void message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (faq: FAQ) => {
    modal.confirm({
      title: `Delete this FAQ?`,
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await api.delete(`/faqs/${faq.id}`);
          void message.success("FAQ deleted.");
          setLoading(true);
          await load();
        } catch {
          void message.error("Failed to delete FAQ.");
        }
      },
    });
  };

  const handleToggle = async (faq: FAQ, is_active: boolean) => {
    try {
      await api.put(`/faqs/${faq.id}`, { is_active });
      setFaqs((prev) => prev.map((f) => (f.id === faq.id ? { ...f, is_active } : f)));
    } catch {
      void message.error("Failed to update status.");
    }
  };

  const columns: ColumnsType<FAQ> = [
    {
      title: "Question",
      dataIndex: "question",
      render: (q: string) => <span className="font-medium text-slate-800">{q}</span>,
    },
    {
      title: "Answer",
      dataIndex: "answer",
      render: (a: string) => <span className="text-slate-500 line-clamp-2">{a}</span>,
    },
    {
      title: "Active",
      dataIndex: "is_active",
      width: 90,
      render: (v: boolean, record: FAQ) => (
        <AppSwitch checked={v} onChange={(checked) => void handleToggle(record, checked)} />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: unknown, record: FAQ) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<SquarePen size={14} className="!text-blue-500" />}
              className="!rounded-lg hover:!bg-blue-50"
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Delete">
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
        title="AI Knowledge Base"
        description="Set predefined questions and answers. When a patient message matches a question, the AI replies with your exact answer instead of generating one."
        actions={
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
            Add FAQ
          </Button>
        }
      />

      <DataTable
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        actions={
          <div className="flex items-center gap-2">
            <Select
              placeholder="All"
              allowClear
              value={activeFilter}
              onChange={(val) => setActiveFilter(val ?? null)}
              style={{ width: 140 }}
              options={[
                { value: "active",   label: "Active"   },
                { value: "inactive", label: "Inactive" },
              ]}
            />
            <Input.Search
              placeholder="Search FAQs..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
          </div>
        }
      />

      <Modal
        title={editing ? "Edit FAQ" : "Add FAQ"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSave()}
        okText={editing ? "Update" : "Add"}
        confirmLoading={saving}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="question"
            label="Question"
            rules={[{ required: true, message: "Question is required." }]}
          >
            <Input placeholder="e.g. What is the price of hair transplant?" />
          </Form.Item>
          <Form.Item
            name="answer"
            label="Answer"
            rules={[{ required: true, message: "Answer is required." }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="e.g. Our hair transplant packages start from ₺2,500.00. Please contact us for a personalized quote."
            />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <AppSwitch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
