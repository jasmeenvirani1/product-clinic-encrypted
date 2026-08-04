"use client";

import Image from "next/image";
import { Facebook, Linkedin, type LucideIcon } from "lucide-react";

// Channel keys shared by the clinic and super-admin App Connections pages.
export type ChannelKey =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "telegram"
  | "slack"
  | "linkedin";

// Brand logo per channel (files live in public/). Only the apps we actually
// ship artwork for appear here — the rest fall back to a lucide glyph below.
const CHANNEL_LOGOS: Partial<Record<ChannelKey, string>> = {
  whatsapp: "/Whatsapp.png",
  instagram: "/Instagram.png",
  telegram: "/Telegram.png",
  slack: "/Slack.png",
};

// Fallback glyphs for channels with no brand PNG in public/.
const CHANNEL_FALLBACK_ICONS: Partial<Record<ChannelKey, LucideIcon>> = {
  facebook: Facebook,
  linkedin: Linkedin,
};

/** Brand mark for a channel — real logo when we have one, glyph otherwise. */
export function ChannelIcon({ channel, size = 16 }: { channel: ChannelKey; size?: number }) {
  const logo = CHANNEL_LOGOS[channel];

  if (logo) {
    return (
      <Image
        src={logo}
        alt=""
        width={size}
        height={size}
        aria-hidden
        className="shrink-0 object-contain"
      />
    );
  }

  const Fallback = CHANNEL_FALLBACK_ICONS[channel];
  if (!Fallback) return null;

  return <Fallback size={size} className="shrink-0" aria-hidden />;
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
