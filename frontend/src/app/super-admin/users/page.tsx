"use client";

import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import { App, Button, Form, Image, Input, Modal, Select, Space, Tabs, Tag, Tooltip, Upload } from "antd";
import type { TabsProps } from "antd";
import type { UploadFile } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FileText, ImageIcon, SquarePen, Plus, Trash2, UploadCloud, UserPlus, X } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { PageSection } from "@/components/PageSection";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ProfilePhotoUploadField } from "@/components/ProfilePhotoUploadField";
import { roleService } from "@/services/rbac.service";
import { userService } from "@/services/user.service";
import type { User } from "@/types/user.types";
import type { BackendRole } from "@/utils/types";
import { MAX_UPLOAD_LABEL, beforeUploadWithSizeLimit } from "@/utils/fileSize";

const ACCEPTED_DOCUMENTS = "image/*,.pdf";
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/api$/, "");

const docUrl = (path: string) => `${API_BASE}/uploads/proofs/${path}`;

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

function DocPreviewGrid({
  files,
  onDelete,
}: {
  files?: string[];
  onDelete?: (_filename: string) => void;
}) {
  if (!files?.length) return <span className="text-sm text-slate-400">None uploaded</span>;

  return (
    <div className="flex flex-wrap gap-3">
      {files.map((file, index) => (
        <div key={file} className="relative flex flex-col items-center gap-1">
          {onDelete ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(file);
              }}
              className="absolute -right-1 -top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:border-red-300 hover:bg-red-50"
              title="Delete document"
            >
              <Trash2 size={10} className="text-red-500" />
            </button>
          ) : null}
          {isImagePath(file) ? (
            <>
              <Image
                src={docUrl(file)}
                alt={`Document ${index + 1}`}
                width={96}
                height={96}
                style={{ objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <span className="text-xs font-medium text-indigo-600">Preview</span>
            </>
          ) : (
            <a href={docUrl(file)} target="_blank" rel="noreferrer" className="group flex flex-col items-center gap-1">
              <div className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 transition-colors group-hover:border-indigo-400">
                <FileText size={32} className="text-slate-400" />
                <span className="text-xs font-medium text-slate-500">{file.split(".").pop()?.toUpperCase() ?? "PDF"}</span>
              </div>
              <span className="text-xs font-medium text-indigo-600 group-hover:underline">Open PDF</span>
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

export default function UsersPage() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<BackendRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [idProofFiles, setIdProofFiles] = useState<UploadFile[]>([]);
  const [addressProofFiles, setAddressProofFiles] = useState<UploadFile[]>([]);
  const [profilePhotoFiles, setProfilePhotoFiles] = useState<UploadFile[]>([]);
  const [removeExistingProfilePhoto, setRemoveExistingProfilePhoto] = useState(false);

  const selectableRoleOptions = roles
    .filter((r) => r.is_active && (r.name === "super_admin" || r.name === "tenant_admin" || r.name === "staff_user"))
    .map((r) => {
      if (r.name === "super_admin") {
        return {
          value: r.id,
          label: "Super Admin",
          disabled: activeTab !== "super_admin",
        };
      }
      return {
        value: r.id,
        label: r.name === "tenant_admin" ? "Admin" : "User",
      };
    });

  const loadUsers = async () => {
    try {
      const response = await userService.getAll();
      setUsers(response.data ?? []);
    } catch {
      void message.error("Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    roleService.getAll().then(setRoles).catch(() => void message.error("Failed to load roles."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateModal = () => {
    setEditingUser(null);
    form.resetFields();
    setIdProofFiles([]);
    setAddressProofFiles([]);
    setProfilePhotoFiles([]);
    setRemoveExistingProfilePhoto(false);
    const defaultRoleId = roles.find(
      (r) => r.name === (activeTab === "super_admin" ? "super_admin" : "staff_user") && r.is_active
    )?.id;
    if (defaultRoleId) form.setFieldsValue({ role_id: defaultRoleId });
    setModalOpen(true);
  };

  const openEditModal = async (selected: User) => {
    setEditingUser(selected);
    setIdProofFiles([]);
    setAddressProofFiles([]);
    setProfilePhotoFiles([]);
    setRemoveExistingProfilePhoto(false);
    form.setFieldsValue({
      full_name: selected.full_name,
      email: selected.email,
      mobile: selected.mobile,
      role_id: selected.role_id,
    });
    setModalOpen(true);
    try {
      const response = await userService.getById(selected.id);
      if (response.data) {
        setEditingUser(response.data);
        form.setFieldsValue({
          full_name: response.data.full_name,
          email: response.data.email,
          mobile: response.data.mobile,
          role_id: response.data.role_id,
        });
      }
    } catch {
      void message.error("Failed to load user documents.");
    }
  };

  const handleMobileInput = (value: string) => {
    form.setFieldValue("mobile", value.replace(/\D/g, ""));
  };

  const getFiles = (list: UploadFile[]): File[] =>
    list.map((f) => f.originFileObj as File).filter(Boolean);

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
          ...(idFiles.length ? { id_proof: idFiles } : {}),
          ...(addrFiles.length ? { address_proof: addrFiles } : {}),
          ...(profilePhoto ? { profile_photo: profilePhoto } : {}),
        });
        void message.success("User created.");
      }

      setModalOpen(false);
      form.resetFields();
      setLoading(true);
      await loadUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) void message.error(msg);
    } finally {
      setSaving(false);
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
          setLoading(true);
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
          setUsers((prev) => prev.map((user) => (user.id === result.data.id ? result.data : user)));
          void message.success("Document deleted.");
        } catch {
          void message.error("Failed to delete document.");
        }
      },
    });
  };

  const usersByTab = users.filter((u) => {
    if (activeTab !== "all" && u.role !== activeTab) return false;
    if (tenantFilter !== "all") {
      if (tenantFilter === "platform") {
        if (u.tenantName) return false;
      } else if ((u.tenantName ?? "") !== tenantFilter) {
        return false;
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.tenantName?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const tenantOptions = useMemo(() => {
    const names = Array.from(new Set(users.map((u) => u.tenantName).filter(Boolean) as string[])).sort((a, b) =>
      a.localeCompare(b)
    );
    return [
      { value: "all", label: "All Tenants" },
      { value: "platform", label: "Platform" },
      ...names.map((name) => ({ value: name, label: name })),
    ];
  }, [users]);

  const columns: ColumnsType<User> = [
    {
      title: "Name",
      dataIndex: "name",
      render: (_: string, record) => (
        <div className="flex items-center gap-2.5">
          <ProfileAvatar imagePath={record.profile_photo} label={record.full_name} fallbackText={record.full_name} />
          <span className="font-medium text-slate-800">{record.full_name}</span>
        </div>
      ),
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
      title: "Clinic",
      dataIndex: "tenantName",
      render: (value: string | undefined) => value ?? <span className="text-slate-400">Platform</span>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              onClick={() => void openEditModal(record)}
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
              icon={<Trash2 size={14} className={record.role === "super_admin" ? "!text-slate-300" : "!text-red-500"} />}
              className="!rounded-lg hover:!bg-red-50 disabled:!opacity-40"
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const tabItems: TabsProps["items"] = [
    { key: "all", label: `All (${users.length})` },
    { key: "super_admin", label: `Super Admin (${users.filter((u) => u.role === "super_admin").length})` },
    { key: "tenant_admin", label: `Tenant Admin (${users.filter((u) => u.role === "tenant_admin").length})` },
    { key: "staff_user", label: `Staff (${users.filter((u) => u.role === "staff_user").length})` },
  ];

  return (
    <div className="">
      <div className="flex items-center justify-between">
        <PageSection
          eyebrow="Super Admin"
          title="Platform Users"
          description="Review identities and access roles across the system."
        />
        <Button type="primary" icon={<UserPlus size={14} />} onClick={openCreateModal}>
          Add User
        </Button>
      </div>
      <Tabs items={tabItems} activeKey={activeTab} onChange={setActiveTab} />
      <DataTable
        rowKey="id"
        loading={loading}
        dataSource={usersByTab}
        columns={columns}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={tenantFilter}
              onChange={setTenantFilter}
              options={tenantOptions}
              style={{ width: 190 }}
            />
            <Input.Search
              placeholder="Search by name, email, or tenant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={(v) => setSearchQuery(v)}
              allowClear
              className="w-72"
            />
          </div>
        }
      />

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
              onChange={(e) => handleMobileInput(e.target.value)}
            />
          </Form.Item>
          <Form.Item name="role_id" label="Role" rules={[{ required: true, message: "Role is required." }]}>
            <Select placeholder="Select role" options={selectableRoleOptions} />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? "Password (optional)" : "Password"}
            rules={editingUser ? [] : [{ required: true, message: "Password is required." }]}
          >
            <Input.Password placeholder={editingUser ? "Leave blank to keep current password" : "Enter password"} />
          </Form.Item>
          <ProfilePhotoUploadField
            files={profilePhotoFiles}
            setFiles={setProfilePhotoFiles}
            existingImagePath={editingUser?.profile_photo}
            removeExisting={removeExistingProfilePhoto}
            onRemoveExistingChange={setRemoveExistingProfilePhoto}
          />

          {editingUser ? (
            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold text-slate-500">Current ID Proof</p>
              <DocPreviewGrid
                files={editingUser.id_proof}
                onDelete={(filename) => handleDeleteDocument(editingUser.id, "id_proof", filename)}
              />
            </div>
          ) : null}

          <DocumentUploadField
            label={editingUser ? "Add ID Proof" : "ID Proof (optional)"}
            description="Passport, driving licence, or national ID — images and PDFs accepted"
            files={idProofFiles}
            setFiles={setIdProofFiles}
            hasExisting={Boolean(editingUser?.id_proof?.length)}
          />

          {editingUser ? (
            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold text-slate-500">Current Address Proof</p>
              <DocPreviewGrid
                files={editingUser.address_proof}
                onDelete={(filename) => handleDeleteDocument(editingUser.id, "address_proof", filename)}
              />
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
