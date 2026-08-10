"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Divider, Form, Input, InputNumber, Modal, Select, Space, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Plus, RotateCcw, SquarePen, Trash2 } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { SpecialitiesLockedState } from "@/components/SpecialitiesLockedState";
import { AppSwitch } from "@/components/ui/AppSwitch";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { tenantSpecialityService, type Speciality } from "@/services/speciality.service";
import { ICON_OPTIONS } from "@/constants/iconOptions";

// Tenant admin panel: shows the resolved (master + own overrides) speciality
// list, with per-row Customize / Edit / Revert-or-Remove actions and an
// "Add your own speciality" action. Gated by the `specialities` plan feature —
// renders SpecialitiesLockedState instead when the feature is unavailable.
export function TenantSpecialitiesPanel() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const { hasSpecialitiesFeature } = useCurrentUser();

  const [specialities, setSpecialities] = useState<Speciality[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // "customize" = creating a tenant override of a master row via createOverride
  // "edit"      = updating an already tenant-owned row via updateOverride
  // "create"    = adding a wholly new tenant-only speciality via createOverride
  const [modalMode, setModalMode] = useState<"customize" | "edit" | "create">("create");
  const [editing, setEditing] = useState<Speciality | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [detailContent, setDetailContent] = useState("");

  const sourceOf = (s: Speciality): "master" | "override" | "addition" => {
    if (s.tenant_id === null) return "master";
    return s.has_master ? "override" : "addition";
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return specialities.filter((s) => {
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.short_description ?? "").toLowerCase().includes(q);
      const matchSource = !sourceFilter || sourceOf(s) === sourceFilter;
      return matchSearch && matchSource;
    });
  }, [specialities, search, sourceFilter]);

  const load = async () => {
    try {
      setSpecialities(await tenantSpecialityService.list());
    } catch {
      void message.error("Failed to load specialities.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasSpecialitiesFeature) {
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSpecialitiesFeature]);

  if (!hasSpecialitiesFeature) {
    return (
      <div>
        <PageSection
          eyebrow="Content Management"
          title="Specialities"
          description="Customize the master list of specialities for your clinic."
        />
        <SpecialitiesLockedState />
      </div>
    );
  }

  const openCreate = () => {
    setModalMode("create");
    setEditing(null);
    form.resetFields();
    setDetailContent("");
    const nextOrder = specialities.length ? Math.max(...specialities.map((s) => s.order)) + 1 : 0;
    form.setFieldsValue({ is_active: true, order: nextOrder });
    setModalOpen(true);
  };

  const openCustomize = (speciality: Speciality) => {
    setModalMode("customize");
    setEditing(speciality);
    fillForm(speciality);
    setModalOpen(true);
  };

  const openEdit = (speciality: Speciality) => {
    setModalMode("edit");
    setEditing(speciality);
    fillForm(speciality);
    setModalOpen(true);
  };

  const fillForm = (speciality: Speciality) => {
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
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const payload = { ...values, detail_content: detailContent.trim() ? detailContent : null };

      // Client-side slug-collision guard for brand-new additions only — server's
      // unique (tenant_id, slug) constraint is the authoritative guard either way.
      if (modalMode === "create") {
        const collides = specialities.some((s) => s.slug === payload.slug);
        if (collides) {
          void message.error("A speciality with this slug already exists.");
          return;
        }
      }

      setSaving(true);
      if (modalMode === "edit" && editing) {
        await tenantSpecialityService.updateOverride(editing.slug, payload);
        void message.success("Speciality updated.");
      } else {
        // "customize" and "create" both land on createOverride — the backend
        // upserts (create-or-update) the tenant's own row for that slug.
        await tenantSpecialityService.createOverride(payload);
        void message.success(modalMode === "customize" ? "Speciality customized." : "Speciality added.");
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

  const handleRevert = (speciality: Speciality) => {
    const isAddition = !speciality.has_master;
    modal.confirm({
      title: isAddition ? `Remove "${speciality.name}"?` : `Revert "${speciality.name}" to default?`,
      content: isAddition
        ? "This speciality was added by you and has no default to fall back to — removing it will delete it entirely."
        : "Your customizations will be discarded and the default master content will apply again.",
      okText: isAddition ? "Remove" : "Revert",
      okType: "danger",
      onOk: async () => {
        try {
          await tenantSpecialityService.revertOverride(speciality.slug);
          void message.success(isAddition ? "Speciality removed." : "Reverted to default.");
          setLoading(true);
          await load();
        } catch {
          void message.error(isAddition ? "Failed to remove speciality." : "Failed to revert speciality.");
        }
      },
    });
  };

  const handleToggle = async (speciality: Speciality, is_active: boolean) => {
    try {
      if (speciality.tenant_id === null) {
        // Untouched master row — toggling active state is itself a customization,
        // so it must create a tenant override carrying the full field set.
        await tenantSpecialityService.createOverride({
          slug: speciality.slug,
          name: speciality.name,
          icon: speciality.icon,
          short_description: speciality.short_description,
          detail_content: speciality.detail_content,
          order: speciality.order,
          is_active,
          meta_title: speciality.meta_title,
          meta_description: speciality.meta_description,
          og_title: speciality.og_title,
          og_description: speciality.og_description,
          og_image: speciality.og_image,
          canonical_url: speciality.canonical_url,
          keywords: speciality.keywords,
        });
      } else {
        await tenantSpecialityService.updateOverride(speciality.slug, { is_active });
      }
      setLoading(true);
      await load();
    } catch {
      void message.error("Failed to update status.");
    }
  };

  const renderSourceTag = (s: Speciality) => {
    const source = sourceOf(s);
    if (source === "master") return <Tag color="default">Master</Tag>;
    if (source === "override") return <Tag color="blue">Your override</Tag>;
    return <Tag color="purple">Your addition</Tag>;
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
      title: "Source",
      key: "source",
      width: 130,
      render: (_: unknown, record: Speciality) => renderSourceTag(record),
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
      width: 140,
      render: (_: unknown, record: Speciality) => {
        const isInherited = record.tenant_id === null;
        const isOwn = !isInherited;
        const canRevertOrRemove = isOwn;

        return (
          <Space size={4}>
            {isInherited && (
              <Tooltip title="Customize">
                <Button
                  type="text"
                  size="small"
                  icon={<SquarePen size={14} className="!text-blue-500" />}
                  className="!rounded-lg hover:!bg-blue-50"
                  onClick={() => openCustomize(record)}
                />
              </Tooltip>
            )}
            {isOwn && (
              <Tooltip title="Edit">
                <Button
                  type="text"
                  size="small"
                  icon={<SquarePen size={14} className="!text-blue-500" />}
                  className="!rounded-lg hover:!bg-blue-50"
                  onClick={() => openEdit(record)}
                />
              </Tooltip>
            )}
            {canRevertOrRemove && (
              <Tooltip title={record.has_master ? "Revert to default" : "Remove"}>
                <Button
                  type="text"
                  size="small"
                  icon={
                    record.has_master ? (
                      <RotateCcw size={14} className="!text-amber-500" />
                    ) : (
                      <Trash2 size={14} className="!text-red-500" />
                    )
                  }
                  className={record.has_master ? "!rounded-lg hover:!bg-amber-50" : "!rounded-lg hover:!bg-red-50"}
                  onClick={() => handleRevert(record)}
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <PageSection
        eyebrow="Content Management"
        title="Specialities"
        description="Customize the master list of specialities for your clinic. Master items can be customized or left as-is; your own additions are fully yours to manage."
        actions={
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
            Add your own speciality
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
              placeholder="All sources"
              allowClear
              value={sourceFilter}
              onChange={(val) => setSourceFilter(val ?? null)}
              style={{ width: 160 }}
              options={[
                { value: "master",   label: "Master"         },
                { value: "override", label: "Your override"  },
                { value: "addition", label: "Your addition"  },
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
        title={
          modalMode === "edit" ? "Edit Speciality" : modalMode === "customize" ? "Customize Speciality" : "Add Speciality"
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSave()}
        okText={modalMode === "edit" ? "Update" : modalMode === "customize" ? "Save Customization" : "Add"}
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
            <Input placeholder="e.g. dermatology" disabled={modalMode !== "create"} />
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
              onUploadImage={tenantSpecialityService.uploadDetailImage}
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
