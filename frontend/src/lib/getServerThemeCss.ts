// Server-side theme resolution for the initial HTML.
//
// The client had two ways to get a theme applied, and both paint *after* the
// document arrives:
//   1. THEME_PRELOAD_SCRIPT — synchronous, but only for logged-in users with a
//      warm cache, and deliberately skipped on public routes.
//   2. ThemeProvider's effect — always a network round-trip after hydration.
//
// So a first-time (or logged-out) visitor to the landing page painted the
// built-in defaults from globals.css until the fetch resolved — the flash.
//
// Fetching the public theme here, in a Server Component, and inlining the CSS
// custom properties into <head> means the correct palette is part of the very
// first byte of HTML. There is nothing left to flash.
//
// Keep the emitted var list in sync with applyToDocument() in ThemeProvider.tsx
// and THEME_PRELOAD_SCRIPT in utils/themePreload.ts.

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type ColorMap = Record<string, string | undefined>;

function hexToRgbStr(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return "0, 0, 0";
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}

function hexToRgbSpaceStr(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return "0 0 0";
  return `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
}

/**
 * Builds a `:root { --var: value; ... }` rule from the public theme.
 * Returns an empty string on any failure, so the page falls back to the
 * defaults already in globals.css rather than rendering unstyled.
 */
export async function getServerThemeCss(): Promise<string> {
  let c: ColorMap;
  try {
    const res = await fetch(`${API_BASE}/public/theme`, { cache: "no-store" });
    if (!res.ok) throw new Error("bad response");
    const json = await res.json();
    c = (json?.data?.colors ?? {}) as ColorMap;
    if (!c || typeof c !== "object") return "";
  } catch {
    return "";
  }

  const decls: string[] = [];
  const set = (prop: string, val: string | undefined) => {
    if (val) decls.push(`${prop}:${val}`);
  };

  set("--color-primary", c.primary);
  set("--color-primary-rgb", c.primary ? hexToRgbStr(c.primary) : undefined);
  set("--color-primary-rgb-space", c.primary ? hexToRgbSpaceStr(c.primary) : undefined);
  set("--color-primary-dark", c.primaryDark);
  set("--color-primary-dark-rgb", c.primaryDark ? hexToRgbStr(c.primaryDark) : undefined);
  set("--color-primary-dark-rgb-space", c.primaryDark ? hexToRgbSpaceStr(c.primaryDark) : undefined);
  set("--color-primary-hover", c.primaryHover);
  set("--color-primary-deep", c.primaryDeep);
  set("--color-primary-glow", c.primary ? `rgba(${hexToRgbStr(c.primary)}, 0.12)` : undefined);
  set("--color-primary-glow-md", c.primary ? `rgba(${hexToRgbStr(c.primary)}, 0.15)` : undefined);
  set("--color-secondary", c.secondary);
  set("--color-secondary-accent", c.secondaryAccent);
  set("--color-brand-bg", c.brandBg);
  set("--color-brand-card", c.brandCard);
  set("--color-brand-border", c.brandBorder);
  set("--color-brand-border-alt", c.brandBorder);
  set("--color-brand-heading", c.brandHeading);
  set("--color-text-body", c.textBody);
  set("--color-text-muted", c.textMuted);
  set("--color-sidebar-bg", c.sidebarBg);
  set("--color-sidebar-hover", c.sidebarHover);
  set("--color-sidebar-active", c.sidebarActive);
  set("--color-success", c.success);
  set("--color-warning", c.warning);
  set("--color-error", c.error);

  if (decls.length === 0) return "";
  return `:root{${decls.join(";")}}`;
}
