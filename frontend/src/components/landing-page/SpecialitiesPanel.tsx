"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { App, Button, Divider, Form, Input, InputNumber, Modal, Select, Space, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { SquarePen, Plus, Trash2 } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { AppSwitch } from "@/components/ui/AppSwitch";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { specialityService, type Speciality } from "@/services/speciality.service";
import { ICON_OPTIONS } from "@/constants/iconOptions";

interface SpecialitiesPanelProps {
  onActionsChange: (node: ReactNode) => void;
}

export function SpecialitiesPanel({ onActionsChange }: SpecialitiesPanelProps) {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();

  const [specialities, setSpecialities] = useState<Speciality[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Speciality | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [detailContent, setDetailContent] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return specialities.filter((s) => {
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.short_description ?? "").toLowerCase().includes(q);
      const matchActive = activeFilter === null || (activeFilter === "active" ? s.is_active : !s.is_active);
      return matchSearch && matchActive;
    });
  }, [specialities, search, activeFilter]);

  const load = async () => {
    try {
      setSpecialities(await specialityService.list());
    } catch {
      void message.error("Failed to load specialities.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setDetailContent("");
    // Default the new item's order to the end of the list.
    const nextOrder = specialities.length ? Math.max(...specialities.map((s) => s.order)) + 1 : 0;
    form.setFieldsValue({ is_active: true, order: nextOrder });
    setModalOpen(true);
  };

  useEffect(() => {
    onActionsChange(
      <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
        Add Speciality
      </Button>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialities]);

  const openEdit = (speciality: Speciality) => {
    setEditing(speciality);
    form.setFieldsValue({
      slug: speciality.slug,
      name: speciality.name,
      icon: speciality.icon,
      short_description: speciality.short_description,
      order: speciality.order,
      is_active: speciality.is_active,
      meta_title: speciality.meta_title,
      meta_description: speciality.meta_description,
      og_title: speciality.og_title,
      og_description: speciality.og_description,
      og_image: speciality.og_image,
      canonical_url: speciality.canonical_url,
      keywords: speciality.keywords,
    });
    setDetailContent(typeof speciality.detail_content === "string" ? speciality.detail_content : "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const payload = { ...values, detail_content: detailContent.trim() ? detailContent : null };

      setSaving(true);
      if (editing) {
        await specialityService.update(editing.id, payload);
        void message.success("Speciality updated.");
      } else {
        await specialityService.create(payload);
        void message.success("Speciality created.");
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

  const handleDelete = (speciality: Speciality) => {
    modal.confirm({
      title: `Delete "${speciality.name}"?`,
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await specialityService.remove(speciality.id);
          void message.success("Speciality deleted.");
          setLoading(true);
          await load();
        } catch {
          void message.error("Failed to delete speciality.");
        }
      },
    });
  };

  const handleToggle = async (speciality: Speciality, is_active: boolean) => {
    try {
      await specialityService.update(speciality.id, { is_active });
      setSpecialities((prev) => prev.map((s) => (s.id === speciality.id ? { ...s, is_active } : s)));
    } catch {
      void message.error("Failed to update status.");
    }
  };

  const columns: ColumnsType<Speciality> = [
    {
      title: "#",
      dataIndex: "order",
      width: 60,
      render: (v: number) => <span className="text-slate-400">{v}</span>,
    },
    {
      title: "Icon",
      dataIndex: "icon",
      width: 70,
      render: (icon: string | null) =>
        icon ? (
          <span className="text-xs text-slate-500 line-clamp-1">{icon}</span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    {
      title: "Name",
      dataIndex: "name",
      render: (name: string) => <span className="font-medium text-slate-800">{name}</span>,
    },
    {
      title: "Slug",
      dataIndex: "slug",
      render: (slug: string) => <span className="text-slate-500">{slug}</span>,
    },
    {
      title: "Description",
      dataIndex: "short_description",
      render: (d: string | null) => <span className="text-slate-500 line-clamp-2">{d ?? "—"}</span>,
    },
    {
      title: "Active",
      dataIndex: "is_active",
      width: 90,
      render: (v: boolean, record: Speciality) => (
        <AppSwitch checked={v} onChange={(checked) => void handleToggle(record, checked)} />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: unknown, record: Speciality) => (
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
              placeholder="Search specialities..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
          </div>
        }
      />

      <Modal
        title={editing ? "Edit Speciality" : "Add Speciality"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSave()}
        okText={editing ? "Update" : "Add"}
        confirmLoading={saving}
        width={960}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Name is required." }]}
          >
            <Input placeholder="e.g. Dermatology" />
          </Form.Item>
          <Form.Item
            name="slug"
            label="Slug"
            rules={[{ required: true, message: "Slug is required." }]}
          >
            <Input placeholder="e.g. dermatology" />
          </Form.Item>
          <Form.Item name="icon" label="Icon" tooltip="Lucide React icon component name">
            <Select
              showSearch
              allowClear
              placeholder="Select icon…"
              options={ICON_OPTIONS.map((i) => ({ label: i, value: i }))}
            />
          </Form.Item>
          <Form.Item name="short_description" label="Short Description">
            <Input.TextArea rows={3} placeholder="Brief summary shown on cards/listing." />
          </Form.Item>
          <Form.Item label="Detail Content" tooltip="Rich content shown on the speciality detail page.">
            <TiptapEditor
              value={detailContent}
              onChange={setDetailContent}
              onUploadImage={specialityService.uploadDetailImage}
            />
          </Form.Item>
          <Form.Item name="order" label="Order" tooltip="Lower numbers appear first.">
            <InputNumber min={0} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <AppSwitch />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0}>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">SEO</span>
          </Divider>

          <Form.Item name="meta_title" label="Meta Title">
            <Input placeholder="SEO page title" />
          </Form.Item>
          <Form.Item name="meta_description" label="Meta Description">
            <Input.TextArea rows={2} placeholder="SEO meta description" />
          </Form.Item>
          <Form.Item name="og_title" label="OG Title">
            <Input placeholder="Open Graph title" />
          </Form.Item>
          <Form.Item name="og_description" label="OG Description">
            <Input.TextArea rows={2} placeholder="Open Graph description" />
          </Form.Item>
          <Form.Item name="og_image" label="OG Image URL">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="canonical_url" label="Canonical URL">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="keywords" label="Keywords">
            <Input placeholder="comma, separated, keywords" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
