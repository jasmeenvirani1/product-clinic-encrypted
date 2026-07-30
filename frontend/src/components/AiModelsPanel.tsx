"use client";

import { useEffect, useImperativeHandle, useMemo, useState, forwardRef } from "react";
import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { SquarePen, Trash2 } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { AppSwitch } from "@/components/ui/AppSwitch";
import { aiModelService, type AiModel } from "@/services/aiModel.service";

export interface AiModelsPanelHandle {
  /** Open the "Add Model" create dialog — used by a host page's own heading-row button. */
  openCreate: () => void;
}

export const AiModelsPanel = forwardRef<AiModelsPanelHandle>(function AiModelsPanel(_props, ref) {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();

  const [models, setModels] = useState<AiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AiModel | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return models.filter((m) => {
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q);
      const matchActive = activeFilter === null || (activeFilter === "active" ? m.is_active : !m.is_active);
      return matchSearch && matchActive;
    });
  }, [models, search, activeFilter]);

  const load = async () => {
    try {
      setModels(await aiModelService.list());
    } catch {
      void message.error("Failed to load AI models.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    const nextOrder = models.length ? Math.max(...models.map((m) => m.sort_order)) + 1 : 0;
    form.setFieldsValue({ is_active: true, provider: "OpenAI", sort_order: nextOrder });
    setModalOpen(true);
  };

  useImperativeHandle(ref, () => ({ openCreate }));

  const openEdit = (m: AiModel) => {
    setEditing(m);
    form.setFieldsValue({
      name: m.name,
      model: m.model,
      provider: m.provider,
      base_url: m.base_url || "",
      is_active: m.is_active,
      sort_order: m.sort_order,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = { ...values, base_url: values.base_url?.trim() || null };
      if (editing) {
        await aiModelService.update(editing.id, payload);
        void message.success("AI model updated.");
      } else {
        await aiModelService.create(payload);
        void message.success("AI model created.");
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

  const handleDelete = (m: AiModel) => {
    modal.confirm({
      title: `Delete "${m.name}"?`,
      content: "Tenants who selected this model keep their stored model id, but it won't appear in the dropdown anymore.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await aiModelService.remove(m.id);
          void message.success("AI model deleted.");
          setLoading(true);
          await load();
        } catch {
          void message.error("Failed to delete AI model.");
        }
      },
    });
  };

  const handleToggle = async (m: AiModel, is_active: boolean) => {
    try {
      await aiModelService.update(m.id, { is_active });
      setModels((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_active } : x)));
    } catch {
      void message.error("Failed to update status.");
    }
  };

  const columns: ColumnsType<AiModel> = [
    {
      title: "#",
      dataIndex: "sort_order",
      width: 60,
      render: (v: number) => <span className="text-slate-400">{v}</span>,
    },
    {
      title: "Name",
      dataIndex: "name",
      render: (name: string) => <span className="font-medium text-slate-800">{name}</span>,
    },
    {
      title: "Model ID",
      dataIndex: "model",
      render: (m: string) => <span className="text-[12px] font-mono text-slate-600">{m}</span>,
    },
    {
      title: "Provider",
      dataIndex: "provider",
      render: (p: string) => <span className="text-slate-500">{p}</span>,
    },
    {
      title: "Base URL",
      dataIndex: "base_url",
      render: (u: string | null) => (
        <span className="text-[12px] font-mono text-slate-400">{u || "default (OpenAI)"}</span>
      ),
    },
    {
      title: "Active",
      dataIndex: "is_active",
      width: 90,
      render: (v: boolean, record: AiModel) => (
        <AppSwitch checked={v} onChange={(checked) => void handleToggle(record, checked)} />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: unknown, record: AiModel) => (
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
    <div>
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
              placeholder="Search models..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
          </div>
        }
      />

      <Modal
        title={editing ? "Edit AI Model" : "Add AI Model"}
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
            name="name"
            label="Display Name"
            rules={[{ required: true, message: "Name is required." }]}
          >
            <Input placeholder="e.g. GPT-4o Mini — fast & affordable" />
          </Form.Item>
          <Form.Item
            name="model"
            label="Model ID"
            tooltip="The exact model id sent to the API (e.g. gpt-4o-mini)."
            rules={[{ required: true, message: "Model id is required." }]}
          >
            <Input placeholder="e.g. gpt-4o-mini" />
          </Form.Item>
          <Form.Item
            name="provider"
            label="Provider"
            rules={[{ required: true, message: "Provider is required." }]}
          >
            <Input placeholder="e.g. OpenAI, OpenAI Compatible" />
          </Form.Item>
          <Form.Item
            name="base_url"
            label="Base URL"
            tooltip="Leave empty for OpenAI (api.openai.com). For OpenAI-compatible providers set the endpoint, e.g. https://ollama.com/v1"
          >
            <Input placeholder="https://ollama.com/v1 (leave empty for OpenAI)" allowClear />
          </Form.Item>
          <Form.Item name="sort_order" label="Order" tooltip="Lower numbers appear first in the dropdown.">
            <InputNumber min={0} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <AppSwitch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
});
