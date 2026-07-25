// ─── App Identity ──────────────────────────────────────────────────────────
export const APP_NAME        = "ClinicFlow";
export const APP_SHORT_NAME  = "CF";
export const APP_FULL_NAME   = "ClinicFlow CRM";
export const APP_NAME_AI     = "ClinicFlow AI";
export const APP_TAGLINE     = "AI-powered multi-tenant CRM for clinics";
export const COPYRIGHT_YEAR  = "2026";

// ─── Brand Colors ──────────────────────────────────────────────────────────

export const COLORS = {
  // Primary sky-blue scale (cold feel)
  primary:       "#0369A1",
  primaryDark:   "#075985",
  primaryHover:  "#0284C7",
  primaryDeep:   "#0c4a6e",
  primaryDeeper: "#082f49",

  // Secondary
  secondary: "#6366F1",

  // Brand surfaces
  brandBg:      "#F8FAFC",
  brandCard:    "#FFFFFF",
  brandBorder:  "#E2E8F0",
  brandHeading: "#0F172A",

  // Text
  textPrimary:   "#0F172A",
  textSecondary: "#4B5F7A",
  textBody:      "#334155",
  textMuted:     "#64748B",
  textMuted2:    "#94a3b8",
  textLink:      "#475569",

  // Semantic
  success:    "#22C55E",
  successBg:  "#ecfdf5",
  warning:    "#F59E0B",
  warningBg:  "#fffbeb",
  error:      "#EF4444",
  errorBg:    "#fee2e2",
  info:       "#0369A1",
  infoBg:     "#f0f9ff",
  infoText:   "#075985",

  // Sidebar (sky-tinted)
  sidebarBg:     "#ffffff",
  sidebarHover:  "#f0f9ff",
  sidebarActive: "#e0f2fe",

  // Table / layout surfaces
  tableHeaderBg:  "#f8fafc",
  tableBorder:    "#e2e8f0",
  tableRowHover:  "#f8fafc",

  // Scrollbar
  scrollbarThumb:      "#cbd5e1",
  scrollbarThumbHover: "#94a3b8",
  scrollbarTrack:      "#f8fafc",

  // Focus / interactive
  inputFocusBorder: "#0369A1",
  selectBorder:     "#E2E8F0",

  // rgba helpers
  primaryGlow:         "rgba(3, 105, 161, 0.12)",
  primaryGlowMd:       "rgba(3, 105, 161, 0.15)",
  primaryGlowStrong:   "rgba(3, 105, 161, 0.32)",
  primaryGlowSubtle:   "rgba(3, 105, 161, 0.06)",
  neutralShadow:       "rgba(15, 23, 42, 0.06)",

  // Social channel colors
  whatsapp:     "#25D366",
  whatsappDark: "#075e54",
  instagram1:   "#F58529",
  instagram2:   "#DD2A7B",
  instagram3:   "#8134AF",
  facebook:     "#1877F2",
  google:       "#4285F4",
} as const;

export type ColorKey = keyof typeof COLORS;
