"use client";

import { Alert, Button, Image, Spin } from "antd";
import Upload from "antd/es/upload";
import { Sparkles, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { authService } from "@/services/auth.service";
import { themeService } from "@/services/theme.service";
import { useThemeColors, type ThemeColors } from "@/providers/ThemeProvider";

const ACCEPTED_LOGO = ".jpg,.jpeg,.png,.webp";
const NEXT_STEP = "/upload-documents";
const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB — matches backend logoUpload limit

// The suggested palette shown for confirmation (semantic status colours are
// intentionally excluded and left at their defaults). Grouped for readability.
const COLOR_GROUPS: { title: string; keys: { key: string; label: string }[] }[] = [
  {
    title: "Primary",
    keys: [
      { key: "primary", label: "Primary" },
      { key: "primaryHover", label: "Hover" },
      { key: "primaryDark", label: "Dark" },
      { key: "primaryDeep", label: "Deep" },
      { key: "primaryDeeper", label: "Deeper" },
      { key: "secondary", label: "Secondary" },
    ],
  },
  {
    title: "Surfaces",
    keys: [
      { key: "brandBg", label: "Background" },
      { key: "brandCard", label: "Card" },
      { key: "brandBorder", label: "Border" },
      { key: "brandHeading", label: "Heading" },
    ],
  },
  {
    title: "Text",
    keys: [
      { key: "textPrimary", label: "Primary" },
      { key: "textSecondary", label: "Secondary" },
      { key: "textBody", label: "Body" },
      { key: "textMuted", label: "Muted" },
    ],
  },
  {
    title: "Sidebar",
    keys: [
      { key: "sidebarBg", label: "Background" },
      { key: "sidebarHover", label: "Hover" },
      { key: "sidebarActive", label: "Active" },
    ],
  },
];

export default function BrandSetupPage() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const { applyColors } = useThemeColors();

  // Keep the RAW File — antd strips originFileObj when beforeUpload returns false,
  // so we capture the File ourselves in beforeUpload instead of from onChange.
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [suggestedColors, setSuggestedColors] = useState<Record<string, string> | null>(null);
  const [source, setSource] = useState<"ai" | "fallback" | null>(null);

  const goNext = () => router.push(NEXT_STEP);

  // Capture the file directly. Return false so antd never auto-uploads; we
  // handle the request manually in handleAnalyze.
  const handleBeforeUpload = (selected: File): boolean => {
    setError(null);
    setSuggestedColors(null);
    setSource(null);

    if (selected.size > MAX_LOGO_BYTES) {
      setError("Logo is too large. Max size is 5 MB.");
      return false;
    }

    setFile(selected);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(selected));
    return false;
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setSuggestedColors(null);
    setSource(null);
    setError(null);
  };

  // Upload the logo → backend saves it + returns a full suggested palette.
  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await authService.brandSetupUploadLogo(file);
      setSuggestedColors(res.suggestedColors);
      setSource(res.source);
    } catch {
      setError("Could not analyze the logo. You can continue with the default theme.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Apply the full suggested palette via the existing theme pipeline, then continue.
  const handleApply = async () => {
    if (!suggestedColors) return;
    setApplying(true);
    setError(null);
    try {
      const override = suggestedColors as Partial<ThemeColors>;
      await themeService.updateTheme(override);
      applyColors(override); // live, instant paint
      goNext();
    } catch {
      setError("Failed to apply the theme. Please try again or keep the default.");
    } finally {
      setApplying(false);
    }
  };

  if (!user) {
    return (
      <div>
        <Alert
          type="warning"
          showIcon
          message="Your session has expired. Please register again."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-900">Set up your brand</h2>
        <p className="text-sm text-slate-500">
          Upload your clinic logo and we&apos;ll suggest a matching theme colour. You can apply it
          or keep the default — you can always change it later.
        </p>
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <div className="space-y-4">
        {/* Logo field: label + hint grouped, then the dropzone */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-slate-800">Clinic Logo (optional)</span>
            <span className="text-xs text-slate-400">JPG, PNG, WEBP · Max 5 MB</span>
          </div>

          {!file ? (
            <Upload.Dragger
              fileList={[]}
              beforeUpload={handleBeforeUpload}
              accept={ACCEPTED_LOGO}
              maxCount={1}
              showUploadList={false}
              className="!rounded-2xl !border-slate-300 !bg-slate-50/70"
            >
              <div className="flex flex-col items-center justify-center gap-2 py-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-primary">
                  <UploadCloud size={18} />
                </div>
                <p className="text-sm font-semibold text-slate-800">Drag &amp; drop your logo</p>
                <p className="text-xs text-slate-500">or click to browse</p>
              </div>
            </Upload.Dragger>
          ) : (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <Button
                type="default"
                size="small"
                icon={<X size={14} />}
                onClick={clearFile}
                aria-label="Remove logo"
                className="absolute right-2 top-2 z-10"
              />
              <div className="flex h-32 w-full items-center justify-center bg-slate-50 p-4">
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt="Logo preview"
                    height={104}
                    style={{ objectFit: "contain" }}
                    preview={false}
                  />
                ) : null}
              </div>
              <div className="truncate border-t border-slate-100 px-3 py-2 text-sm font-medium text-slate-900">
                {file.name}
              </div>
            </div>
          )}
        </div>

        {/* Analyze / suggestion area */}
        {file && !suggestedColors ? (
          <Button
            type="default"
            block
            size="large"
            icon={<Sparkles size={16} />}
            loading={analyzing}
            onClick={handleAnalyze}
          >
            {analyzing ? "Analyzing logo…" : "Suggest a theme colour"}
          </Button>
        ) : null}

        {analyzing ? (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Spin size="small" /> Reading your logo…
          </div>
        ) : null}

        {suggestedColors ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-800">
              {source === "ai" ? "Suggested theme" : "Recommended theme"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {source === "fallback"
                ? "We couldn't read colours from your logo, so here's our default theme."
                : "Based on your logo. Status colours (success/warning/error) stay unchanged."}
            </p>

            <div className="mt-4 space-y-4">
              {COLOR_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {group.title}
                  </p>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {group.keys.map(({ key, label }) => {
                      const hex = suggestedColors[key];
                      if (!hex) return null;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span
                            className="inline-block h-8 w-8 shrink-0 rounded-md border border-slate-200 shadow-sm"
                            style={{ backgroundColor: hex }}
                            aria-hidden
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-700">{label}</p>
                            <p className="truncate font-mono text-[10px] text-slate-400">{hex}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                type="primary"
                size="large"
                loading={applying}
                onClick={handleApply}
                className="flex-1"
              >
                Apply this theme
              </Button>
              <Button
                type="default"
                size="large"
                disabled={applying}
                onClick={goNext}
                className="flex-1"
              >
                Keep default &amp; continue
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Skip entirely (no logo) */}
      {!suggestedColors ? (
        <p className="text-center text-sm text-slate-500">
          <button
            type="button"
            onClick={goNext}
            className="auth-link bg-transparent border-none cursor-pointer p-0"
          >
            Skip for now
          </button>
        </p>
      ) : null}
    </div>
  );
}
