"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { App, Button, Card, Input, Spin, Tooltip } from "antd";
import { Building2, RefreshCw, Save, RotateCcw } from "lucide-react";
import { PageSection } from "@/components/PageSection";
import { themeService } from "@/services/theme.service";
import { useThemeColors, type ThemeColors } from "@/providers/ThemeProvider";
import { COLORS } from "@/constants/brand";

// ─── Color groups shown in the UI ─────────────────────────────────────────────
const COLOR_GROUPS: Array<{
  label: string;
  keys: Array<{ key: keyof ThemeColors; label: string; desc: string }>;
}> = [
  {
    label: "Primary Brand",
    keys: [
      { key: "primary",      label: "Primary",       desc: "Main accent — buttons, links, active states" },
      { key: "primaryDark",  label: "Primary Dark",  desc: "Hover & pressed variant of primary" },
      { key: "primaryHover", label: "Primary Hover", desc: "Hover colour for interactive elements" },
    ],
  },
  {
    label: "Secondary & Accent",
    keys: [
      { key: "secondary", label: "Secondary", desc: "Badge & tag accent colour" },
    ],
  },
  {
    label: "Surfaces & Borders",
    keys: [
      { key: "brandBg",     label: "Page Background", desc: "Main page / layout background" },
      { key: "brandCard",   label: "Card Background", desc: "Card / panel surface" },
      { key: "brandBorder", label: "Border",           desc: "Dividers and input borders" },
    ],
  },
  {
    label: "Text",
    keys: [
      { key: "brandHeading",  label: "Headings",        desc: "H1–H6 and bold labels" },
      { key: "textPrimary",   label: "Primary Text",    desc: "Main body text" },
      { key: "textSecondary", label: "Secondary Text",  desc: "Subdued labels" },
      { key: "textMuted",     label: "Muted Text",      desc: "Placeholders & hints" },
    ],
  },
  {
    label: "Sidebar",
    keys: [
      { key: "sidebarBg",     label: "Sidebar Background", desc: "Sidebar panel background" },
      { key: "sidebarHover",  label: "Sidebar Hover",      desc: "Menu item hover highlight" },
      { key: "sidebarActive", label: "Sidebar Active",     desc: "Selected menu item background" },
    ],
  },
  {
    label: "Semantic",
    keys: [
      { key: "success",   label: "Success",  desc: "Positive actions & status" },
      { key: "warning",   label: "Warning",  desc: "Cautionary indicators" },
      { key: "error",     label: "Error",    desc: "Destructive / failed states" },
      { key: "successBg", label: "Success Bg", desc: "Success banner / alert background" },
      { key: "warningBg", label: "Warning Bg", desc: "Warning banner background" },
      { key: "errorBg",   label: "Error Bg",   desc: "Error banner background" },
    ],
  },
];

