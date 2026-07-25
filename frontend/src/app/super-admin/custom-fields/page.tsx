"use client";

import { useEffect, useState } from "react";
import {
  App, Badge, Button, Form, Input, InputNumber, Modal, Select, Switch, Tag,
} from "antd";
import { Form as AntForm } from "antd";
import { Plus, Pencil, Trash2, SlidersHorizontal } from "lucide-react";
import { PageSection } from "@/components/PageSection";
import { DataTable } from "@/components/DataTable";
import { customFieldsService } from "@/services/customFields.service";
import type { CustomField, CreateCustomFieldPayload } from "@/types/customField.types";
import type { ColumnsType } from "antd/es/table";

const TABLE_OPTIONS = [
  { value: "leads",         label: "Leads" },
  { value: "conversations", label: "Conversations" },
  { value: "campaigns",     label: "Campaigns" },
];

const TYPE_COLORS: Record<CustomField["field_type"], string> = {
  text:    "blue",
  number:  "purple",
  date:    "cyan",
  select:  "orange",
  boolean: "green",
};

const FIELD_KEY_RE = /^[a-z][a-z0-9_]*$/;

export default function CustomFieldsPage() {
  const { message, modal } = App.useApp();
  const [form] = AntForm.useForm();
  const fieldType = AntForm.useWatch("field_type", form);

  const [fields, setFields]       = useState<CustomField[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<CustomField | null>(null);
  const [tableFilter, setTableFilter] = useState<string | undefined>(undefined);

  const load = async () => {
    setLoading(true);
    try {
      const data = await customFieldsService.getAll(tableFilter);
      setFields(data);
    } catch {
      void message.error("Failed to load custom fields.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [tableFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ field_type: "text", is_required: false, is_active: true, sort_order: 0 });
    setModalOpen(true);
  };

  const openEdit = (field: CustomField) => {
    setEditing(field);
    form.setFieldsValue({
      table_name:  field.table_name,
      field_key:   field.field_key,
      label:       field.label,
      field_type:  field.field_type,
      options:     (field.options ?? []).join(", "),
      is_required: field.is_required,
      sort_order:  field.sort_order,
      is_active:   field.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const options = values.options
        ? (values.options as string).split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];

      if (editing) {
        await customFieldsService.update(editing.id, {
          label:       values.label,
          field_type:  values.field_type,
          options,
          is_required: values.is_required,
          sort_order:  values.sort_order,
          is_active:   values.is_active,
        });
        void message.success("Field updated.");
      } else {
        const payload: CreateCustomFieldPayload = {
          table_name:  values.table_name,
          field_key:   values.field_key,
          label:       values.label,
          field_type:  values.field_type,
          options,
          is_required: values.is_required ?? false,
          sort_order:  values.sort_order ?? 0,
          is_active:   true,
        };
        await customFieldsService.create(payload);
        void message.success("Field created.");
      }
      setModalOpen(false);
      void load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      void message.error(msg ?? "Failed to save field.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = (field: CustomField) => {
    modal.confirm({
      title: `Deactivate "${field.label}"?`,
      content: "The field will be hidden from all tables. Existing data is preserved.",
      okText: "Deactivate",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await customFieldsService.remove(field.id);
          void message.success("Field deactivated.");
          void load();
        } catch {
          void message.error("Failed to deactivate field.");
        }
      },
    });
  };

  const handleToggleActive = async (field: CustomField, checked: boolean) => {
    try {
      await customFieldsService.update(field.id, { is_active: checked });
      void load();
    } catch {
      void message.error("Failed to update field.");
    }
  };

  const columns: ColumnsType<CustomField> = [
    {
      title: "Label",
      dataIndex: "label",
      render: (v: string, r: CustomField) => (
        <div>
          <span className="font-semibold text-slate-800">{v}</span>
          {r.is_required && <Tag className="ml-2" color="red">Required</Tag>}
        </div>
      ),
    },
    {
      title: "Field Key",
      dataIndex: "field_key",
      render: (v: string) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{v}</code>,
    },
    {
      title: "Table",
      dataIndex: "table_name",
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: "Type",
      dataIndex: "field_type",
      render: (v: CustomField["field_type"]) => <Tag color={TYPE_COLORS[v]}>{v}</Tag>,
    },
    {
      title: "Sort",
      dataIndex: "sort_order",
      width: 60,
    },
    {
      title: "Active",
      dataIndex: "is_active",
      width: 80,
      render: (v: boolean, r: CustomField) => (
        <Switch size="small" checked={v} onChange={(c) => void handleToggleActive(r, c)} />
      ),
    },
    {
      title: "Actions",
      width: 100,
      render: (_: unknown, r: CustomField) => (
        <div className="flex gap-2">
          <Button size="small" icon={<Pencil size={12} />} onClick={() => openEdit(r)} />
          <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => handleDeactivate(r)} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageSection
        title="Custom Fields"
        description="Add extra data fields to any table. Fields appear for all clinics by default; each clinic can hide them from their column settings."
        helpMenuSlug={false}
        actions={
          <div className="flex items-center gap-2">
            <Select
              placeholder="All Tables"
              allowClear
              style={{ width: 160 }}
              options={TABLE_OPTIONS}
              value={tableFilter}
              onChange={(v) => setTableFilter(v as string | undefined)}
            />
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              Add Field
            </Button>
          </div>
        }
      />

      <div className="mt-4">
        <DataTable
          rowKey="id"
          loading={loading}
          dataSource={fields}
          columns={columns}
          cardTitle={
            <span>
              {fields.length} field{fields.length !== 1 ? "s" : ""}
              {fields.filter((f) => !f.is_active).length > 0 && (
                <Badge
                  count={`${fields.filter((f) => !f.is_active).length} inactive`}
                  color="default"
                  className="ml-2"
                />
              )}
            </span>
          }
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? "Edit Custom Field" : "Add Custom Field"}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText={editing ? "Save" : "Create Field"}
        confirmLoading={saving}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item
              name="table_name"
              label="Table"
              rules={[{ required: true, message: "Select a table." }]}
            >
              <Select options={TABLE_OPTIONS} disabled={!!editing} placeholder="Select table" />
            </Form.Item>

            <Form.Item
              name="field_key"
              label="Field Key"
              tooltip="Unique snake_case identifier. Cannot be changed after creation."
              rules={[
                { required: true, message: "Field key is required." },
                { pattern: FIELD_KEY_RE, message: "Must be snake_case (e.g. budget_inr)." },
              ]}
            >
              <Input disabled={!!editing} placeholder="e.g. budget_inr" />
            </Form.Item>

            <Form.Item
              name="label"
              label="Label"
              className="col-span-2"
              rules={[{ required: true, message: "Label is required." }]}
            >
              <Input placeholder="Displayed column header (e.g. Budget ₹)" />
            </Form.Item>

            <Form.Item
              name="field_type"
              label="Field Type"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: "text",    label: "Text" },
                  { value: "number",  label: "Number" },
                  { value: "date",    label: "Date" },
                  { value: "select",  label: "Select (dropdown)" },
                  { value: "boolean", label: "Boolean (Yes/No)" },
                ]}
              />
            </Form.Item>

            <Form.Item name="sort_order" label="Sort Order">
              <InputNumber min={0} className="w-full" />
            </Form.Item>

            {fieldType === "select" && (
              <Form.Item
                name="options"
                label="Options"
                className="col-span-2"
                tooltip="Comma-separated list of dropdown values."
                rules={[{ required: true, message: "Provide at least one option." }]}
              >
                <Input.TextArea rows={2} placeholder="Option A, Option B, Option C" />
              </Form.Item>
            )}

            <Form.Item name="is_required" label="Required" valuePropName="checked">
              <Switch />
            </Form.Item>

            {editing && (
              <Form.Item name="is_active" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            )}
          </div>
        </Form>
      </Modal>
    </div>
  );
}
