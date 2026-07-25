"use client";

import { MessageCircle, Users, HelpCircle } from "lucide-react";
import type { ReactNode } from "react";

// ── Inline SVG brand icons ────────────────────────────────────────────────────

const WhatsAppIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      fill="#25D366"
      d="M12 0C5.373 0 0 5.373 0 12c0 2.025.503 3.935 1.388 5.608L.05 23.94a.5.5 0 00.617.6l6.504-1.7A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.793 9.793 0 01-5.007-1.376l-.358-.213-3.715.973.99-3.617-.234-.372A9.818 9.818 0 1112 21.818z"
    />
    <path
      fill="#25D366"
      d="M17.472 14.382c-.297-.149-1.758-.867-2.031-.967-.272-.099-.47-.148-.669.15-.198.297-.767.967-.94 1.164-.173.2-.347.224-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.447-.52.148-.174.197-.298.297-.497.1-.198.05-.372-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.372-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.199 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.57-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
    />
  </svg>
);

const InstagramIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <defs>
      <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#F58529" />
        <stop offset="50%" stopColor="#DD2A7B" />
        <stop offset="100%" stopColor="#8134AF" />
      </linearGradient>
    </defs>
    <path
      fill="url(#ig-grad)"
      d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
    />
  </svg>
);

const FacebookIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const GoogleAdsIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

// ── Config map ────────────────────────────────────────────────────────────────

interface SourceConfig {
  icon: (props: { size?: number }) => ReactNode;
  bg: string;
  text: string;
  border: string;
}

const SOURCE_CONFIG: Record<string, SourceConfig> = {
  WhatsApp: {
    icon: WhatsAppIcon,
    bg: "#f0fdf4",
    text: "#15803d",
    border: "#bbf7d0",
  },
  Instagram: {
    icon: InstagramIcon,
    bg: "#fdf4ff",
    text: "#a21caf",
    border: "#f5d0fe",
  },
  Facebook: {
    icon: FacebookIcon,
    bg: "#eff6ff",
    text: "#1d4ed8",
    border: "#bfdbfe",
  },
  "Google Ads": {
    icon: GoogleAdsIcon,
    bg: "#fefce8",
    text: "#a16207",
    border: "#fef08a",
  },
  "Web Chat": {
    icon: ({ size = 14 }) => <MessageCircle size={size} color="#0284c7" />,
    bg: "#f0f9ff",
    text: "#0369a1",
    border: "#bae6fd",
  },
  Referral: {
    icon: ({ size = 14 }) => <Users size={size} color="#7c3aed" />,
    bg: "#f5f3ff",
    text: "#6d28d9",
    border: "#ddd6fe",
  },
  Other: {
    icon: ({ size = 14 }) => <HelpCircle size={size} color="#64748b" />,
    bg: "#f8fafc",
    text: "#475569",
    border: "#e2e8f0",
  },
};

const DEFAULT_CONFIG: SourceConfig = SOURCE_CONFIG.Other;

// ── Exported components ───────────────────────────────────────────────────────

/** Inline icon + label — used inside Select option labels and table cells */
export function SourceLabel({ source, iconSize = 14 }: { source: string; iconSize?: number }) {
  const cfg = SOURCE_CONFIG[source] ?? DEFAULT_CONFIG;
  return (
    <span className="flex items-center gap-1.5">
      {cfg.icon({ size: iconSize })}
      <span>{source}</span>
    </span>
  );
}

/** Styled pill/tag — used in card views */
export function SourceTag({ source }: { source: string }) {
  const cfg = SOURCE_CONFIG[source] ?? DEFAULT_CONFIG;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      {cfg.icon({ size: 12 })}
      {source}
    </span>
  );
}

/** All known source values for the Select dropdown */
export const SOURCE_OPTIONS = [
  "WhatsApp",
  "Instagram",
  "Web Chat",
  "Referral",
  "Google Ads",
  "Facebook",
  "Other",
] as const;

export type SourceOption = (typeof SOURCE_OPTIONS)[number];
