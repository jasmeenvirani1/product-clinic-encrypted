"use client";

import { useEffect, useState } from "react";
import { App, Button, Form, Input, InputNumber, Radio, Select, Skeleton, Tabs, Tag } from "antd";
import { Bell, Bot, CheckCircle2, Instagram, Key, Plug, Plus, Save, Timer, Zap } from "lucide-react";
import { PageSection } from "@/components/PageSection";
import { aiSettingService, type AISetting, type UpdateAISettingPayload } from "@/services/aiSetting.service";
import { AppSwitch } from "@/components/ui/AppSwitch";
import { WhatsAppMultiConnect } from "@/components/integrations/WhatsAppMultiConnect";
import { AI_MODEL_OPTIONS, OPENAI_COMPATIBLE_BASE_URL } from "@/constants/aiModels";

// ─── Keyword Manager ────────────────────────────────────────────────
function KeywordManager({
  keywords,
  color,
  onChange,
}: {
  keywords: string[];
  color: string;
  onChange: (_kw: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim().toLowerCase();
    if (v && !keywords.includes(v)) onChange([...keywords, v]);
    setInput("");
  };

  return (
    <div className="space-y-3">
      <div className="flex min-h-[70px] flex-wrap content-start gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        {keywords.map((k) => (
          <Tag key={k} color={color} closable onClose={() => onChange(keywords.filter((x) => x !== k))} className="!m-0 !rounded-full !px-2 !py-0.5 !text-xs">
            {k}
          </Tag>
        ))}
        {keywords.length === 0 && <span className="text-xs text-slate-400 italic">No keywords — add below</span>}
      </div>
      <div className="flex gap-2">
        <Input
          size="small"
          placeholder="Type keyword & press Enter…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={add}
          className="!rounded-lg"
        />
        <Button size="small" icon={<Plus size={12} />} onClick={add} className="!rounded-lg">
          Add
        </Button>
      </div>
    </div>
  );
}

// ─── Intent tier config ─────────────────────────────────────────────
const INTENT_TIERS = [
  {
    key: "high" as const,
    label: "High Intent",
    tagColor: "red",
    desc: "Ready to book · strong buying signals",
    accentBar: "bg-gradient-to-b from-red-400 to-rose-500",
    pillBg: "bg-red-50",
    pillText: "text-red-600",
    dot: "bg-red-500",
  },
  {
    key: "medium" as const,
    label: "Medium Intent",
    tagColor: "orange",
    desc: "Exploring · comparing options",
    accentBar: "bg-gradient-to-b from-orange-400 to-amber-500",
    pillBg: "bg-orange-50",
    pillText: "text-orange-600",
    dot: "bg-orange-500",
  },
  {
    key: "low" as const,
    label: "Low Intent",
    tagColor: "default",
    desc: "Just browsing · casual inquiry",
    accentBar: "bg-gradient-to-b from-slate-300 to-slate-400",
    pillBg: "bg-slate-100",
    pillText: "text-slate-600",
    dot: "bg-slate-400",
  },
] as const;

