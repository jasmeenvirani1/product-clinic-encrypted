"use client";

import { App, Button, Form, Input, Modal, Space, Tooltip } from "antd";
import { SquarePen, Plus, Trash2 } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { useCallback, useEffect, useState } from "react";
import type { BackendPermission } from "@/utils/types";
import { permissionService } from "@/services/rbac.service";
import { api } from "@/utils/API";

export default function PermissionsPage() {
  const { message, modal } = App.useApp();

  const [permissions, setPermissions] = useState<BackendPermission[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editing,     setEditing]     = useState<BackendPermission | null>(null);
  const [form] = Form.useForm();

  // ── Load ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPermissions(await permissionService.getAll());
    } catch {
      void message.error("Failed to load permissions.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { void load(); }, [load]);

  // ── CRUD ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (perm: BackendPermission) => {
    setEditing(perm);
    form.setFieldsValue({ name: perm.name, slug: perm.slug });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await api.put(`/permissions/${editing.id}`, values);
        void message.success("Permission updated.");
      } else {
        await api.post("/permissions", values);
        void message.success("Permission created.");
      }
      setModalOpen(false);
      void load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) void message.error(msg);
    }
  };

  const handleDelete = (perm: BackendPermission) => {
    modal.confirm({
      title:   `Delete permission "${perm.name}"?`,
      content: "This will remove the permission from all role assignments.",
      okText:  "Delete",
      okType:  "danger",
      onOk:    async () => {
        try {
          await api.delete(`/permissions/${perm.id}`);
          void message.success("Permission deleted.");
          void load();
        } catch {
          void message.error("Failed to delete permission.");
        }
      },
    });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editing) {
      form.setFieldValue(
        "slug",
        e.target.value.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
      );
    }
  };

  // ── Columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title:     "Name",
      dataIndex: "name",
      key:       "name",
      render:    (n: string) => <span className="font-semibold">{n}</span>,
    },
    {
      title:     "Slug",
      dataIndex: "slug",
      key:       "slug",
      render:    (s: string) => (
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{s}</code>
      ),
    },
    {
      title:  "Actions",
      key:    "actions",
      width:  100,
      render: (_: unknown, row: BackendPermission) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<SquarePen size={14} className="!text-blue-500" />}
              className="!rounded-lg hover:!bg-blue-50"
              onClick={() => openEdit(row)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              icon={<Trash2 size={14} className="!text-red-500" />}
              className="!rounded-lg hover:!bg-red-50"
              onClick={() => handleDelete(row)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageSection
        title="Permissions"
        actions={
          <Button type="primary" icon={<Plus size={15} />} onClick={openCreate}>
            New Permission
          </Button>
        }
      />

      <DataTable
        rowKey="id"
        columns={columns}
        dataSource={permissions}
        loading={loading}
      />

      <Modal
        title={editing ? "Edit Permission" : "New Permission"}
        open={modalOpen}
        onOk={() => void handleSave()}
        onCancel={() => setModalOpen(false)}
        okText={editing ? "Save Changes" : "Create"}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="Display Name"
            rules={[{ required: true, message: "Name is required." }]}
          >
            <Input placeholder="e.g. Export" onChange={handleNameChange} />
          </Form.Item>
          <Form.Item
            name="slug"
            label="Slug"
            rules={[
              { required: true, message: "Slug is required." },
              { pattern: /^[a-z0-9_]+$/, message: "Only lowercase letters, numbers and underscores." },
            ]}
            tooltip="Used in backend checkPermission middleware"
          >
            <Input placeholder="e.g. export" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
