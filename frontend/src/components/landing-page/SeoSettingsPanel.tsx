"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { App, Button, Form, Input, Modal, Select, Space, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { SquarePen, Plus } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { AppSwitch } from "@/components/ui/AppSwitch";
import { seoSettingService, type SeoSetting } from "@/services/seo-setting.service";

interface SeoSettingsPanelProps {
  onActionsChange: (node: ReactNode) => void;
}

export function SeoSettingsPanel({ onActionsChange }: SeoSettingsPanelProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const [settings, setSettings] = useState<SeoSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SeoSetting | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return settings.filter((s) => {
      const matchSearch =
        !q ||
        s.page_key.toLowerCase().includes(q) ||
        (s.meta_title ?? "").toLowerCase().includes(q);
      const matchActive = activeFilter === null || (activeFilter === "active" ? s.is_active : !s.is_active);
      return matchSearch && matchActive;
    });
  }, [settings, search, activeFilter]);

  const load = async () => {
    try {
      setSettings(await seoSettingService.list());
    } catch {
      void message.error("Failed to load SEO settings.");
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

  useEffect(() => {
    onActionsChange(
      <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
        Add SEO Setting
      </Button>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const openEdit = (setting: SeoSetting) => {
    setEditing(setting);
    form.setFieldsValue({
      page_key: setting.page_key,
      meta_title: setting.meta_title,
      meta_description: setting.meta_description,
      og_title: setting.og_title,
      og_description: setting.og_description,
      og_image: setting.og_image,
      canonical_url: setting.canonical_url,
      keywords: setting.keywords,
      is_active: setting.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) {
        // page_key is disabled on edit, so it will not be present in values — drop it just in case.
        const { page_key: _pageKey, ...rest } = values;
        await seoSettingService.update(editing.id, rest);
        void message.success("SEO settings updated.");
      } else {
        await seoSettingService.create(values);
        void message.success("SEO settings created.");
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

  const handleToggle = async (setting: SeoSetting, is_active: boolean) => {
    try {
      await seoSettingService.update(setting.id, { is_active });
      setSettings((prev) => prev.map((s) => (s.id === setting.id ? { ...s, is_active } : s)));
    } catch {
      void message.error("Failed to update status.");
    }
  };

  const columns: ColumnsType<SeoSetting> = [
    {
      title: "Page Key",
      dataIndex: "page_key",
      render: (v: string) => <span className="font-medium text-slate-800">{v}</span>,
    },
    {
      title: "Meta Title",
      dataIndex: "meta_title",
      render: (v: string | null) => <span className="text-slate-500 line-clamp-2">{v || "—"}</span>,
    },
    {
      title: "Active",
      dataIndex: "is_active",
      width: 90,
      render: (v: boolean, record: SeoSetting) => (
        <AppSwitch checked={v} onChange={(checked) => void handleToggle(record, checked)} />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      render: (_: unknown, record: SeoSetting) => (
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
        </Space>
      ),
    },
  ];

  return (
    <div className="mt-6">
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
              placeholder="Search page key or title..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
          </div>
        }
      />

      <Modal
        title={editing ? "Edit SEO Setting" : "Add SEO Setting"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSave()}
        okText={editing ? "Update" : "Add"}
        confirmLoading={saving}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="page_key"
            label="Page Key"
            tooltip="Unique identifier used to look up SEO data for a page (e.g. 'landing'). Cannot be changed after creation."
            rules={[{ required: true, message: "Page key is required." }]}
          >
            <Input placeholder="e.g. landing" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="meta_title" label="Meta Title">
            <Input placeholder="e.g. ClinicFlow CRM — AI-powered clinic management" />
          </Form.Item>
          <Form.Item name="meta_description" label="Meta Description">
            <Input.TextArea rows={3} placeholder="Short description shown in search engine results." />
          </Form.Item>
          <Form.Item name="og_title" label="OG Title" tooltip="Title shown when this page is shared on social media.">
            <Input placeholder="e.g. ClinicFlow CRM" />
          </Form.Item>
          <Form.Item name="og_description" label="OG Description">
            <Input.TextArea rows={3} placeholder="Description shown when this page is shared on social media." />
          </Form.Item>
          <Form.Item name="og_image" label="OG Image URL">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="canonical_url" label="Canonical URL">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="keywords" label="Keywords" tooltip="Comma-separated keywords.">
            <Input placeholder="e.g. clinic crm, patient management, ai scheduling" />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <AppSwitch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
