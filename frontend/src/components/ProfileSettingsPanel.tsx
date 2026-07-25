"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Form, Input, Select, Upload, message } from "antd";
import type { UploadFile } from "antd";
import { Bell, KeyRound, Mail, Phone, SquarePen, Trash2, UploadCloud, User } from "lucide-react";
import { PageSection } from "@/components/PageSection";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { fetchMeThunk } from "@/store/slices/authSlice";
import { authService } from "@/services/auth.service";
import {
  PROFILE_IMAGE_ACCEPT,
  beforeUploadProfileImage,
  formatFileSize,
  getInitial,
  resolveProfileImageUrl,
  withImageThumb,
} from "@/utils/profileImage";
import { AppSwitch } from "@/components/ui/AppSwitch";

type SettingsKey = "profile" | "password" | "notifications";

const splitName = (name?: string) => {
  const raw = (name ?? "").trim();
  if (!raw) return { first_name: "", last_name: "" };
  const parts = raw.split(/\s+/);
  return { first_name: parts[0] ?? "", last_name: parts.slice(1).join(" ") };
};

const COUNTRY_OPTIONS = [{ value: "india", label: "India" }, { value: "usa", label: "USA" }];
const STATE_OPTIONS = [{ value: "maharashtra", label: "Maharashtra" }, { value: "gujarat", label: "Gujarat" }];
const CITY_OPTIONS = [{ value: "mumbai", label: "Mumbai" }, { value: "ahmedabad", label: "Ahmedabad" }];

const NOTIFICATION_ITEMS = [
  { key: "lead_alerts", label: "Lead alerts", desc: "Notify when a new lead is assigned to you", defaultChecked: true },
  { key: "daily_digest", label: "Daily digest", desc: "Morning summary of pipeline activity", defaultChecked: true },
  { key: "campaign_alerts", label: "Campaign pacing alerts", desc: "Alert when campaign budget runs low", defaultChecked: false },
];

