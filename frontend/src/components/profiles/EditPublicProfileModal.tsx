"use client";

import { useEffect, useState } from "react";
import { App, Avatar, Button, Form, Input, Modal, Select, Upload } from "antd";
import type { UploadFile } from "antd";
import { UploadCloud, User } from "lucide-react";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { fetchMeThunk } from "@/store/slices/authSlice";
import { authService } from "@/services/auth.service";
import { specialityService, type Speciality } from "@/services/speciality.service";
import {
  PROFILE_IMAGE_ACCEPT,
  beforeUploadProfileImage,
  getInitial,
  resolveProfileImageUrl,
  withImageThumb,
} from "@/utils/profileImage";

interface EditPublicProfileModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface EditProfileFormValues {
  normal_name: string;
  mobile?: string;
  clinic_name?: string;
  experience?: string;
  education?: string;
  category_id?: number | null;
}

/** Inline "edit my public profile" modal — same fields/save call as
 *  ProfileSettingsPanel's Basic Information section, so the owner can edit
 *  without leaving the public profile page (no redirect to /app/profile). */
export function EditPublicProfileModal({ open, onClose, onSaved }: EditPublicProfileModalProps) {
  const { message } = App.useApp();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [form] = Form.useForm<EditProfileFormValues>();
  const [saving, setSaving] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<Speciality[]>([]);
  const [profilePhotoFiles, setProfilePhotoFiles] = useState<UploadFile[]>([]);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      normal_name: user?.name ?? "",
      mobile: user?.mobile ?? "",
      clinic_name: user?.clinic_name ?? "",
      experience: user?.experience ?? "",
      education: user?.education ?? "",
      category_id: user?.category_id ?? undefined,
    });
    setProfilePhotoFiles([]);
  }, [open, form, user?.name, user?.mobile, user?.clinic_name, user?.experience, user?.education, user?.category_id]);

  useEffect(() => {
    let cancelled = false;
    specialityService
      .getPublic()
      .then((list) => {
        if (!cancelled) setCategoryOptions(list as unknown as Speciality[]);
      })
      .catch(() => {
        // Non-fatal: category select just stays empty if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCancel = () => {
    if (saving) return;
    onClose();
  };

  const handleSubmit = async (values: EditProfileFormValues) => {
    setSaving(true);
    try {
      const selectedPhoto = profilePhotoFiles[0];
      await authService.updateProfile({
        full_name: (values.normal_name || "").trim(),
        mobile: values.mobile ?? "",
        clinic_name: user?.role === "tenant_admin" ? values.clinic_name ?? "" : undefined,
        profile_photo: selectedPhoto?.originFileObj as File | undefined,
        experience: values.experience ?? "",
        education: values.education ?? "",
        category_id: values.category_id ?? null,
      });
      await dispatch(fetchMeThunk());
      void message.success("Profile updated successfully.");
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to update profile.";
      void message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const existingProfileSrc = resolveProfileImageUrl(user?.avatar);
  const selectedPhoto = profilePhotoFiles[0];
  const selectedPhotoSrc = selectedPhoto?.thumbUrl || selectedPhoto?.url || null;
  const profilePreview = selectedPhotoSrc || existingProfileSrc;

  return (
    <Modal open={open} onCancel={handleCancel} footer={null} title="Edit Profile" destroyOnClose>
      <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
        <div className="mb-4 flex items-center gap-3">
          {profilePreview ? (
            <img src={profilePreview} alt="Profile" className="h-16 w-16 rounded-full border border-slate-200 object-cover" />
          ) : (
            <Avatar size={64} className="bg-sky-100 text-xl font-semibold text-sky-700">
              {getInitial(user?.name)}
            </Avatar>
          )}
          <Upload
            fileList={profilePhotoFiles}
            beforeUpload={beforeUploadProfileImage}
            onChange={({ fileList }) => setProfilePhotoFiles(withImageThumb(fileList.slice(-1)))}
            accept={PROFILE_IMAGE_ACCEPT}
            multiple={false}
            showUploadList={false}
          >
            <Button size="small" icon={<UploadCloud size={14} />}>Change Photo</Button>
          </Upload>
        </div>

        <Form.Item label="Display Name" name="normal_name" rules={[{ required: true, message: "Display name is required." }]}>
          <Input prefix={<User size={14} className="text-slate-400" />} placeholder="Public display name" />
        </Form.Item>
        <Form.Item label="Phone Number" name="mobile" rules={[{ required: true, message: "Phone number is required." }]}>
          <Input />
        </Form.Item>
        {user?.role === "tenant_admin" && (
          <Form.Item label="Clinic Name" name="clinic_name">
            <Input />
          </Form.Item>
        )}
        <Form.Item label="Category" name="category_id">
          <Select
            allowClear
            placeholder="Select a category"
            options={categoryOptions.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>
        <Form.Item label="Experience" name="experience">
          <Input.TextArea rows={2} placeholder="e.g. 8 years in cosmetic dentistry" />
        </Form.Item>
        <Form.Item label="Education" name="education">
          <Input.TextArea rows={2} placeholder="e.g. DDS, University of Texas" />
        </Form.Item>

        <div className="mt-2 flex justify-end gap-2">
          <Button onClick={handleCancel} disabled={saving}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={saving}>Save Changes</Button>
        </div>
      </Form>
    </Modal>
  );
}
