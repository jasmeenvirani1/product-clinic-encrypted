import type { PlanFeatureFlags } from "@/utils/types";

// Boolean feature-flag keys, shown as toggles/badges across the plan editor,
// billing plan cards, and the super-admin plans table.
export const BOOLEAN_FEATURE_FIELDS: Array<{ key: keyof PlanFeatureFlags; label: string }> = [
  { key: "whatsapp_multi_connection", label: "Multiple WhatsApp Connections" },
  { key: "chapter_instagram_integration", label: "Chapter & Instagram Integration" },
  { key: "instagram_realtime_fetch", label: "Instagram Real-Time Data Fetch" },
  { key: "chapter_creation", label: "Chapter Creation" },
  { key: "video_like", label: "Video Like Feature" },
  { key: "automatic_website_generation", label: "Automatic Website Generation" },
];

export const CLINIC_PAGE_LABELS: Record<NonNullable<PlanFeatureFlags["dedicated_clinic_page"]>, string> = {
  none: "Not Available",
  video_upload_only: "Video Upload Only",
  full_access: "Full Access",
};
