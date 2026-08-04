"use client";

import type React from "react";

// Channel keys shared by the clinic and super-admin App Connections pages.
export type ChannelKey =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "telegram"
  | "slack"
  | "linkedin";

type BrandGlyph = React.FC<{ size: number }>;

// Inline brand marks in official colours. Vector rather than the 384px PNGs in
// public/ — those are marketing-sized and turn to mush when scaled to 16px.
const BRAND_GLYPHS: Record<ChannelKey, BrandGlyph> = {
  whatsapp: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Z"
        fill="#25D366"
      />
      <path
        d="M9.3 7.2c-.2-.45-.4-.46-.6-.47h-.5c-.18 0-.46.07-.7.33-.24.26-.92.9-.92 2.19 0 1.3.94 2.55 1.07 2.72.13.18 1.82 2.9 4.4 3.96 2.15.88 2.59.7 3.06.66.47-.04 1.5-.62 1.72-1.22.21-.6.21-1.11.15-1.22-.07-.11-.24-.18-.5-.31-.26-.13-1.5-.74-1.73-.83-.24-.09-.41-.13-.58.13-.18.26-.68.85-.83 1.03-.15.18-.3.2-.55.07a6.7 6.7 0 0 1-1.98-1.22 7.4 7.4 0 0 1-1.37-1.7c-.13-.26-.01-.4.11-.53.13-.13.31-.35.46-.53.15-.18.2-.31.3-.51.1-.2.05-.38-.02-.53-.07-.15-.6-1.44-.81-1.96Z"
        fill="#fff"
      />
    </svg>
  ),
  instagram: ({ size }) => {
    // Unique gradient ids per render size keep multiple instances from clashing.
    const id = `ig-grad-${size}`;
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <defs>
          <radialGradient
            id={id}
            gradientUnits="userSpaceOnUse"
            cx="7"
            cy="21"
            r="26"
          >
            <stop offset="0%" stopColor="#FFD776" />
            <stop offset="25%" stopColor="#F5A85F" />
            <stop offset="50%" stopColor="#E85D5D" />
            <stop offset="72%" stopColor="#C13584" />
            <stop offset="100%" stopColor="#7B3FE4" />
          </radialGradient>
        </defs>
        {/* Solid base under the gradient so the mark is never invisible if the
            gradient reference fails to resolve. */}
        <rect x="2" y="2" width="20" height="20" rx="6" fill="#C13584" />
        <rect x="2" y="2" width="20" height="20" rx="6" fill={`url(#${id})`} />
        <circle cx="12" cy="12" r="4.6" stroke="#fff" strokeWidth="1.9" />
        <circle cx="17.4" cy="6.6" r="1.2" fill="#fff" />
      </svg>
    );
  },
  facebook: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#1877F2" />
      <path
        d="M15.9 8.2h-1.6c-.4 0-.7.3-.7.8v1.5h2.2l-.3 2.3h-1.9V22h-2.4v-9.2H9.4v-2.3h1.8V8.7c0-1.8 1.1-2.9 2.9-2.9h1.8v2.4Z"
        fill="#fff"
      />
    </svg>
  ),
  telegram: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#29A9EB" />
      <path
        d="M17.6 7.3 15.7 17c-.14.63-.52.78-1.05.49l-2.9-2.14-1.4 1.35c-.15.15-.28.28-.58.28l.2-2.96 5.4-4.88c.24-.2-.05-.32-.36-.12l-6.67 4.2-2.87-.9c-.62-.2-.64-.63.13-.93l11.2-4.32c.52-.19.97.12.8.9Z"
        fill="#fff"
      />
    </svg>
  ),
  slack: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6.2 14.7a2 2 0 1 1-2-2h2v2Zm1 0a2 2 0 0 1 4 0v5a2 2 0 0 1-4 0v-5Z" fill="#E01E5A" />
      <path d="M9.3 6.2a2 2 0 1 1 2-2v2h-2Zm0 1a2 2 0 0 1 0 4h-5a2 2 0 0 1 0-4h5Z" fill="#36C5F0" />
      <path d="M17.8 9.3a2 2 0 1 1 2 2h-2v-2Zm-1 0a2 2 0 0 1-4 0v-5a2 2 0 0 1 4 0v5Z" fill="#2EB67D" />
      <path d="M14.7 17.8a2 2 0 1 1-2 2v-2h2Zm0-1a2 2 0 0 1 0-4h5a2 2 0 0 1 0 4h-5Z" fill="#ECB22E" />
    </svg>
  ),
  linkedin: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="3" fill="#0A66C2" />
      <path
        d="M7.5 9.5h2.2V18H7.5V9.5Zm1.1-3.4a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM11.3 9.5h2.1v1.2c.4-.7 1.3-1.3 2.5-1.3 1.9 0 2.8 1.2 2.8 3.4V18h-2.2v-4.7c0-1.1-.4-1.8-1.4-1.8-.8 0-1.3.5-1.5 1.1-.1.2-.1.5-.1.8V18h-2.2V9.5Z"
        fill="#fff"
      />
    </svg>
  ),
};

/** Crisp vector brand mark for a channel. */
export function ChannelIcon({ channel, size = 16 }: { channel: ChannelKey; size?: number }) {
  const Glyph = BRAND_GLYPHS[channel];
  if (!Glyph) return null;
  return (
    <span className="inline-flex shrink-0 items-center justify-center">
      <Glyph size={size} />
    </span>
  );
}

/**
 * Tab label with the app's icon beside the text. Returned as a node so it can
 * be handed straight to the `label` of an antd Tabs item.
 */
export function channelTabLabel(channel: ChannelKey, label: string) {
  return (
    <span className="inline-flex items-center gap-2">
      <ChannelIcon channel={channel} />
      {label}
    </span>
  );
}
