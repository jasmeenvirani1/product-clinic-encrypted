const fs = require("fs");
const path = require("path");
const log = require("../utils/logger");
const { createOpenAI } = require("../utils/openaiClient");
const { getPlatformOpenAIKey, getPlatformModel, getPlatformBaseURL } = require("../utils/platformAISettings");
const { DEFAULT_COLORS } = require("../controllers/themeController");

const MODULE = "LogoThemeService";

const FALLBACK_PRIMARY = (DEFAULT_COLORS && DEFAULT_COLORS.primary) || "#0369A1";

// Theme keys we suggest from the logo — the full palette EXCEPT the semantic
// status colours (success/warning/error + their backgrounds), which must stay
// fixed so status UI keeps its meaning.
const SUGGESTED_KEYS = [
  "primary", "primaryDark", "primaryHover", "primaryDeep", "primaryDeeper", "secondary",
  "brandBg", "brandCard", "brandBorder", "brandHeading",
  "textPrimary", "textSecondary", "textBody", "textMuted",
  "sidebarBg", "sidebarHover", "sidebarActive",
];

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const isValidHex = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim());
const extractHex = (text) => {
  if (!text) return null;
  const m = text.match(/#[0-9a-fA-F]{6}/);
  return m ? m[0] : null;
};

// ─── Small hex-colour maths (derive a coherent scale from one brand colour) ──
const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
};
const rgbToHex = ({ r, g, b }) => {
  const to2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
};
// amount > 0 lightens toward white, < 0 darkens toward black. |amount| in 0..1
const shade = (hex, amount) => {
  const { r, g, b } = hexToRgb(hex);
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  return rgbToHex({ r: r + (t - r) * p, g: g + (t - g) * p, b: b + (t - b) * p });
};
// A very light tint of the colour, for sidebar hover/active surfaces.
const tint = (hex, amount) => shade(hex, amount); // positive amount → lighter

// Build the full 17-key palette from an AI-chosen primary (+ optional secondary).
// Surfaces/text stay near the safe defaults; only brand/sidebar tints derive
// from the primary so nothing becomes unreadable.
const buildPaletteFromPrimary = (primary, secondary) => {
  const d = DEFAULT_COLORS;
  return {
    primary,
    primaryDark:   shade(primary, -0.22),
    primaryHover:  shade(primary, -0.10),
    primaryDeep:   shade(primary, -0.40),
    primaryDeeper: shade(primary, -0.58),
    secondary: isValidHex(secondary) ? secondary.toUpperCase() : d.secondary,
    // Surfaces / text — keep safe defaults for readability.
    brandBg:       d.brandBg,
    brandCard:     d.brandCard,
    brandBorder:   d.brandBorder,
    brandHeading:  d.brandHeading,
    textPrimary:   d.textPrimary,
    textSecondary: d.textSecondary,
    textBody:      d.textBody,
    textMuted:     d.textMuted,
    // Sidebar — light tints of the brand primary.
    sidebarBg:     d.sidebarBg,
    sidebarHover:  tint(primary, 0.92),
    sidebarActive: tint(primary, 0.85),
  };
};

// The safe fallback palette (default primary → derived set).
const fallbackColors = () => buildPaletteFromPrimary(FALLBACK_PRIMARY, DEFAULT_COLORS.secondary);

/**
 * Analyse a clinic logo and suggest a full theme palette (17 keys, no semantic
 * colours). Uses the platform OpenAI key (registration is pre-tenant-key).
 * Always resolves — never throws.
 *
 * @param {string} logoPath absolute path to the uploaded logo file
 * @returns {Promise<{ suggestedColors: Record<string,string>, suggestedPrimary: string, source: "ai"|"fallback" }>}
 */
const suggestThemeColorFromLogo = async (logoPath) => {
  const fallback = () => ({
    suggestedColors: fallbackColors(),
    suggestedPrimary: FALLBACK_PRIMARY,
    source: "fallback",
  });

  try {
    const apiKey = await getPlatformOpenAIKey();
    if (!apiKey) {
      log.warn(MODULE, "suggestThemeColorFromLogo", { reason: "no platform OpenAI key" });
      return fallback();
    }
    if (!logoPath || !fs.existsSync(logoPath)) {
      log.warn(MODULE, "suggestThemeColorFromLogo", { reason: "logo file missing", logoPath });
      return fallback();
    }

    const ext = path.extname(logoPath).toLowerCase();
    const mime = MIME_BY_EXT[ext] || "image/png";
    const b64 = fs.readFileSync(logoPath).toString("base64");
    const dataUrl = `data:${mime};base64,${b64}`;

    const model = await getPlatformModel();
    const baseUrl = await getPlatformBaseURL();
    const openai = createOpenAI(apiKey, baseUrl);

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a brand designer. From the provided clinic logo, choose two brand colours for a web app theme: " +
            "a PRIMARY (the dominant/most representative colour, adjusted so white text is readable on it) and a SECONDARY accent that complements it. " +
            'Respond with ONLY a JSON object: {"primary":"#RRGGBB","secondary":"#RRGGBB"}. No prose.',
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Suggest the primary and secondary theme colours for this logo." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      // Reasoning models (e.g. minimax-m3) spend tokens "thinking" in a
      // `reasoning` field before emitting the answer — a low cap makes them
      // run out before producing content, so give ample room.
      max_tokens: 800,
      temperature: 0.2,
    });

    const msg = completion.choices?.[0]?.message;
    const asText = (v) => {
      if (!v) return "";
      if (Array.isArray(v)) return v.map((p) => (typeof p === "string" ? p : p?.text || "")).join(" ");
      return typeof v === "string" ? v : "";
    };
    // Combine content + reasoning: some providers (reasoning models) put the
    // final JSON in `content`, but if it was truncated the hex may only appear
    // in `reasoning`. Parsing both maximises the chance of recovering a colour.
    const content = asText(msg?.content).trim();
    const reasoning = asText(msg?.reasoning).trim();
    const raw = [content, reasoning].filter(Boolean).join("\n");

    let primary = null;
    let secondary = null;
    // Prefer a clean JSON object if present anywhere in the text.
    const jsonMatch = raw.match(/\{[^{}]*"primary"[^{}]*\}/i);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (isValidHex(parsed?.primary)) primary = parsed.primary.trim();
        if (isValidHex(parsed?.secondary)) secondary = parsed.secondary.trim();
      } catch { /* fall through to hex scan */ }
    }
    // Otherwise take the first two hex codes found (primary, then secondary).
    if (!primary) {
      const hexes = raw.match(/#[0-9a-fA-F]{6}/g) || [];
      if (hexes[0]) primary = hexes[0];
      if (!secondary && hexes[1]) secondary = hexes[1];
    }

    if (isValidHex(primary)) {
      const suggestedColors = buildPaletteFromPrimary(primary.toUpperCase(), secondary);
      return { suggestedColors, suggestedPrimary: suggestedColors.primary, source: "ai" };
    }

    log.warn(MODULE, "suggestThemeColorFromLogo", {
      reason: "no hex in AI response",
      finish_reason: completion.choices?.[0]?.finish_reason,
      raw: raw.slice(0, 300),
    });

    return fallback();
  } catch (err) {
    log.error(MODULE, "suggestThemeColorFromLogo", { error: err.message });
    return fallback();
  }
};

module.exports = { suggestThemeColorFromLogo, FALLBACK_PRIMARY, SUGGESTED_KEYS };
