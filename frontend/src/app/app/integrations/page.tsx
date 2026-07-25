"use client";

import { useEffect, useState } from "react";
import { App, Button, Card, Tag } from "antd";
import { MessageCircle, Instagram, Globe } from "lucide-react";
import { PageSection } from "@/components/PageSection";
import { aiSettingService } from "@/services/aiSetting.service";
import { AppSwitch } from "@/components/ui/AppSwitch";
import { WhatsAppMultiConnect } from "@/components/integrations/WhatsAppMultiConnect";

export default function IntegrationsPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Channel enablement (Meta credential fields removed — new connection flow pending)
  const [waEnabled, setWaEnabled] = useState(false);
  const [igEnabled, setIgEnabled] = useState(false);
  const [hasWhatsapp, setHasWhatsapp] = useState(false);
  const [hasInstagram, setHasInstagram] = useState(false);

  useEffect(() => {
    aiSettingService.get()
      .then((s) => {
        const data = s as any;
        setWaEnabled(data.whatsapp_enabled ?? false);
        setIgEnabled(data.instagram_enabled ?? false);
        setHasWhatsapp(data.has_whatsapp ?? false);
        setHasInstagram(data.has_instagram ?? false);
      })
      .catch(() => void message.error("Failed to load integration settings."))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await aiSettingService.update({
        whatsapp_enabled: waEnabled,
        instagram_enabled: igEnabled,
      } as any);
      const data = updated as any;
      setHasWhatsapp(data.has_whatsapp ?? false);
      setHasInstagram(data.has_instagram ?? false);
      void message.success("Integration settings saved.");
    } catch {
      void message.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="">
        <PageSection eyebrow="Clinic CRM" title="Integrations" description="Manage WhatsApp, Instagram, and web chat connectivity." />
        <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="">
      <PageSection
        eyebrow="Clinic CRM"
        title="Integrations"
        description="Manage WhatsApp, Instagram, and web chat connectivity."
      />

      <div className="grid gap-6 xl:grid-cols-2">

        {/* WhatsApp */}
        <Card className="crm-card">
          <div className="flex items-center gap-3 mb-5">
            <div className="rounded-xl bg-green-50 p-2.5">
              <MessageCircle size={20} className="text-green-600" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">WhatsApp Business</h3>
              <p className="text-xs text-slate-400">Send campaigns &amp; receive messages</p>
            </div>
            {hasWhatsapp
              ? <Tag color="green" className="ml-auto">Connected</Tag>
              : <Tag className="ml-auto">Not connected</Tag>
            }
          </div>

          <WhatsAppMultiConnect conversationsPath="/app/conversations" />
        </Card>

        {/* Instagram */}
        <Card className="crm-card">
          <div className="flex items-center gap-3 mb-5">
            <div className="rounded-xl bg-pink-50 p-2.5">
              <Instagram size={20} className="text-pink-500" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">Instagram</h3>
              <p className="text-xs text-slate-400">Send campaigns &amp; receive DMs</p>
            </div>
            {hasInstagram
              ? <Tag color="pink" className="ml-auto">Connected</Tag>
              : <Tag className="ml-auto">Not connected</Tag>
            }
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            A new Instagram connection flow is coming soon. Once available, you&apos;ll be able to connect
            your Instagram account here.
            <div className="mt-4">
              <Button type="primary" disabled>Connect Instagram</Button>
            </div>
          </div>
        </Card>

      </div>

      {/* Channel toggles */}
      <Card className="crm-card">
        <h3 className="text-[15px] font-semibold text-slate-900 mb-1">Channel toggles</h3>
        <p className="text-xs text-slate-400 mb-4">Enable or disable each channel for incoming conversations.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <MessageCircle size={15} className="text-green-600" />
              <span className="text-sm font-medium text-slate-700">WhatsApp inbox</span>
            </div>
            <AppSwitch checked={waEnabled} onChange={setWaEnabled} />
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <Instagram size={15} className="text-pink-500" />
              <span className="text-sm font-medium text-slate-700">Instagram DMs</span>
            </div>
            <AppSwitch checked={igEnabled} onChange={setIgEnabled} />
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <Globe size={15} className="text-blue-500" />
              <span className="text-sm font-medium text-slate-700">Web chat widget</span>
            </div>
            <AppSwitch />
          </div>
        </div>
      </Card>

      <Button type="primary" size="large" loading={saving} onClick={() => void handleSave()}>
        Save Integrations
      </Button>
    </div>
  );
}
