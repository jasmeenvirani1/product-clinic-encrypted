"use client";

import { useEffect, useState } from "react";
import { App, Button, Form, Input, InputNumber, Select, Switch, Tabs } from "antd";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { PageSection } from "@/components/PageSection";
import { HeroSlider } from "@/components/hero/HeroSlider";
import { heroService, type HeroContent } from "@/services/hero.service";

const { TextArea } = Input;

const EMPTY_MESSAGE = { sender: "user" as const, text: "", time: "", delayMs: 1500 };
const EMPTY_STEP = { order: 0, label: "" };
const EMPTY_BADGE = { label: "", icon: "check" };

export default function HeroContentPage() {
  const { message } = App.useApp();

  const [content, setContent] = useState<HeroContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setContent(await heroService.get());
    } catch {
      void message.error("Failed to load hero content.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Generic helpers to mutate an array field on the content object.
  const patch = (p: Partial<HeroContent>) => setContent((c) => (c ? { ...c, ...p } : c));

  const move = <T,>(arr: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= arr.length) return arr;
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  const save = async () => {
    if (!content) return;
    setSaving(true);
    try {
      const payload = {
        chat_messages: content.chat_messages,
        // re-number steps by their current display order
        workflow_steps: content.workflow_steps.map((s, i) => ({ ...s, order: i + 1 })),
        floating_badges: content.floating_badges,
        typing_speed_ms: content.typing_speed_ms,
        step_interval_ms: content.step_interval_ms,
        is_active: content.is_active,
      };
      const updated = await heroService.update(payload);
      setContent(updated);
      void message.success("Hero content saved.");
    } catch {
      void message.error("Failed to save hero content.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !content) {
    return (
      <div className="p-6">
        <PageSection title="Hero Section" description="Loading…" />
      </div>
    );
  }

  // ── Chat tab ──────────────────────────────────────────────────────────
  const chatTab = (
    <div className="flex flex-col gap-4">
      {content.chat_messages.map((m, i) => (
        <div key={i} className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 p-4">
          <Select
            value={m.sender}
            style={{ width: 130 }}
            onChange={(v) =>
              patch({ chat_messages: content.chat_messages.map((x, j) => (j === i ? { ...x, sender: v } : x)) })
            }
            options={[
              { value: "user", label: "Patient" },
              { value: "assistant", label: "Assistant" },
            ]}
          />
          <TextArea
            value={m.text}
            autoSize={{ minRows: 1, maxRows: 3 }}
            className="flex-1 min-w-[220px]"
            placeholder="Message text"
            onChange={(e) =>
              patch({ chat_messages: content.chat_messages.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })
            }
          />
          <Input
            value={m.time}
            style={{ width: 100 }}
            placeholder="9:02 AM"
            onChange={(e) =>
              patch({ chat_messages: content.chat_messages.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)) })
            }
          />
          <div className="flex items-center gap-1">
            <Button size="small" icon={<ArrowUp size={14} />} disabled={i === 0}
              onClick={() => patch({ chat_messages: move(content.chat_messages, i, i - 1) })} />
            <Button size="small" icon={<ArrowDown size={14} />} disabled={i === content.chat_messages.length - 1}
              onClick={() => patch({ chat_messages: move(content.chat_messages, i, i + 1) })} />
            <Button size="small" danger icon={<Trash2 size={14} />}
              onClick={() => patch({ chat_messages: content.chat_messages.filter((_, j) => j !== i) })} />
          </div>
        </div>
      ))}
      <Button icon={<Plus size={16} />} onClick={() => patch({ chat_messages: [...content.chat_messages, { ...EMPTY_MESSAGE }] })}>
        Add message
      </Button>
    </div>
  );

  // ── Workflow tab ──────────────────────────────────────────────────────
  const workflowTab = (
    <div className="flex flex-col gap-3">
      {content.workflow_steps.map((s, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
          <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-500">
            {i + 1}
          </span>
          <Input
            value={s.label}
            className="flex-1"
            placeholder="Step label"
            onChange={(e) =>
              patch({ workflow_steps: content.workflow_steps.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
            }
          />
          <Button size="small" icon={<ArrowUp size={14} />} disabled={i === 0}
            onClick={() => patch({ workflow_steps: move(content.workflow_steps, i, i - 1) })} />
          <Button size="small" icon={<ArrowDown size={14} />} disabled={i === content.workflow_steps.length - 1}
            onClick={() => patch({ workflow_steps: move(content.workflow_steps, i, i + 1) })} />
          <Button size="small" danger icon={<Trash2 size={14} />}
            onClick={() => patch({ workflow_steps: content.workflow_steps.filter((_, j) => j !== i) })} />
        </div>
      ))}
      <Button icon={<Plus size={16} />} onClick={() => patch({ workflow_steps: [...content.workflow_steps, { ...EMPTY_STEP }] })}>
        Add step
      </Button>
    </div>
  );

  // ── Badges & timing tab ───────────────────────────────────────────────
  const settingsTab = (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Floating badges</h4>
        <div className="flex flex-col gap-3">
          {content.floating_badges.map((b, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <Input
                value={b.label}
                className="flex-1"
                placeholder="Badge label"
                onChange={(e) =>
                  patch({ floating_badges: content.floating_badges.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
                }
              />
              <Select
                value={b.icon}
                style={{ width: 130 }}
                onChange={(v) =>
                  patch({ floating_badges: content.floating_badges.map((x, j) => (j === i ? { ...x, icon: v } : x)) })
                }
                options={[
                  { value: "check", label: "Check" },
                  { value: "rupee", label: "Rupee" },
                ]}
              />
              <Button size="small" danger icon={<Trash2 size={14} />}
                onClick={() => patch({ floating_badges: content.floating_badges.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <Button icon={<Plus size={16} />} onClick={() => patch({ floating_badges: [...content.floating_badges, { ...EMPTY_BADGE }] })}>
            Add badge
          </Button>
        </div>
      </div>

      <Form layout="vertical">
        <Form.Item label="Chat typing speed (ms)">
          <InputNumber value={content.typing_speed_ms} min={400} step={100} style={{ width: 200 }}
            onChange={(v) => patch({ typing_speed_ms: Number(v) || 1200 })} />
        </Form.Item>
        <Form.Item label="Workflow step interval (ms)">
          <InputNumber value={content.step_interval_ms} min={600} step={100} style={{ width: 200 }}
            onChange={(v) => patch({ step_interval_ms: Number(v) || 1500 })} />
        </Form.Item>
        <Form.Item label="Show hero slider on landing page">
          <Switch checked={content.is_active} onChange={(v) => patch({ is_active: v })} />
        </Form.Item>
      </Form>
    </div>
  );

  return (
    <div className="p-6">
      <PageSection
        title="Hero Section"
        description="Manage the landing page hero: the chat animation and the automated workflow list."
        actions={
          <Button type="primary" icon={<Save size={16} />} loading={saving} onClick={() => void save()}>
            Save changes
          </Button>
        }
      />

      <div className="mt-6 grid lg:grid-cols-2 gap-8">
        <Tabs
          items={[
            { key: "chat", label: "Chat", children: chatTab },
            { key: "workflow", label: "Workflow", children: workflowTab },
            { key: "settings", label: "Badges & Timing", children: settingsTab },
          ]}
        />

        {/* Live preview */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">Live preview</div>
          <HeroSlider content={content} />
        </div>
      </div>
    </div>
  );
}
