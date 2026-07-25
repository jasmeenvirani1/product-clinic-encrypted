"use client";

import {
  App,
  Badge,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tooltip,
} from "antd";
import { SquarePen, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BackendMenu, BackendPermission, BackendRole } from "@/utils/types";
import { menuService, permissionService, roleService } from "@/services/rbac.service";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { AppSwitch } from "@/components/ui/AppSwitch";

// ─── Types ────────────────────────────────────────────────────────────
type PermMatrix = Record<number, Set<number>>; // menu_id → Set<permission_id>

function matrixToPayload(matrix: PermMatrix) {
  return Object.entries(matrix)
    .filter(([, perms]) => perms.size > 0)
    .map(([menuId, perms]) => ({
      menu_id:        Number(menuId),
      permission_ids: Array.from(perms),
    }));
}

// ─── Component ────────────────────────────────────────────────────────
export default function RolesPage() {
  const { message, modal } = App.useApp();

  const [roles,       setRoles]       = useState<BackendRole[]>([]);
  const [menus,       setMenus]       = useState<BackendMenu[]>([]);
  const [permissions, setPermissions] = useState<BackendPermission[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [search,      setSearch]      = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filteredRoles = useMemo(() => {
    const q = search.toLowerCase();
    return roles.filter((r) => {
      const matchSearch = !q || r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q);
      const matchStatus =
        statusFilter === null ||
        (statusFilter === "active" ? r.is_active : !r.is_active);
      return matchSearch && matchStatus;
    });
  }, [roles, search, statusFilter]);

  // Role form modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole,   setEditingRole]   = useState<BackendRole | null>(null);
  const [roleForm] = Form.useForm();

  // Permission assignment modal
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [permLoading,   setPermLoading]   = useState(false);
  const [selectedRole,  setSelectedRole]  = useState<BackendRole | null>(null);
  const [permMatrix,    setPermMatrix]    = useState<PermMatrix>({});

  // ── Load data ────────────────────────────────────────────────────────
  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      setRoles(await roleService.getAll());
    } catch {
      void message.error("Failed to load roles.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void loadRoles();
    menuService.getAll().then(setMenus).catch(() => void message.error("Failed to load menus."));
    permissionService.getAll().then(setPermissions).catch(() => void message.error("Failed to load permissions."));
  }, [loadRoles, message]);

  // ── Role CRUD ────────────────────────────────────────────────────────
  const openCreateRole = () => {
    setEditingRole(null);
    roleForm.resetFields();
    setRoleModalOpen(true);
  };

  const openEditRole = (role: BackendRole) => {
    setEditingRole(role);
    roleForm.setFieldsValue({ name: role.name, description: role.description });
    setRoleModalOpen(true);
  };

  const handleRoleSave = async () => {
    try {
      const values = await roleForm.validateFields();
      if (editingRole) {
        await roleService.update(editingRole.id, values);
        void message.success("Role updated.");
      } else {
        await roleService.create(values);
        void message.success("Role created.");
      }
      setRoleModalOpen(false);
      void loadRoles();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      void message.error(msg ?? "Failed to save role.");
    }
  };

  const handleDeleteRole = (role: BackendRole) => {
    modal.confirm({
      title:   `Delete role "${role.name}"?`,
      content: "This will remove all permissions assigned to this role. This action cannot be undone.",
      okText:  "Delete",
      okType:  "danger",
      onOk:    async () => {
        try {
          await roleService.remove(role.id);
          void message.success("Role deleted.");
          void loadRoles();
        } catch {
          void message.error("Failed to delete role.");
        }
      },
    });
  };

  // ── Permission assignment ────────────────────────────────────────────
  const openPermModal = async (role: BackendRole) => {
    setSelectedRole(role);
    setPermLoading(true);
    setPermModalOpen(true);
    try {
      const { menuPermissions } = await roleService.getById(role.id);
      // Build matrix from existing permissions
      const matrix: PermMatrix = {};
      for (const row of menuPermissions) {
        const mid = row.Menu.id;
        if (!matrix[mid]) matrix[mid] = new Set();
        matrix[mid].add(row.Permission.id);
      }
      setPermMatrix(matrix);
    } catch {
      void message.error("Failed to load permissions.");
    } finally {
      setPermLoading(false);
    }
  };

  const togglePerm = (menuId: number, permId: number, checked: boolean) => {
    setPermMatrix((prev) => {
      const next = { ...prev };
      if (!next[menuId]) next[menuId] = new Set();
      else next[menuId] = new Set(next[menuId]);
      if (checked) next[menuId].add(permId);
      else          next[menuId].delete(permId);
      return next;
    });
  };

  const handlePermSave = async () => {
    if (!selectedRole) return;
    setPermLoading(true);
    try {
      await roleService.assignPermissions(selectedRole.id, matrixToPayload(permMatrix));
      void message.success("Permissions saved.");
      setPermModalOpen(false);
    } catch {
      void message.error("Failed to save permissions.");
    } finally {
      setPermLoading(false);
    }
  };

  // ── Table columns ────────────────────────────────────────────────────
  const columns = [
    {
      title:     "Role Name",
      dataIndex: "name",
      key:       "name",
      render:    (name: string) => (
        <span className="font-semibold capitalize">{name.replace(/_/g, " ")}</span>
      ),
    },
    {
      title:     "Description",
      dataIndex: "description",
      key:       "description",
      render:    (d: string | null) => d ?? <span className="text-slate-400">—</span>,
    },
    {
      title:  "Status",
      key:    "is_active",
      render: (_: unknown, row: BackendRole) => (
        <Badge status={row.is_active ? "success" : "error"} text={row.is_active ? "Active" : "Inactive"} />
      ),
    },
    {
      title: "Manage Permissions",
      key: "manage_permissions",
      width: 180,
      render: (_: unknown, row: BackendRole) => (
        <Tooltip title="Assign permissions">
          <Button
            size="small"
            icon={<ShieldCheck size={13} />}
            type="primary"
            ghost
            onClick={() => void openPermModal(row)}
          >
            Permissions
          </Button>
        </Tooltip>
      ),
    },
    {
      title:  "Actions",
      key:    "actions",
      width:  100,
      render: (_: unknown, row: BackendRole) => (
        <Space>
          <Tooltip title="Edit role">
            <Button
              type="text"
              size="small"
              icon={<SquarePen size={14} className="!text-blue-500" />}
              className="!rounded-lg hover:!bg-blue-50"
              onClick={() => openEditRole(row)}
            />
          </Tooltip>
          <Tooltip title="Delete role">
            <Button
              type="text"
              size="small"
              icon={<Trash2 size={14} className="!text-red-500" />}
              className="!rounded-lg hover:!bg-red-50"
              onClick={() => handleDeleteRole(row)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ── Permission grid columns ──────────────────────────────────────────
  const permCols = [
    {
      title:     "Menu",
      dataIndex: "name",
      key:       "name",
      width:     200,
      render:    (name: string) => <span className="font-medium">{name}</span>,
    },
    ...permissions.map((perm) => ({
      title: <span className="capitalize">{perm.name}</span>,
      key:   perm.slug,
      width: 90,
      render: (_: unknown, menu: BackendMenu) => (
        <Checkbox
          checked={permMatrix[menu.id]?.has(perm.id) ?? false}
          onChange={(e) => togglePerm(menu.id, perm.id, e.target.checked)}
        />
      ),
    })),
  ];

  return (
    <div className="">
      <PageSection
        title="Role Management"
        actions={
          <Button type="primary" icon={<Plus size={15} />} onClick={openCreateRole}>
            New Role
          </Button>
        }
      />

      <DataTable
        rowKey="id"
        columns={columns}
        dataSource={filteredRoles}
        loading={loading}
        actions={
          <div className="flex items-center gap-2">
            <Select
              placeholder="All Statuses"
              allowClear
              value={statusFilter}
              onChange={(val) => setStatusFilter(val ?? null)}
              style={{ width: 150 }}
              options={[
                { value: "active",   label: "Active"   },
                { value: "inactive", label: "Inactive" },
              ]}
            />
            <Input.Search
              placeholder="Search roles..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
          </div>
        }
      />

      {/* Create / Edit Role modal */}
      <Modal
        title={editingRole ? "Edit Role" : "New Role"}
        open={roleModalOpen}
        onOk={() => void handleRoleSave()}
        onCancel={() => setRoleModalOpen(false)}
        okText={editingRole ? "Save Changes" : "Create Role"}
        destroyOnClose
      >
        <Form form={roleForm} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="Role Name"
            rules={[{ required: true, message: "Role name is required." }]}
          >
            <Input placeholder="e.g. clinic_manager" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional description…" />
          </Form.Item>
          {editingRole && (
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <AppSwitch />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Permission assignment modal */}
      <Modal
        title={`Permissions — ${selectedRole?.name?.replace(/_/g, " ") ?? ""}`}
        open={permModalOpen}
        onOk={() => void handlePermSave()}
        onCancel={() => setPermModalOpen(false)}
        okText="Save Permissions"
        confirmLoading={permLoading}
        width={700}
        destroyOnClose
      >
        <p className="mb-4 text-sm text-slate-500">
          Check the permissions this role should have for each menu item.
        </p>
        <Table
          rowKey="id"
          columns={permCols}
          dataSource={menus}
          loading={permLoading}
          pagination={false}
          size="small"
          scroll={{ y: 420 }}
          className="crm-table"
        />
        <div className="mt-3 flex items-center gap-4">
          <Button
            size="small"
            onClick={() => {
              const full: PermMatrix = {};
              for (const m of menus) {
                full[m.id] = new Set(permissions.map((p) => p.id));
              }
              setPermMatrix(full);
            }}
          >
            Select All
          </Button>
          <Button
            size="small"
            onClick={() => setPermMatrix({})}
          >
            Clear All
          </Button>
        </div>
      </Modal>
    </div>
  );
}
