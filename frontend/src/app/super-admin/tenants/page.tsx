"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { App, Button, Descriptions, Form, Image, Input, Modal, Select, Space, Tag, Tooltip, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DataTable } from "@/components/DataTable";
import type { UploadFile } from "antd";
import { FileText, ImageIcon, SquarePen, Plus, Trash2, UploadCloud, UserPlus, X } from "lucide-react";
import { AppModal } from "@/components/AppModal";
import { PageSection } from "@/components/PageSection";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ProfilePhotoUploadField } from "@/components/ProfilePhotoUploadField";
import { tenantService } from "@/services/tenant.service";
import { roleService } from "@/services/rbac.service";
import { userService } from "@/services/user.service";
import { AppSwitch } from "@/components/ui/AppSwitch";
import { formatCurrency } from "@/lib/utils";
import type { Tenant, BackendRole } from "@/utils/types";
import type { User } from "@/types/user.types";
import { MAX_UPLOAD_LABEL, beforeUploadWithSizeLimit } from "@/utils/fileSize";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/api$/, "");
const docUrl = (p: string) => `${API_BASE}/uploads/proofs/${p}`;

const ACCEPTED_DOCUMENTS = "image/*,.pdf";

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageFile = (file: UploadFile): boolean => {
  const origin = file.originFileObj as File | undefined;
  if (origin?.type?.startsWith("image/")) return true;
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(file.name || "");
};

const isPdfFile = (file: UploadFile): boolean => {
  const origin = file.originFileObj as File | undefined;
  if (origin?.type === "application/pdf") return true;
  return /\.pdf$/i.test(file.name || "");
};

const isImagePath = (path: string) => /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(path);

const withImageThumb = (files: UploadFile[]): UploadFile[] =>
  files.map((file) => {
    if (!file.thumbUrl && !file.url && isImageFile(file)) {
      const origin = file.originFileObj as File | undefined;
      if (origin) return { ...file, thumbUrl: URL.createObjectURL(origin) };
    }
    return file;
  });

