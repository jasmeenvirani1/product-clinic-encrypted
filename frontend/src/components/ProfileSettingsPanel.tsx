"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Button, Form, Input, Select, Upload, message } from "antd";
import type { UploadFile } from "antd";
import { Bell, Bot, Building2, KeyRound, Mail, Phone, Plus, Save, SquarePen, Trash2, UploadCloud, User } from "lucide-react";
import { PageSection } from "@/components/PageSection";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { fetchMeThunk } from "@/store/slices/authSlice";
import { authService } from "@/services/auth.service";
import { specialityService, type Speciality } from "@/services/speciality.service";
import { useThemeColors } from "@/providers/ThemeProvider";
import { ThemeSettingsPanel, type ThemeSettingsPanelHandle } from "@/components/ThemeSettingsPanel";
import { AiModelsPanel, type AiModelsPanelHandle } from "@/components/AiModelsPanel";
import {
  PROFILE_IMAGE_ACCEPT,
  beforeUploadProfileImage,
  formatFileSize,
  getInitial,
  resolveProfileImageUrl,
  withImageThumb,
} from "@/utils/profileImage";
import { AppSwitch } from "@/components/ui/AppSwitch";

type SettingsKey = "profile" | "password" | "platform" | "ai-models";

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
  const { platformName, refreshTheme } = useThemeColors();
  const [activeSection, setActiveSection] = useState<SettingsKey>("profile");
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [profilePhotoFiles, setProfilePhotoFiles] = useState<UploadFile[]>([]);
  const themePanelRef = useRef<ThemeSettingsPanelHandle>(null);
  const aiModelsPanelRef = useRef<AiModelsPanelHandle>(null);
  const [platformDraftName, setPlatformDraftName] = useState(platformName);
  const [platformDirty, setPlatformDirty] = useState(false);
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<Speciality[]>([]);

  useEffect(() => {
    profileForm.setFieldsValue({
      normal_name: user?.name ?? "",
      email: user?.email ?? "",
      mobile: user?.mobile ?? "",
      clinic_name: user?.clinic_name ?? "",
      username: user?.username ?? "",
      experience: user?.experience ?? "",
      education: user?.education ?? "",
      category_id: user?.category_id ?? undefined,
      address_line_1: "",
      address_line_2: "",
      country: undefined,
      state: undefined,
      city: undefined,
      pincode: "",
    });
  }, [
    profileForm,
    user?.clinic_name,
    user?.email,
    user?.mobile,
    user?.name,
    user?.username,
    user?.experience,
    user?.education,
    user?.category_id,
  ]);

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

  useEffect(() => {
    setPlatformDraftName(platformName);
  }, [platformName]);

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
    normal_name: string;
    mobile?: string;
    clinic_name?: string;
    username?: string;
    experience?: string;
    education?: string;
    category_id?: number | null;
  }) => {
    setSavingInfo(true);
    try {
      await authService.updateProfile({
        full_name: (values.normal_name || "").trim(),
        mobile: values.mobile ?? "",
        clinic_name: user?.role === "tenant_admin" ? values.clinic_name ?? "" : undefined,
        profile_photo: selectedPhoto?.originFileObj as File | undefined,
        username: values.username ?? "",
        experience: values.experience ?? "",
        education: values.education ?? "",
        category_id: values.category_id ?? null,
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

  const savePlatformSettings = async () => {
    setSavingPlatform(true);
    try {
      await themePanelRef.current?.save();
      refreshTheme();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to update platform settings.";
      void message.error(msg);
    } finally {
      setSavingPlatform(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageSection eyebrow={eyebrow} title="Settings" description={`Manage your ${roleLabel.toLowerCase()} profile.`} />

      <section className="overflow-hidden border border-brand-border bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[270px_1fr] md:items-start">
          <aside className="border-b border-brand-border p-4 md:sticky md:top-0 md:h-[calc(100vh-160px)] md:overflow-y-auto md:border-b-0 md:border-r">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveSection("profile")}
                className={`relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeSection === "profile"
                    ? "bg-sidebar-active text-primary"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {activeSection === "profile" && (
                  <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary" />
                )}
                <SquarePen size={15} className="shrink-0" />
                Profile Settings
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("password")}
                className={`relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeSection === "password"
                    ? "bg-sidebar-active text-primary"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {activeSection === "password" && (
                  <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary" />
                )}
                <KeyRound size={15} className="shrink-0" />
                Change Password
              </button>
              {user?.role === "super_admin" && (
                <button
                  type="button"
                  onClick={() => setActiveSection("platform")}
                  className={`relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    activeSection === "platform"
                      ? "bg-sidebar-active text-primary"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {activeSection === "platform" && (
                    <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary" />
                  )}
                  <Building2 size={15} className="shrink-0" />
                  Platform Settings
                </button>
              )}
              {user?.role === "super_admin" && (
                <button
                  type="button"
                  onClick={() => setActiveSection("ai-models")}
                  className={`relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    activeSection === "ai-models"
                      ? "bg-sidebar-active text-primary"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {activeSection === "ai-models" && (
                    <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary" />
                  )}
                  <Bot size={15} className="shrink-0" />
                  AI Models
                </button>
              )}
            </div>
          </aside>

          <main className="p-5 md:h-[calc(100vh-160px)] md:overflow-y-auto">
            {activeSection === "profile" && (
              <Form form={profileForm} layout="vertical" onFinish={saveBasicInformation}>
                <h3 className="text-lg font-semibold text-slate-900">Basic Information</h3>

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
                  <Form.Item label="Display Name" name="normal_name" rules={[{ required: true, message: "Display name is required." }]}>
                    <Input prefix={<User size={14} className="text-slate-400" />} placeholder="Public display name" />
                  </Form.Item>
                  <Form.Item label="Email" name="email">
                    <Input prefix={<Mail size={14} className="text-slate-400" />} disabled className="bg-slate-50" />
                  </Form.Item>
                  <Form.Item label="Phone Number" name="mobile" rules={[{ required: true, message: "Phone number is required." }]}>
                    <Input prefix={<Phone size={14} className="text-slate-400" />} />
                  </Form.Item>
                  {user?.role === "tenant_admin" && (
                    <Form.Item label="Clinic Name" name="clinic_name" className="md:col-span-2">
                      <Input />
                    </Form.Item>
                  )}
                  <Form.Item label="Username" name="username">
                    <Input placeholder="e.g. smiledentalstudio" />
                  </Form.Item>
                  <Form.Item label="Category" name="category_id">
                    <Select
                      allowClear
                      placeholder="Select a category"
                      options={categoryOptions.map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </Form.Item>
                  <Form.Item label="Experience" name="experience" className="md:col-span-2">
                    <Input.TextArea rows={2} placeholder="e.g. 8 years in cosmetic dentistry" />
                  </Form.Item>
                  <Form.Item label="Education" name="education" className="md:col-span-2">
                    <Input.TextArea rows={2} placeholder="e.g. DDS, University of Texas" />
                  </Form.Item>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <Button onClick={() => profileForm.resetFields()}>Cancel</Button>
                  <Button type="primary" htmlType="submit" loading={savingInfo}>Save Changes</Button>
                </div>
              </Form>
            )}

            {activeSection === "password" && (
              <Form form={passwordForm} layout="vertical" onFinish={savePassword}>
                <h3 className="text-lg font-semibold text-slate-900">Change Password</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Form.Item
                    label="Current Password"
                    name="old_password"
                    rules={[{ required: true, message: "Please enter current password." }]}
                  >
                    <Input.Password prefix={<KeyRound size={14} className="text-slate-400" />} />
                  </Form.Item>
                  <div />
                  <Form.Item
                    label="New Password"
                    name="new_password"
                    rules={[{ required: true, message: "Please enter new password." }, { min: 8, message: "At least 8 characters required." }]}
                  >
                    <Input.Password prefix={<KeyRound size={14} className="text-slate-400" />} />
                  </Form.Item>
                  <Form.Item
                    label="Confirm New Password"
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

            {activeSection === "platform" && user?.role === "super_admin" && (
              <div>
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Platform Settings</h3>
                    <p className="mt-1 text-sm text-slate-500">Branding and appearance applied across the entire platform.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      disabled={!platformDirty}
                      onClick={() => themePanelRef.current?.discard()}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="primary"
                      icon={<Save size={14} />}
                      loading={savingPlatform}
                      disabled={!platformDirty}
                      onClick={() => void savePlatformSettings()}
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>

                <ThemeSettingsPanel
                  ref={themePanelRef}
                  embedded
                  platformName={platformDraftName}
                  onPlatformNameChange={setPlatformDraftName}
                  onDirtyChange={setPlatformDirty}
                />
              </div>
            )}

            {activeSection === "ai-models" && user?.role === "super_admin" && (
              <div>
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">AI Models</h3>
                  <Button
                    type="primary"
                    icon={<Plus size={14} />}
                    onClick={() => aiModelsPanelRef.current?.openCreate()}
                    className="shrink-0"
                  >
                    Add Model
                  </Button>
                </div>
                <AiModelsPanel ref={aiModelsPanelRef} />
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}
