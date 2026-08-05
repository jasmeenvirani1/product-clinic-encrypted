"use client";

import { useEffect, useState } from "react";
import { App, Button, Tabs } from "antd";
import { Instagram, Plug } from "lucide-react";
import { PageSection } from "@/components/PageSection";
import { aiSettingService } from "@/services/aiSetting.service";
import { WhatsAppMultiConnect } from "@/components/integrations/WhatsAppMultiConnect";
import { InstagramConnect } from "@/components/integrations/InstagramConnect";
import { GoogleGlyph, channelTabLabel } from "@/components/integrations/ChannelTabLabel";

// Channels surfaced on the clinic side. Google has no backend support yet, so
// it renders the same "coming soon" placeholder the other pending channels use.
type ClinicChannel = "whatsapp" | "instagram" | "google";

// ─── Page ───────────────────────────────────────────────────────────
export default function ConnectionsPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);

  // ── Channel state (drives the connected pill on each hero) ───────
  const [hasWhatsapp, setHasWhatsapp]   = useState(false);
  const [waEnabled, setWaEnabled]       = useState(false);

  const [hasInstagram, setHasInstagram] = useState(false);
  const [igEnabled, setIgEnabled]       = useState(false);

  useEffect(() => {
    aiSettingService
      .get()
      .then((data) => {
        const d = data as unknown as Record<string, unknown>;
        setHasWhatsapp(Boolean(d.has_whatsapp));
        setWaEnabled(Boolean(d.whatsapp_enabled ?? d.has_whatsapp));

        setHasInstagram(Boolean(d.has_instagram));
        setIgEnabled(Boolean(d.instagram_enabled ?? d.has_instagram));
      })
      .catch(() => void message.error("Failed to load connection settings."))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const renderChannelTab = (channel: ClinicChannel) => {
    const isWa = channel === "whatsapp";

    const configs: Record<ClinicChannel, {
      title: string;
      subtitle: string;
      icon: React.ReactNode;
      gradient: string;
      chipBg: string;
      chipText: string;
      accentText: string;
      tagColor: string;
      inboxLabel: string;
      connected: boolean;
      enabled: boolean;
      setEnabled: (_v: boolean) => void;
    }> = {
      whatsapp: {
        title: "WhatsApp Business",
        subtitle: "Send campaigns & receive messages",
        icon: (
          <svg viewBox="0 0 32 32" width="28" height="28" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 2C8.268 2 2 8.268 2 16c0 2.492.65 4.835 1.788 6.865L2 30l7.335-1.922A13.93 13.93 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 25.6a11.55 11.55 0 0 1-5.89-1.607l-.422-.252-4.352 1.14 1.16-4.24-.276-.435A11.556 11.556 0 0 1 4.4 16C4.4 9.593 9.593 4.4 16 4.4S27.6 9.593 27.6 16 22.407 27.6 16 27.6zm6.34-8.64c-.348-.174-2.06-1.016-2.38-1.132-.32-.116-.552-.174-.784.174-.232.348-.9 1.132-1.103 1.364-.203.232-.406.26-.754.087-.348-.174-1.47-.542-2.8-1.727-1.034-.922-1.732-2.06-1.935-2.408-.203-.348-.022-.536.152-.71.157-.155.348-.406.522-.609.174-.203.232-.348.348-.58.116-.232.058-.435-.029-.609-.087-.174-.784-1.888-1.074-2.587-.283-.68-.57-.587-.784-.598l-.667-.012c-.232 0-.61.087-.928.435-.319.348-1.218 1.19-1.218 2.903s1.247 3.366 1.42 3.598c.174.232 2.453 3.744 5.944 5.25.831.359 1.48.573 1.986.733.834.265 1.594.228 2.194.138.669-.1 2.06-.843 2.351-1.657.29-.813.29-1.51.203-1.657-.087-.145-.319-.232-.667-.406z"/>
          </svg>
        ),
        gradient: "from-emerald-500 via-green-500 to-teal-500",
        chipBg: "bg-emerald-50",
        chipText: "text-emerald-700",
        accentText: "text-emerald-600",
        tagColor: "green",
        inboxLabel: "WhatsApp inbox",
        connected: hasWhatsapp,
        enabled: waEnabled,
        setEnabled: setWaEnabled,
      },
      instagram: {
        title: "Instagram",
        subtitle: "Send campaigns & receive DMs",
        icon: <Instagram size={28} className="text-white" />,
        gradient: "from-pink-500 via-fuchsia-500 to-orange-400",
        chipBg: "bg-pink-50",
        chipText: "text-pink-600",
        accentText: "text-pink-600",
        tagColor: "pink",
        inboxLabel: "Instagram DMs",
        connected: hasInstagram,
        enabled: igEnabled,
        setEnabled: setIgEnabled,
      },
      google: {
        title: "Google",
        subtitle: "Coming soon",
        icon: <GoogleGlyph size={28} className="text-white" />,
        gradient: "from-amber-500 via-red-500 to-blue-600",
        chipBg: "bg-amber-50",
        chipText: "text-amber-700",
        accentText: "text-amber-600",
        tagColor: "gold",
        // Unused for Google — the hero renders no toggle for this channel.
        inboxLabel: "",
        connected: false,
        enabled: false,
        setEnabled: () => {},
      },
    };

    const config = configs[channel];

    // WhatsApp links via QR scan (Baileys) — show the connect widget instead of
    // the generic placeholder.
    if (isWa) {
      return (
        <div className="space-y-5">
          <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${config.gradient} p-6 text-white shadow-sm`}>
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-white/10 blur-xl" />
            <div className="relative flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
                {config.icon}
              </div>
              <div className="flex-1 min-w-[180px]">
                <h3 className="text-lg font-semibold">{config.title}</h3>
                <p className="mt-0.5 text-[13px] text-white/85">
                  Link by QR scan — no Meta API required
                </p>
              </div>
            </div>
          </div>

          <div className="crm-card p-5">
            <WhatsAppMultiConnect conversationsPath="/app/conversations" />
          </div>
        </div>
      );
    }

    // Instagram links via the clinic's own Meta Developer App (manual
    // credentials entry + webhook config) — same connect widget the
    // super-admin page uses. The igEnabled toggle above still gates whether
    // the AI/inbound pipeline treats the channel as live.
    if (channel === "instagram") {
      return (
        <div className="space-y-5">
          <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${config.gradient} p-6 text-white shadow-sm`}>
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-white/10 blur-xl" />
            <div className="relative flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
                {config.icon}
              </div>
              <div className="flex-1 min-w-[180px]">
                <h3 className="text-lg font-semibold">{config.title}</h3>
                <p className="mt-0.5 text-[13px] text-white/85">
                  Connect Instagram using your clinic&apos;s own Meta Developer App
                </p>
              </div>
            </div>
          </div>

          <div className="crm-card p-5">
            <InstagramConnect conversationsPath="/app/conversations" />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {/* Hero header */}
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${config.gradient} p-6 text-white shadow-sm`}>
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-white/10 blur-xl" />
          <div className="relative flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/30">
              {config.icon}
            </div>
            <div className="flex-1 min-w-[180px]">
              <h3 className="text-lg font-semibold">{config.title}</h3>
              <p className="mt-0.5 text-[13px] text-white/85">{config.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Connection placeholder */}
        <div className="crm-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.chipBg}`}>
              <Plug size={16} className={config.accentText} />
            </span>
            <div>
              <h3 className="text-[14px] font-semibold text-slate-900 leading-tight">Connect {config.title}</h3>
              <p className="text-[11px] text-slate-400">A new connection flow is coming soon.</p>
            </div>
          </div>
          <Button type="primary" disabled>Connect {config.title}</Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div>
        <PageSection
          eyebrow="Clinic CRM"
          title="App Connections"
          description="Connect WhatsApp and Instagram to manage conversations from one inbox."
        />
        <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
      </div>
    );
  }

  const whatsappTab  = renderChannelTab("whatsapp");
  const instagramTab = renderChannelTab("instagram");
  const googleTab    = renderChannelTab("google");

  return (
    <div>
      <PageSection
        eyebrow="Clinic CRM"
        title="App Connections"
        description="Connect WhatsApp and Instagram to manage conversations from one inbox."
      />
      <Tabs
        defaultActiveKey="whatsapp"
        items={[
          { key: "whatsapp",  label: channelTabLabel("whatsapp",  "WhatsApp Settings"),  children: whatsappTab },
          { key: "instagram", label: channelTabLabel("instagram", "Instagram Settings"), children: instagramTab },
          { key: "google",    label: channelTabLabel("google",    "Google Settings"),    children: googleTab },
        ]}
      />
    </div>
  );
}