function DocumentPreviewList({
  files,
  onRemove,
}: {
  files: UploadFile[];
  onRemove: (_uid: string) => void;
}) {
  if (!files.length) return null;
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {files.map((file) => {
        const origin = file.originFileObj as File | undefined;
        const previewSrc = isImageFile(file) ? file.thumbUrl || file.url : undefined;
        return (
          <div key={file.uid} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
            <Button
              type="default"
              size="small"
              icon={<X size={14} />}
              onClick={() => onRemove(file.uid)}
              aria-label={`Remove ${file.name}`}
              className="absolute right-2 top-2 z-10"
            />
            <div className="h-36 w-full bg-slate-100">
              {previewSrc ? (
                <Image src={previewSrc} alt={file.name} width="100%" height={144} style={{ objectFit: "cover" }} />
              ) : isPdfFile(file) ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                  <FileText size={28} className="text-rose-500" />
                  <p className="line-clamp-2 text-xs font-medium text-slate-700">{file.name}</p>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon size={22} className="text-slate-500" />
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-500">
                {isPdfFile(file) ? "PDF" : isImageFile(file) ? "Image" : "Document"}
                {formatFileSize(origin?.size) ? ` - ${formatFileSize(origin?.size)}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocumentUploadField({
  label,
  description,
  files,
  setFiles,
  hasExisting = false,
}: {
  label: string;
  description: string;
  files: UploadFile[];
  setFiles: Dispatch<SetStateAction<UploadFile[]>>;
  hasExisting?: boolean;
}) {
  return (
    <Form.Item
      label={<span className="text-sm font-semibold text-slate-800">{label}</span>}
      extra={<span className="text-xs text-slate-500">{description} Max size: {MAX_UPLOAD_LABEL}.</span>}
    >
      {files.length === 0 && !hasExisting ? (
        <Upload.Dragger
          fileList={files}
          beforeUpload={beforeUploadWithSizeLimit}
          onChange={({ fileList }) => setFiles(withImageThumb(fileList))}
          onRemove={(file) => {
            setFiles((prev) => prev.filter((item) => item.uid !== file.uid));
            return false;
          }}
          accept={ACCEPTED_DOCUMENTS}
          multiple
          showUploadList={false}
          className="rounded-2xl border-slate-300 bg-slate-50/70"
        >
          <div className="py-4">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-primary">
              <UploadCloud size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-800">Drag and drop files here</p>
            <p className="mt-1 text-xs text-slate-500">Upload images or PDFs. Multiple files supported.</p>
            <p className="mt-1 text-xs text-slate-500">Max size: {MAX_UPLOAD_LABEL} per file.</p>
          </div>
        </Upload.Dragger>
      ) : null}
      <DocumentPreviewList
        files={files}
        onRemove={(uid) => setFiles((prev) => prev.filter((item) => item.uid !== uid))}
      />
      {files.length > 0 || hasExisting ? (
        <Upload
          fileList={files}
          beforeUpload={beforeUploadWithSizeLimit}
          onChange={({ fileList }) => setFiles(withImageThumb(fileList))}
          accept={ACCEPTED_DOCUMENTS}
          multiple
          showUploadList={false}
        >
          <button
            type="button"
            className={`${files.length > 0 ? "mt-3" : ""} inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900`}
          >
            <Plus size={16} />
            Upload more
          </button>
        </Upload>
      ) : null}
    </Form.Item>
  );
}

function DocCard({
  filePath,
  index,
  onDelete,
}: {
  filePath: string;
  index: number;
  onDelete?: (_filename: string) => void;
}) {
  const url = docUrl(filePath);
  return (
    <div className="relative flex flex-col items-center gap-1">
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(filePath); }}
          className="absolute -top-1 -right-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm border border-slate-200 hover:bg-red-50 hover:border-red-300 transition-colors"
          title="Delete document"
        >
          <Trash2 size={10} className="text-red-500" />
        </button>
      )}
      {isImagePath(filePath) ? (
        <Image
          src={url}
          alt={`Document ${index + 1}`}
          width={96}
          height={96}
          style={{ objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="group">
          <div className="w-24 h-24 flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 group-hover:border-indigo-400 transition-colors gap-1">
            <FileText size={32} className="text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">
              {filePath.split(".").pop()?.toUpperCase() ?? "FILE"}
            </span>
          </div>
        </a>
      )}
      <span className="text-xs text-indigo-600 font-medium">
        {isImagePath(filePath) ? "Preview" : "Open PDF"}
      </span>
    </div>
  );
}

export default function TenantsPage() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();

  // Clinic state
  const [, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<BackendRole[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [docsModalUser, setDocsModalUser] = useState<User | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [idProofFiles, setIdProofFiles] = useState<UploadFile[]>([]);
  const [addressProofFiles, setAddressProofFiles] = useState<UploadFile[]>([]);
  const [profilePhotoFiles, setProfilePhotoFiles] = useState<UploadFile[]>([]);
  const [removeExistingProfilePhoto, setRemoveExistingProfilePhoto] = useState(false);

  const selectableRoleOptions = roles
    .filter((r) => r.is_active && (r.name === "tenant_admin" || r.name === "staff_user"))
    .map((r) => ({ value: r.id, label: r.name === "tenant_admin" ? "Admin" : "Staff" }));

  const loadUsers = async () => {
    try {
      const response = await userService.getTenantAdmins();
      setUsers(response.data ?? []);
    } catch {
      void message.error("Failed to load users.");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    void tenantService.getTenants().then(setTenants);
    void loadUsers();
    roleService.getAll().then(setRoles).catch(() => void message.error("Failed to load roles."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getFiles = (list: UploadFile[]): File[] =>
    list.map((f) => f.originFileObj as File).filter(Boolean);

  const openCreateModal = () => {
    setEditingUser(null);
    form.resetFields();
    setIdProofFiles([]);
    setAddressProofFiles([]);
    setProfilePhotoFiles([]);
    setRemoveExistingProfilePhoto(false);
    const defaultRoleId = roles.find((r) => r.name === "tenant_admin" && r.is_active)?.id;
    if (defaultRoleId) form.setFieldsValue({ role_id: defaultRoleId });
    setModalOpen(true);
  };

  const openEditModal = (selected: User) => {
    setEditingUser(selected);
    setIdProofFiles([]);
    setAddressProofFiles([]);
    setProfilePhotoFiles([]);
    setRemoveExistingProfilePhoto(false);
    form.setFieldsValue({
      full_name: selected.full_name,
      email: selected.email,
      role_id: selected.role_id,
      clinic_name: selected.clinic_name ?? null,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const idFiles = getFiles(idProofFiles);
      const addrFiles = getFiles(addressProofFiles);
      const profilePhoto = profilePhotoFiles[0]?.originFileObj as File | undefined;
      if (editingUser) {
        await userService.update(editingUser.id, {
          full_name: values.full_name,
          email: values.email,
          mobile: values.mobile || undefined,
          role_id: values.role_id,
          clinic_name: values.clinic_name || undefined,
          ...(values.password ? { password: values.password } : {}),
          ...(idFiles.length ? { id_proof: idFiles } : {}),
          ...(addrFiles.length ? { address_proof: addrFiles } : {}),
          ...(profilePhoto ? { profile_photo: profilePhoto } : {}),
          ...(removeExistingProfilePhoto ? { remove_profile_photo: true } : {}),
        });
        void message.success("User updated.");
      } else {
        await userService.create({
          full_name: values.full_name,
          email: values.email,
          password: values.password,
          mobile: values.mobile || undefined,
          role_id: values.role_id,
          tenant_id: null,
          clinic_name: values.clinic_name || undefined,
          ...(idFiles.length ? { id_proof: idFiles } : {}),
          ...(addrFiles.length ? { address_proof: addrFiles } : {}),
          ...(profilePhoto ? { profile_photo: profilePhoto } : {}),
        });
        void message.success("User created.");
      }
      setModalOpen(false);
      form.resetFields();
      setUsersLoading(true);
      await loadUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) void message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (record: User, checked: boolean) => {
    setTogglingId(record.id);
    try {
      await userService.update(record.id, { is_active: checked });
      setUsers((prev) =>
        prev.map((u) => (u.id === record.id ? { ...u, is_active: checked, isActive: checked } : u))
      );
      void message.success(`User ${checked ? "activated" : "deactivated"} successfully.`);
    } catch {
      void message.error("Failed to update status.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = (selected: User) => {
    modal.confirm({
      title: `Delete "${selected.full_name}"?`,
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await userService.delete(selected.id);
          void message.success("User deleted.");
          setUsersLoading(true);
          await loadUsers();
        } catch {
          void message.error("Failed to delete user.");
        }
      },
    });
  };

  const handleDeleteDocument = (
    userId: string,
    type: "id_proof" | "address_proof",
    filename: string
  ) => {
    modal.confirm({
      title: "Delete this document?",
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          const result = await userService.deleteDocument(userId, type, filename);
          if (editingUser?.id === userId) setEditingUser(result.data);
          if (docsModalUser?.id === userId) setDocsModalUser(result.data);
          setUsers((prev) => prev.map((u) => (u.id === result.data.id ? result.data : u)));
          void message.success("Document deleted.");
        } catch {
          void message.error("Failed to delete document.");
        }
      },
    });
  };

  const userColumns: ColumnsType<User> = [
    {
      title: "Clinic Name",
      dataIndex: "clinic_name",
      render: (_: string, record) => (
        <div className="flex items-center gap-2.5">
          <ProfileAvatar
            imagePath={record.profile_photo}
            label={record.clinic_name || record.full_name}
            fallbackText={record.clinic_name || record.full_name}
          />
          <span className="font-medium text-slate-800">{record.clinic_name || <span className="text-slate-400">—</span>}</span>
        </div>
      ),
    },
    {
      title: "Name",
      dataIndex: "full_name",
      render: (value: string) => <span className="text-slate-700">{value}</span>,
    },
    { title: "Email", dataIndex: "email" },
    {
      title: "Role",
      dataIndex: "role",
      render: (value: User["role"]) => (
        <Tag color={value === "super_admin" ? "purple" : value === "tenant_admin" ? "blue" : "green"}>
          {value.replace("_", " ")}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "is_active",
      render: (_: boolean, record: User) => (
        <Tooltip title={record.role === "super_admin" ? "Super admin cannot be deactivated" : undefined}>
          <AppSwitch
            checked={record.is_active}
            loading={togglingId === record.id}
            disabled={record.role === "super_admin"}
            onChange={(checked) => void handleToggleStatus(record, checked)}
            size="small"
          />
        </Tooltip>
      ),
    },
    {
      title: "Documents",
      key: "documents",
      width: 100,
      render: (_, record) => {
        const hasId = !!record.id_proof?.length;
        const hasAddr = !!record.address_proof?.length;
        if (!hasId && !hasAddr) return <span className="text-slate-400 text-xs">-</span>;
        return (
          <Tooltip title="View documents">
            <FileText size={14} className="!text-indigo-500"  onClick={() => setDocsModalUser(record)} />
          </Tooltip>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 90,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              onClick={() => openEditModal(record)}
              icon={<SquarePen size={14} className="!text-blue-500" />}
              className="!rounded-lg hover:!bg-blue-50"
            />
          </Tooltip>
          <Tooltip title={record.role === "super_admin" ? "Cannot delete super admin" : "Delete user"}>
            <Button
              type="text"
              size="small"
              disabled={record.role === "super_admin"}
              onClick={() => handleDelete(record)}
              icon={
                <Trash2
                  size={14}
                  className={record.role === "super_admin" ? "!text-slate-300" : "!text-red-500"}
                />
              }
              className="!rounded-lg hover:!bg-red-50 disabled:!opacity-40"
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const filteredUsers = users.filter((u) => {
    if (statusFilter === "active" && !u.is_active) return false;
    if (statusFilter === "inactive" && u.is_active) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.clinic_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="">
      <div className="flex items-center justify-between">
        <PageSection
          eyebrow="Super Admin"
          title="Clinic management"
          description="Monitor clinic workspaces, plans, active users, and platform health."
        />
        <Button type="primary" icon={<UserPlus size={14} />} onClick={openCreateModal}>
          Add User
        </Button>
      </div>

      <DataTable<User>
        rowKey="id"
        loading={usersLoading}
        dataSource={filteredUsers}
        columns={userColumns}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              style={{ width: 140 }}
              options={[
                { value: "all", label: "All Status" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
            <Input.Search
              placeholder="Search clinics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={(v) => setSearchQuery(v)}
              allowClear
              className="w-64"
            />
          </div>
        }
      />

      {/* Clinic detail modal */}
      <AppModal
        open={Boolean(selectedTenant)}
        title={selectedTenant?.name ?? "Clinic"}
        onClose={() => setSelectedTenant(null)}
      >
        {selectedTenant ? (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="City">{selectedTenant.city}</Descriptions.Item>
            <Descriptions.Item label="Plan">{selectedTenant.plan}</Descriptions.Item>
            <Descriptions.Item label="Status">{selectedTenant.status}</Descriptions.Item>
            <Descriptions.Item label="Active users">{selectedTenant.activeUsers}</Descriptions.Item>
            <Descriptions.Item label="Monthly revenue">{formatCurrency(selectedTenant.monthlyRevenue)}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </AppModal>

      {/* Documents View Modal */}
      <Modal
        title={`Documents — ${docsModalUser?.full_name ?? ""}`}
        open={Boolean(docsModalUser)}
        onCancel={() => setDocsModalUser(null)}
        footer={null}
      >
        {docsModalUser ? (
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">ID Proof</p>
              {docsModalUser.id_proof?.length ? (
                <div className="flex flex-wrap gap-3">
                  {docsModalUser.id_proof.map((f, i) => (
                    <DocCard
                      key={f}
                      filePath={f}
                      index={i}
                      onDelete={(filename) => handleDeleteDocument(docsModalUser.id, "id_proof", filename)}
                    />
                  ))}
                </div>
              ) : (
                <span className="text-slate-400 text-sm">No ID proof uploaded</span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Address Proof</p>
              {docsModalUser.address_proof?.length ? (
                <div className="flex flex-wrap gap-3">
                  {docsModalUser.address_proof.map((f, i) => (
                    <DocCard
                      key={f}
                      filePath={f}
                      index={i}
                      onDelete={(filename) => handleDeleteDocument(docsModalUser.id, "address_proof", filename)}
                    />
                  ))}
                </div>
              ) : (
                <span className="text-slate-400 text-sm">No address proof uploaded</span>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Create / Edit User Modal */}
      <Modal
        title={editingUser ? "Edit User" : "Add User"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSave()}
        okText={editingUser ? "Update" : "Create"}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true, message: "Name is required." }]}>
            <Input placeholder="John Doe" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Email is required." },
              { type: "email", message: "Enter a valid email." },
            ]}
          >
            <Input placeholder="john@clinic.com" disabled={!!editingUser} />
          </Form.Item>
          <Form.Item name="mobile" label="Mobile">
            <Input
              placeholder="Optional"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={15}
              onChange={(e) => form.setFieldValue("mobile", e.target.value.replace(/\D/g, ""))}
            />
          </Form.Item>
          <Form.Item name="role_id" label="Role" rules={[{ required: true, message: "Role is required." }]}>
            <Select placeholder="Select role" options={selectableRoleOptions} />
          </Form.Item>
          <Form.Item name="clinic_name" label="Clinic Name">
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? "Password (optional)" : "Password"}
            rules={editingUser ? [] : [{ required: true, message: "Password is required." }]}
          >
            <Input.Password
              placeholder={editingUser ? "Leave blank to keep current password" : "Enter password"}
            />
          </Form.Item>
          <ProfilePhotoUploadField
            files={profilePhotoFiles}
            setFiles={setProfilePhotoFiles}
            existingImagePath={editingUser?.profile_photo}
            removeExisting={removeExistingProfilePhoto}
            onRemoveExistingChange={setRemoveExistingProfilePhoto}
            label="Clinic Profile Photo"
          />

          {editingUser?.id_proof?.length ? (
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 mb-2">Current ID Proof</p>
              <div className="flex flex-wrap gap-3">
                {editingUser.id_proof.map((f, i) => (
                  <DocCard
                    key={f}
                    filePath={f}
                    index={i}
                    onDelete={(filename) => handleDeleteDocument(editingUser.id, "id_proof", filename)}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <DocumentUploadField
            label={editingUser ? "Add ID Proof" : "ID Proof (optional)"}
            description="Passport, driving licence, or national ID — images and PDFs accepted"
            files={idProofFiles}
            setFiles={setIdProofFiles}
            hasExisting={Boolean(editingUser?.id_proof?.length)}
          />

          {editingUser?.address_proof?.length ? (
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 mb-2">Current Address Proof</p>
              <div className="flex flex-wrap gap-3">
                {editingUser.address_proof.map((f, i) => (
                  <DocCard
                    key={f}
                    filePath={f}
                    index={i}
                    onDelete={(filename) => handleDeleteDocument(editingUser.id, "address_proof", filename)}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <DocumentUploadField
            label={editingUser ? "Add Address Proof" : "Address Proof (optional)"}
            description="Utility bill, bank statement, or rental agreement — images and PDFs accepted"
            files={addressProofFiles}
            setFiles={setAddressProofFiles}
            hasExisting={Boolean(editingUser?.address_proof?.length)}
          />
        </Form>
      </Modal>
    </div>
  );
}