export function ProfileSettingsPanel({ eyebrow }: { eyebrow: string }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [activeSection, setActiveSection] = useState<SettingsKey>("profile");
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [profilePhotoFiles, setProfilePhotoFiles] = useState<UploadFile[]>([]);

  useEffect(() => {
    const { first_name, last_name } = splitName(user?.name);
    profileForm.setFieldsValue({
      first_name,
      last_name,
      email: user?.email ?? "",
      mobile: user?.mobile ?? "",
      clinic_name: user?.clinic_name ?? "",
      address_line_1: "",
      address_line_2: "",
      country: undefined,
      state: undefined,
      city: undefined,
      pincode: "",
    });
  }, [profileForm, user?.clinic_name, user?.email, user?.mobile, user?.name]);

  const roleLabel = useMemo(() => {
    if (user?.role === "super_admin") return "Super Admin";
    if (user?.role === "tenant_admin") return "Clinic Admin";
    return "Staff User";
  }, [user?.role]);

  const existingProfileSrc = resolveProfileImageUrl(user?.avatar);
  const selectedPhoto = profilePhotoFiles[0];
  const selectedPhotoSrc = selectedPhoto?.thumbUrl || selectedPhoto?.url || null;
  const profilePreview = selectedPhotoSrc || existingProfileSrc;

  const saveBasicInformation = async (values: {
    first_name: string;
    last_name: string;
    mobile?: string;
    clinic_name?: string;
  }) => {
    setSavingInfo(true);
    try {
      const full_name = `${values.first_name || ""} ${values.last_name || ""}`.trim();
      await authService.updateProfile({
        full_name,
        mobile: values.mobile ?? "",
        clinic_name: user?.role === "tenant_admin" ? values.clinic_name ?? "" : undefined,
        profile_photo: selectedPhoto?.originFileObj as File | undefined,
      });
      setProfilePhotoFiles([]);
      await dispatch(fetchMeThunk());
      void message.success("Profile updated successfully.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to update profile.";
      void message.error(msg);
    } finally {
      setSavingInfo(false);
    }
  };

  const removePhoto = async () => {
    if (profilePhotoFiles.length > 0) {
      setProfilePhotoFiles([]);
      return;
    }
    if (!existingProfileSrc) return;
    setRemovingPhoto(true);
    try {
      await authService.updateProfile({ remove_profile_photo: true });
      await dispatch(fetchMeThunk());
      void message.success("Profile photo removed.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to remove photo.";
      void message.error(msg);
    } finally {
      setRemovingPhoto(false);
    }
  };

  const savePassword = async (values: { old_password: string; new_password: string; confirm_password: string }) => {
    if (values.new_password !== values.confirm_password) {
      void message.error("New passwords do not match.");
      return;
    }
    setSavingPw(true);
    try {
      await authService.updateProfile({
        old_password: values.old_password,
        new_password: values.new_password,
      });
      passwordForm.resetFields();
      void message.success("Password changed successfully.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to change password.";
      void message.error(msg);
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageSection eyebrow={eyebrow} title="Settings" description={`Manage your ${roleLabel.toLowerCase()} profile.`} />

      <section className="overflow-hidden border border-brand-border bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[270px_1fr]">
          <aside className="border-b border-brand-border p-4 md:border-b-0 md:border-r">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setActiveSection("profile")}
                className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  activeSection === "profile"
                    ? "bg-sidebar-active text-primary"
                    : "border-transparent text-slate-700 hover:bg-slate-50"
                }`}
              >
                <SquarePen size={14} />
                Profile Settings
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("password")}
                className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  activeSection === "password"
                    ? "bg-sidebar-active text-primary"
                    : "border-transparent text-slate-700 hover:bg-slate-50"
                }`}
              >
                <KeyRound size={14} />
                Change Password
              </button>
             
            </div>
          </aside>

          <main className="p-5">
            {activeSection === "profile" && (
              <Form form={profileForm} layout="vertical" onFinish={saveBasicInformation}>
                <h3 className="text-[28px] font-semibold text-slate-900 md:text-[30px]">Basic Information</h3>
                <div className="my-4 border-b border-brand-border" />

                <div className="mb-6 grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <label className="w-40 text-sm font-medium text-slate-700">Profile Image *</label>
                    <div className="flex items-center gap-3">
                      {profilePreview ? (
                        <img src={profilePreview} alt="Profile" className="h-16 w-16 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <Avatar size={64} className="bg-sky-100 text-sky-700 text-xl font-semibold">
                          {getInitial(user?.name)}
                        </Avatar>
                      )}
                      <div className="flex flex-col gap-2">
                        <Upload
                          fileList={profilePhotoFiles}
                          beforeUpload={beforeUploadProfileImage}
                          onChange={({ fileList }) => {
                            setProfilePhotoFiles(withImageThumb(fileList.slice(-1)));
                          }}
                          accept={PROFILE_IMAGE_ACCEPT}
                          multiple={false}
                          showUploadList={false}
                        >
                          <Button size="small" icon={<UploadCloud size={14} />}>Upload</Button>
                        </Upload>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          {(profilePhotoFiles.length > 0 || existingProfileSrc) && (
                            <button
                              type="button"
                              onClick={removePhoto}
                              disabled={removingPhoto}
                              className="inline-flex items-center justify-center rounded p-1 text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                              title="Remove photo"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          <span>{selectedPhoto ? formatFileSize((selectedPhoto.originFileObj as File | undefined)?.size) : "Max 10 MB"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Form.Item label="First Name *" name="first_name" rules={[{ required: true, message: "First name is required." }]}>
                    <Input prefix={<User size={14} className="text-slate-400" />} />
                  </Form.Item>
                  <Form.Item label="Last Name *" name="last_name" rules={[{ required: true, message: "Last name is required." }]}>
                    <Input prefix={<User size={14} className="text-slate-400" />} />
                  </Form.Item>
                  <Form.Item label="Email *" name="email">
                    <Input prefix={<Mail size={14} className="text-slate-400" />} disabled className="bg-slate-50" />
                  </Form.Item>
                  <Form.Item label="Phone Number *" name="mobile" rules={[{ required: true, message: "Phone number is required." }]}>
                    <Input prefix={<Phone size={14} className="text-slate-400" />} />
                  </Form.Item>
                  {user?.role === "tenant_admin" && (
                    <Form.Item label="Clinic Name" name="clinic_name" className="md:col-span-2">
                      <Input />
                    </Form.Item>
                  )}
                </div>

                <div className="my-4 border-b border-brand-border" />
              

                <div className="mt-3 flex justify-end gap-2">
                  <Button onClick={() => profileForm.resetFields()}>Cancel</Button>
                  <Button type="primary" htmlType="submit" loading={savingInfo}>Save Changes</Button>
                </div>
              </Form>
            )}

            {activeSection === "password" && (
              <Form form={passwordForm} layout="vertical" onFinish={savePassword}>
                <h3 className="text-[28px] font-semibold text-slate-900 md:text-[30px]">Change Password</h3>
                <div className="my-4 border-b border-brand-border" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Form.Item
                    label="Current Password *"
                    name="old_password"
                    rules={[{ required: true, message: "Please enter current password." }]}
                  >
                    <Input.Password prefix={<KeyRound size={14} className="text-slate-400" />} />
                  </Form.Item>
                  <div />
                  <Form.Item
                    label="New Password *"
                    name="new_password"
                    rules={[{ required: true, message: "Please enter new password." }, { min: 8, message: "At least 8 characters required." }]}
                  >
                    <Input.Password prefix={<KeyRound size={14} className="text-slate-400" />} />
                  </Form.Item>
                  <Form.Item
                    label="Confirm New Password *"
                    name="confirm_password"
                    rules={[{ required: true, message: "Please confirm new password." }]}
                  >
                    <Input.Password prefix={<KeyRound size={14} className="text-slate-400" />} />
                  </Form.Item>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button onClick={() => passwordForm.resetFields()}>Cancel</Button>
                  <Button type="primary" htmlType="submit" loading={savingPw}>Save Changes</Button>
                </div>
              </Form>
            )}

            
          </main>
        </div>
      </section>
    </div>
  );
}
