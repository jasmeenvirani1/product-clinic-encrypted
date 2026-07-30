"use client";

import { useEffect, useState } from "react";
import { App, Button, Card, Input } from "antd";
import { Building2, CheckCircle2, Instagram, MessageCircle, ArrowRight } from "lucide-react";
import { useThemeColors } from "@/providers/ThemeProvider";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/hooks/useAppSelector";
import { aiSettingService } from "@/services/aiSetting.service";
import { userService } from "@/services/user.service";

const STEPS = ["Register", "Upload Docs", "Select Plan", "Setup"];

export default function OnboardingSetupPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);
  const { platformName } = useThemeColors();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Clinic info
  const [clinicName, setClinicName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");

  // Pre-fill clinic name from auth user if available
  useEffect(() => {
    const u = user as Record<string, unknown> | null;
    if (u?.clinic_name) setClinicName(u.clinic_name as string);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleComplete = async () => {
    setSaving(true);
    try {
      const promises: Promise<unknown>[] = [];

      // Save clinic_name on the user record
      if (user?.id && clinicName.trim()) {
        promises.push(userService.update(user.id, { clinic_name: clinicName.trim() }));
      }

      // Save extra clinic fields
      const payload: Record<string, string> = {};
      if (city.trim()) payload.clinic_city = city.trim();
      if (phone.trim()) payload.clinic_phone = phone.trim();
      if (address.trim()) payload.clinic_address = address.trim();
      if (website.trim()) payload.clinic_website = website.trim();

      if (Object.keys(payload).length > 0) {
        promises.push(aiSettingService.update(payload as any));
      }

      await Promise.all(promises);
      void message.success(`Setup complete! Welcome to ${platformName}.`);
      router.push("/app/dashboard");
    } catch {
      void message.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-slate-400">Loading your settings…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stepper */}
      <div className="flex items-center">
        {STEPS.map((step, idx) => (
          <div key={step} className="flex flex-1 last:flex-none items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                idx < 3 ? "bg-emerald-500 text-white" : "bg-emerald-600 text-white ring-2 ring-emerald-200"
              }`}>
                {idx < 3 ? <CheckCircle2 size={14} /> : "4"}
              </div>
              <span className={`hidden text-[10px] font-medium sm:block ${idx === 3 ? "text-emerald-700" : "text-slate-400"}`}>
                {step}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${idx < 3 ? "bg-emerald-400" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Complete your setup</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add your clinic details and connect your messaging channels. All fields are optional — you can update these later in Settings.
        </p>
      </div>

      {/* Clinic Information */}
      <Card className="crm-card">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5">
            <Building2 size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Clinic Information</h3>
            <p className="text-xs text-slate-400">Basic details about your practice</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 crm-form">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Clinic / Business Name</label>
            <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="e.g. Sunrise Dental Clinic" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">City</label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Mumbai" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Phone Number</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 98765 43210" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Address</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address, area" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Website <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourclinic.com" />
          </div>
        </div>
      </Card>

      {/* Messaging channels */}
      <Card className="crm-card">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex gap-2">
            <div className="rounded-xl bg-green-50 p-2.5">
              <MessageCircle size={20} className="text-green-600" />
            </div>
            <div className="rounded-xl bg-pink-50 p-2.5">
              <Instagram size={20} className="text-pink-500" />
            </div>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Messaging Channels</h3>
            <p className="text-xs text-slate-400">WhatsApp &amp; Instagram</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
          <p className="text-sm text-slate-600">
            You can connect WhatsApp and Instagram later from Settings. A new connection flow is coming soon.
          </p>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pb-8">
        <button
          type="button"
          onClick={() => router.push("/app/dashboard")}
          className="cursor-pointer border-none bg-transparent p-0 text-sm text-slate-500 transition-colors hover:text-slate-700"
        >
          Skip for now
        </button>
        <Button
          type="primary"
          size="large"
          loading={saving}
          icon={<ArrowRight size={16} />}
          iconPosition="end"
          onClick={() => void handleComplete()}
        >
          Complete Setup
        </Button>
      </div>
    </div>
  );
}