// ─── Page ───────────────────────────────────────────────────────────
export default function AiChatPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingChannels, setSavingChannels] = useState(false);
  const [settings, setSettings] = useState<AISetting | null>(null);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const [keywords, setKeywords] = useState({ high: [] as string[], medium: [] as string[], low: [] as string[] });
  const [aiRespondsTo, setAiRespondsTo] = useState<string[]>(["low", "medium"]);
  const [emailNotifyFor, setEmailNotifyFor] = useState<string[]>(["high"]);

  // ── Channel toggles ──────────────────────────────────────────────
  const [hasWhatsapp, setHasWhatsapp]         = useState(false);
  const [waEnabled, setWaEnabled]             = useState(false);

  const [hasInstagram, setHasInstagram]       = useState(false);
  const [igEnabled, setIgEnabled]             = useState(false);

  // ── Follow-up settings ───────────────────────────────────────────
  const [followup1Enabled, setFollowup1Enabled] = useState(false);
  const [followup1Days, setFollowup1Days]       = useState(1);
  const [followup2Enabled, setFollowup2Enabled] = useState(false);
  const [followup2Days, setFollowup2Days]       = useState(3);
  const [savingFollowup, setSavingFollowup]     = useState(false);

  useEffect(() => {
    aiSettingService
      .get()
      .then((data) => {
        setSettings(data);
        form.setFieldsValue({
          ai_tone: data.ai_tone,
          // prompt_instructions: data.prompt_instructions, // Hidden for tenant admin — only super admin updates default prompt. Keep for future re-enable.
          escalate_low_confidence: data.escalate_low_confidence,
          openai_model: data.openai_model || "gpt-4o-mini",
          openai_base_url: data.openai_base_url || "",
          notification_email: data.notification_email || "",
        });
        setKeywords({
          high: data.high_intent_keywords || [],
          medium: data.medium_intent_keywords || [],
          low: data.low_intent_keywords || [],
        });
        setAiRespondsTo(data.ai_responds_to_intents || ["low", "medium"]);
        setEmailNotifyFor(data.email_notify_intents || ["high"]);

        // Channel toggles
        const d = data as unknown as Record<string, unknown>;
        setHasWhatsapp(Boolean(d.has_whatsapp));
        setWaEnabled(Boolean(d.whatsapp_enabled ?? d.has_whatsapp));

        setHasInstagram(Boolean(d.has_instagram));
        setIgEnabled(Boolean(d.instagram_enabled ?? d.has_instagram));

        setFollowup1Enabled(Boolean(data.followup_1_enabled));
        setFollowup1Days(data.followup_1_days ?? 1);
        setFollowup2Enabled(Boolean(data.followup_2_enabled));
        setFollowup2Days(data.followup_2_days ?? 3);
      })
      .catch(() => void message.error("Failed to load AI settings."))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveAISettings = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: Record<string, unknown> = {
        ai_tone: values.ai_tone,
        // prompt_instructions: values.prompt_instructions, // Hidden for tenant admin — only super admin updates default prompt. Keep for future re-enable.
        escalate_low_confidence: values.escalate_low_confidence,
        openai_model: values.openai_model,
        openai_base_url: values.openai_base_url || null,
        high_intent_keywords: keywords.high,
        medium_intent_keywords: keywords.medium,
        low_intent_keywords: keywords.low,
        ai_responds_to_intents: aiRespondsTo,
        email_notify_intents: emailNotifyFor,
        notification_email: values.notification_email || null,
      };
      if (values.openai_api_key) payload.openai_api_key = values.openai_api_key;

      const updated = await aiSettingService.update(payload);
      setSettings(updated);
      setShowApiKeyInput(false);
      form.setFieldValue("openai_api_key", "");
      void message.success("AI settings saved!");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      void message.error(msg || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const saveChannelCredentials = async (channel: "whatsapp" | "instagram") => {
    setSavingChannels(true);
    try {
      const payload: Record<string, unknown> = {};
      if (channel === "whatsapp") {
        payload.whatsapp_enabled = waEnabled;
      } else {
        payload.instagram_enabled = igEnabled;
      }
      const updated = await aiSettingService.update(payload as UpdateAISettingPayload);
      const d = updated as unknown as Record<string, unknown>;
      if (channel === "whatsapp") {
        setHasWhatsapp(Boolean(d.has_whatsapp));
        setWaEnabled(Boolean(d.whatsapp_enabled ?? d.has_whatsapp));
      } else {
        setHasInstagram(Boolean(d.has_instagram));
        setIgEnabled(Boolean(d.instagram_enabled ?? d.has_instagram));
      }
      void message.success(`${channel === "whatsapp" ? "WhatsApp" : "Instagram"} settings saved.`);
    } catch {
      void message.error("Failed to save channel settings.");
    } finally {
      setSavingChannels(false);
    }
  };

  // ── Auto-save helper for the Intent Management section ──────────
  // Updates a single field on the AI settings record without forcing
  // the user to click the page-level Save button.
  const autoSaveIntentField = async (
    patch: UpdateAISettingPayload,
    label: string,
  ) => {
    try {
      const updated = await aiSettingService.update(patch);
      setSettings(updated);
      void message.success(`${label} saved.`);
    } catch {
      void message.error(`Failed to save ${label.toLowerCase()}.`);
    }
  };

  const handleSaveFollowup = async () => {
    setSavingFollowup(true);
    try {
      await aiSettingService.update({
        followup_1_enabled: followup1Enabled,
        followup_1_days: followup1Days,
        followup_2_enabled: followup2Enabled,
        followup_2_days: followup2Days,
      });
      void message.success("Follow-up settings saved!");
    } catch {
      void message.error("Failed to save follow-up settings.");
    } finally {
      setSavingFollowup(false);
    }
  };

  const updateKeywords = (intent: "high" | "medium" | "low", kw: string[]) => {
    setKeywords((prev) => ({ ...prev, [intent]: kw }));
    const fieldKey =
      intent === "high"   ? "high_intent_keywords"   :
      intent === "medium" ? "medium_intent_keywords" :
                            "low_intent_keywords";
    void autoSaveIntentField(
      { [fieldKey]: kw } as UpdateAISettingPayload,
      `${intent} intent keywords`,
    );
  };

  // NOTE: side-effects (network + toast) are run OUTSIDE the setState
  // updater so React Strict Mode's double-invoke does not fire the
  // request twice. We compute `next` from current state and call
  // setState with the value, not a function.
  const toggleAiResponds = (intent: string, on: boolean) => {
    const next = on
      ? [...aiRespondsTo, intent]
      : aiRespondsTo.filter((i) => i !== intent);
    setAiRespondsTo(next);
    void autoSaveIntentField(
      { ai_responds_to_intents: next } as UpdateAISettingPayload,
      "AI responds toggle",
    );
  };

  const toggleEmailNotify = (intent: string, on: boolean) => {
    const next = on
      ? [...emailNotifyFor, intent]
      : emailNotifyFor.filter((i) => i !== intent);
    setEmailNotifyFor(next);
    void autoSaveIntentField(
      { email_notify_intents: next } as UpdateAISettingPayload,
      "Email alert toggle",
    );
  };

  if (loading) return <Skeleton active paragraph={{ rows: 14 }} />;

  // ── Tab content ──────────────────────────────────────────────────
  const aiSettingsTab = (
    <Form form={form} layout="vertical" className="crm-form">
      {/* Save button */}
      <div className="mb-4 flex justify-end">
        <Button type="primary" icon={<Save size={15} />} loading={saving} onClick={handleSaveAISettings} size="large">
          Save Settings
        </Button>
      </div>

      {/* Section 1 · AI Configuration */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          {/* OpenAI Setup */}
          <div className="crm-card p-5 space-y-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                <Key size={16} className="text-emerald-600" />
              </span>
              <div>
                <h3 className="text-[14px] font-semibold text-slate-900 leading-tight">OpenAI Integration</h3>
                <p className="text-[11px] text-slate-400">Stored securely · never shown in full</p>
              </div>
            </div>

            {settings?.has_api_key && !showApiKeyInput && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-emerald-700">API Key Connected</p>
                  <p className="text-xs text-emerald-600 font-mono">{settings.openai_api_key_masked}</p>
                </div>
                <Button size="small" onClick={() => setShowApiKeyInput(true)}>Update</Button>
              </div>
            )}
            {!settings?.has_api_key && !showApiKeyInput && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-amber-800">No API Key</p>
                  <p className="text-xs text-amber-600">AI will use fallback responses until configured.</p>
                </div>
                <Button size="small" type="primary" onClick={() => setShowApiKeyInput(true)}>Add Key</Button>
              </div>
            )}
            {showApiKeyInput && (
              <div className="space-y-2">
                <Form.Item name="openai_api_key" label="New API Key" className="!mb-0">
                  <Input.Password placeholder="sk-…" />
                </Form.Item>
                <Button size="small" onClick={() => setShowApiKeyInput(false)}>Cancel</Button>
              </div>
            )}

            <Form.Item name="openai_model" label="Model" className="!mb-0">
              <Select options={AI_MODEL_OPTIONS} />
            </Form.Item>

            <Form.Item
              name="openai_base_url"
              label="OpenAI-compatible Base URL (optional)"
              className="!mb-0"
              extra={`Leave empty for OpenAI. For OpenAI-compatible providers (e.g. MiniMax M3) use ${OPENAI_COMPATIBLE_BASE_URL}`}
            >
              <Input placeholder={OPENAI_COMPATIBLE_BASE_URL} allowClear />
            </Form.Item>
          </div>

          {/* Notification Recipient */}
          <div className="crm-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                <Bell size={16} className="text-blue-500" />
              </span>
              <div>
                <h3 className="text-[14px] font-semibold text-slate-900 leading-tight">Notification Recipient</h3>
                <p className="text-[11px] text-slate-400">Receives email alerts for intent levels configured below</p>
              </div>
            </div>
            <Form.Item
              name="notification_email"
              label="Notification Email"
              rules={[{ type: "email", message: "Enter a valid email address" }]}
              className="!mb-0"
            >
              <Input placeholder="clinic@example.com" prefix={<Bell size={13} className="text-slate-400" />} />
            </Form.Item>
          </div>
        </div>

        {/* AI Behaviour */}
        <div className="crm-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50">
              <Bot size={16} className="text-cyan-600" />
            </span>
            <div>
              <h3 className="text-[14px] font-semibold text-slate-900 leading-tight">AI Behaviour</h3>
              <p className="text-[11px] text-slate-400">Tone, prompt & handover rules</p>
            </div>
          </div>

          {/* System Prompt update is hidden for tenant admin — only super admin can update the default prompt.
              Do NOT delete this block — it may be re-enabled in the future.
          <Form.Item name="prompt_instructions" label="System Prompt" className="!mb-0">
            <Input.TextArea rows={4} placeholder="Describe how the AI should behave with patients…" />
          </Form.Item>
          */}

          <Form.Item name="ai_tone" label="Tone" className="!mb-0">
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              size="small"
              options={[
                { value: "professional", label: "Professional" },
                { value: "warm", label: "Warm" },
                { value: "premium", label: "Premium" },
                { value: "friendly", label: "Friendly" },
                { value: "formal", label: "Formal" },
              ]}
            />
          </Form.Item>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <div>
                <p className="text-[13px] font-medium text-slate-800">Escalate low-confidence replies</p>
                <p className="text-[11px] text-slate-400">Flag to staff when AI confidence is low</p>
              </div>
              <Form.Item name="escalate_low_confidence" valuePropName="checked" noStyle>
                <AppSwitch size="small" />
              </Form.Item>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2 · Intent Management */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500 ring-1 ring-amber-100">
              <Zap size={18} />
            </span>
            <div>
              <h3 className="text-sm font-semibold leading-tight text-slate-900">Intent Management</h3>
              <p className="mt-0.5 text-xs text-slate-500">Build the rules that decide when AI replies, staff steps in, and email alerts fire.</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
            <CheckCircle2 size={12} /> Auto-saves
          </span>
        </div>

        <div className="grid border-b border-slate-200 bg-white sm:grid-cols-3">
          {INTENT_TIERS.map(({ key, label, pillBg, pillText, dot }, index) => (
            <div key={key} className={`px-5 py-4 ${index > 0 ? "border-t border-slate-200 sm:border-l sm:border-t-0" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                  {label}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pillBg} ${pillText}`}>
                  {keywords[key].length} rules
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 p-5 xl:grid-cols-3">
          {INTENT_TIERS.map(({ key, label, tagColor, desc, accentBar, pillBg, pillText, dot }) => {
            const aiOn = aiRespondsTo.includes(key);
            const mailOn = emailNotifyFor.includes(key);
            return (
              <div key={key} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <span className={`absolute inset-x-0 top-0 h-1 ${accentBar}`} />
                <div className="p-4">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${pillBg} ${pillText}`}>
                          {label}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">{desc}</p>
                    </div>
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
                      {keywords[key].length}
                    </span>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-2">
                    <div
                      className={`flex min-h-[64px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                        aiOn ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      <span>
                        <span className="flex items-center gap-1.5 text-xs font-semibold">
                          <Bot size={13} />
                          AI Reply
                        </span>
                        <span className="mt-1 block text-[10px]">{aiOn ? "Enabled" : "Off"}</span>
                      </span>
                      <AppSwitch size="small" checked={aiOn} onChange={(on) => toggleAiResponds(key, on)} />
                    </div>

                    <div
                      className={`flex min-h-[64px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                        mailOn ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      <span>
                        <span className="flex items-center gap-1.5 text-xs font-semibold">
                          <Bell size={13} />
                          Alert
                        </span>
                        <span className="mt-1 block text-[10px]">{mailOn ? "On match" : "Off"}</span>
                      </span>
                      <AppSwitch size="small" checked={mailOn} onChange={(on) => toggleEmailNotify(key, on)} />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Trigger keywords</p>
                    <KeywordManager
                      keywords={keywords[key]}
                      color={tagColor}
                      onChange={(kw) => updateKeywords(key, kw)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3 · Follow-up Messages */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-500 ring-1 ring-violet-100">
              <Timer size={18} />
            </span>
            <div>
              <h3 className="text-sm font-semibold leading-tight text-slate-900">Follow-up Messages</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Automatically send AI-generated follow-ups when a patient goes silent on WhatsApp or Instagram.
              </p>
            </div>
          </div>
          <Button
            type="primary"
            icon={<Save size={14} />}
            loading={savingFollowup}
            onClick={() => void handleSaveFollowup()}
            size="middle"
          >
            Save Follow-ups
          </Button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {/* Follow-up 1 */}
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-400 to-purple-500" />
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Follow-up 1</p>
                  <p className="text-xs text-slate-400 mt-0.5">First outreach after patient goes silent</p>
                </div>
                <AppSwitch
                  size="small"
                  checked={followup1Enabled}
                  onChange={(on) => setFollowup1Enabled(on)}
                />
              </div>
              <div className={followup1Enabled ? "" : "pointer-events-none opacity-40"}>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Send after how many days of silence?
                </label>
                <div className="flex items-center gap-2">
                  <InputNumber
                    min={1}
                    max={30}
                    value={followup1Days}
                    onChange={(v) => setFollowup1Days(v ?? 1)}
                    className="!w-24"
                  />
                  <span className="text-xs text-slate-500">day(s) after last patient message</span>
                </div>
              </div>
              <div className="rounded-lg bg-violet-50/60 px-3 py-2.5 text-[11px] text-violet-700">
                Message is generated by AI at send time — personalised to the conversation.
              </div>
            </div>
          </div>

          {/* Follow-up 2 */}
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-400 to-blue-500" />
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Follow-up 2</p>
                  <p className="text-xs text-slate-400 mt-0.5">Second outreach if still no reply after follow-up 1</p>
                </div>
                <AppSwitch
                  size="small"
                  checked={followup2Enabled}
                  onChange={(on) => setFollowup2Enabled(on)}
                  disabled={!followup1Enabled}
                />
              </div>
              <div className={followup1Enabled && followup2Enabled ? "" : "pointer-events-none opacity-40"}>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Send how many days after follow-up 1?
                </label>
                <div className="flex items-center gap-2">
                  <InputNumber
                    min={1}
                    max={30}
                    value={followup2Days}
                    onChange={(v) => setFollowup2Days(v ?? 3)}
                    className="!w-24"
                  />
                  <span className="text-xs text-slate-500">day(s) after follow-up 1</span>
                </div>
              </div>
              <div className="rounded-lg bg-indigo-50/60 px-3 py-2.5 text-[11px] text-indigo-700">
                Only sent if the patient still hasn&apos;t replied after follow-up 1. Requires follow-up 1 to be enabled.
              </div>
            </div>
          </div>
        </div>
      </div>
    </Form>
  );

  const renderChannelTab = (channel: "whatsapp" | "instagram") => {
    const isWa = channel === "whatsapp";
    const config = isWa
      ? {
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
        }
      : {
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
        };

    // WhatsApp links via QR scan (Baileys) — show the connect widget instead of
    // the generic placeholder. Instagram keeps the "coming soon" placeholder.
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
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{config.title}</h3>
                {config.connected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium ring-1 ring-white/30">
                    <CheckCircle2 size={11} /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium ring-1 ring-white/30">
                    <Plug size={11} /> Not connected
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[13px] text-white/85">{config.subtitle}</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-2 backdrop-blur-sm ring-1 ring-white/30">
              <span className="text-xs font-medium">{config.inboxLabel}</span>
              <AppSwitch checked={config.enabled} onChange={config.setEnabled} />
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

        <div className="flex justify-end">
          <Button
            type="primary"
            size="large"
            icon={<Save size={15} />}
            loading={savingChannels}
            onClick={() => void saveChannelCredentials(channel)}
          >
            Save {isWa ? "WhatsApp" : "Instagram"} Settings
          </Button>
        </div>
      </div>
    );
  };

  const whatsappTab  = renderChannelTab("whatsapp");
  const instagramTab = renderChannelTab("instagram");

  return (
    <div>
      <PageSection
        eyebrow="Clinic CRM"
        title="AI Chat Settings"
        description="Manage AI behaviour, intent rules, and channel integrations in one place."
      />
      <Tabs
        defaultActiveKey="ai"
        items={[
          { key: "ai",        label: "AI Settings",        children: aiSettingsTab },
          { key: "whatsapp",  label: "WhatsApp Settings",  children: whatsappTab },
          { key: "instagram", label: "Instagram Settings", children: instagramTab },
        ]}
      />
    </div>
  );
}