// ─── Single color swatch editor ───────────────────────────────────────────────
function ColorSwatch({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Tooltip title={desc} placement="top">
      <div
        className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-primary transition-colors cursor-pointer group"
        onClick={() => inputRef.current?.click()}
      >
        {/* colour circle */}
        <div
          className="w-9 h-9 rounded-lg border border-slate-200 shadow-sm shrink-0 transition-transform group-hover:scale-105"
          style={{ backgroundColor: value }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 leading-tight">{label}</p>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{value}</p>
        </div>
        {/* hidden native colour picker */}
        <input
          ref={inputRef}
          type="color"
          value={value}
          className="sr-only"
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </Tooltip>
  );
}

export interface ThemeSettingsPanelHandle {
  /** Save whatever is currently pending (colors + platform name, when embedded). */
  save: () => Promise<void>;
  /** Whether there are unsaved changes right now. */
  hasChanges: () => boolean;
  /** Discard any unsaved colors/name draft and revert the live preview. */
  discard: () => void;
}

interface ThemeSettingsPanelProps {
  /**
   * When true, hides this panel's own PageSection header and save/reset/discard
   * actions — the host page owns a single shared header and Save button instead,
   * and drives saving via the forwarded ref. Defaults to false so the existing
   * standalone routes (/app/theme-settings, /super-admin/theme-settings) are
   * unaffected.
   */
  embedded?: boolean;
  /** Only used when embedded — renders a Platform Name field saved together with colors. */
  platformName?: string;
  onPlatformNameChange?: (_value: string) => void;
  /** Only used when embedded — reports live unsaved-changes state to the host. */
  onDirtyChange?: (_dirty: boolean) => void;
}

// ─── Shared panel — rendered by both the super-admin and tenant routes ─────────
export const ThemeSettingsPanel = forwardRef<ThemeSettingsPanelHandle, ThemeSettingsPanelProps>(function ThemeSettingsPanel(
  { embedded = false, platformName, onPlatformNameChange, onDirtyChange },
  ref
) {
  const { message, modal } = App.useApp();
  const { applyColors } = useThemeColors();

  const [draft, setDraft]     = useState<Partial<ThemeColors>>({});
  const [saved, setSaved]     = useState<Partial<ThemeColors>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [nameDraft, setNameDraft] = useState(platformName ?? "");

  // Merge: draft takes priority over saved (which already has COLORS defaults from backend)
  const current: Partial<ThemeColors> = { ...COLORS, ...saved, ...draft };

  useEffect(() => {
    themeService
      .getTheme()
      .then(({ colors }) => setSaved(colors))
      .catch(() => message.error("Failed to load theme."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setNameDraft(platformName ?? "");
  }, [platformName]);

  const setColor = (key: keyof ThemeColors, value: string) => {
    setDraft((p) => ({ ...p, [key]: value }));
    // Live preview
    applyColors({ [key]: value } as Partial<ThemeColors>);
  };

  const nameChanged = embedded && nameDraft.trim() !== (platformName ?? "").trim();
  const hasChanges = Object.keys(draft).length > 0 || nameChanged;

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChanges]);

  const handleSave = async () => {
    if (!hasChanges) {
      message.info("No changes to save.");
      return;
    }
    setSaving(true);
    try {
      const payload: { colors?: Partial<ThemeColors>; platformName?: string } = {};
      if (Object.keys(draft).length > 0) payload.colors = { ...saved, ...draft };
      if (nameChanged) payload.platformName = nameDraft.trim();
      const { colors } = await themeService.updateTheme(payload);
      setSaved(colors);
      setDraft({});
      applyColors(colors);
      if (nameChanged) onPlatformNameChange?.(nameDraft.trim());
      message.success(embedded ? "Platform settings saved successfully!" : "Theme saved successfully!");
    } catch {
      message.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    save: handleSave,
    hasChanges: () => hasChanges,
    discard: () => {
      setDraft({});
      setNameDraft(platformName ?? "");
      applyColors({ ...COLORS, ...saved });
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [hasChanges, draft, nameDraft, saved, platformName]);

  const handleReset = () => {
    modal.confirm({
      title: "Reset to default theme?",
      content: "All colour customisations will be removed and the default brand colours restored.",
      okText: "Reset",
      okButtonProps: { danger: true },
      onOk: async () => {
        setSaving(true);
        try {
          const { colors } = await themeService.resetTheme();
          setSaved(colors);
          setDraft({});
          applyColors(colors);
          message.success("Theme reset to defaults.");
        } catch {
          message.error("Failed to reset theme.");
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const handleDiscard = () => {
    setDraft({});
    setNameDraft(platformName ?? "");
    applyColors({ ...COLORS, ...saved });
    message.info("Changes discarded.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
    );
  }

  return (
    <div>
    {!embedded && (
      <PageSection
        title="Theme Settings"
        description="Customise your workspace colour palette. Changes apply instantly on save."
        helpMenuSlug={false}
        actions={
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button icon={<RefreshCw size={14} />} onClick={handleDiscard}>
                Discard
              </Button>
            )}
            <Button
              danger
              icon={<RotateCcw size={14} />}
              onClick={handleReset}
              loading={saving}
            >
              Reset Defaults
            </Button>
            <Button
              type="primary"
              icon={<Save size={14} />}
              onClick={handleSave}
              loading={saving}
              disabled={!hasChanges}
            >
              Save Theme
            </Button>
          </div>
        }
      />
    )}
      {embedded && (
        <Card size="small" className="mb-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Platform Identity</p>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Platform Name <span className="text-red-500">*</span>
          </label>
          <Input
            prefix={<Building2 size={14} className="text-slate-400" />}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
          />
        </Card>
      )}
      {/* Live preview strip */}
      <Card className="mb-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Live Preview</p>
        <div className="flex flex-wrap gap-3 items-center">
          <Button type="primary" size="small">Primary Button</Button>
          <Button size="small">Default Button</Button>
          <Button type="primary" size="small" danger>Danger Button</Button>
          <span
            className="px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: current.primary }}
          >
            Badge
          </span>
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: current.sidebarActive, color: current.primary }}
          >
            Active Menu
          </span>
          <span className="px-2 py-1 rounded text-xs font-bold" style={{ color: current.success }}>✓ Success</span>
          <span className="px-2 py-1 rounded text-xs font-bold" style={{ color: current.warning }}>⚠ Warning</span>
          <span className="px-2 py-1 rounded text-xs font-bold" style={{ color: current.error }}>✕ Error</span>
        </div>
        <div className="mt-3 h-2 rounded-full" style={{ background: `linear-gradient(to right, ${current.primary}, ${current.secondary})` }} />
      </Card>

      {/* Colour groups */}
      <div className="space-y-6">
        {COLOR_GROUPS.map((group) => (
          <Card key={group.label} title={group.label} size="small">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {group.keys.map(({ key, label, desc }) => (
                <ColorSwatch
                  key={key}
                  label={label}
                  desc={desc}
                  value={(current[key] as string) ?? "#000000"}
                  onChange={(v) => setColor(key, v)}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>

      {!embedded && hasChanges && (
        <div className="sticky bottom-4 mt-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center justify-between shadow-lg">
            <p className="text-sm font-semibold text-amber-700">
              You have unsaved colour changes.
            </p>
            <div className="flex gap-2">
              <Button size="small" onClick={handleDiscard}>Discard</Button>
              <Button type="primary" size="small" icon={<Save size={12} />} onClick={handleSave} loading={saving}>
                Save Theme
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
