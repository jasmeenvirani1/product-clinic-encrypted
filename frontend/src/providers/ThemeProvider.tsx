"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { APP_NAME, APP_SHORT_NAME, APP_FULL_NAME, COLORS } from "@/constants/brand";
import { resetThemeVars } from "@/utils/themeVars";

export type ThemeColors = typeof COLORS;

interface ThemeContextValue {
  colors: ThemeColors;
  applyColors: (partial: Partial<ThemeColors>) => void;
  /** Platform name — falls back to the static APP_NAME default until resolved. */
  platformName: string;
  platformShortName: string;
  platformFullName: string;
  /** Re-fetch the authenticated tenant theme (call right after login). */
  refreshTheme: () => void;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: COLORS,
  applyColors: () => {},
  platformName: APP_NAME,
  platformShortName: APP_SHORT_NAME,
  platformFullName: APP_FULL_NAME,
  refreshTheme: () => {},
  loading: true,
});

export const useThemeColors = () => useContext(ThemeContext);

// ─── hex → "r, g, b" for rgba() usage ───────────────────────────────
function hexToRgbStr(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return "0, 0, 0";
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}

// ─── hex → "r g b" (space-separated) for Tailwind CSS var opacity ────
function hexToRgbSpaceStr(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return "0 0 0";
  return `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
}

// ─── Write colors into CSS custom properties ─────────────────────────
function applyToDocument(c: Partial<ThemeColors>) {
  if (typeof document === "undefined") return;
  const r = document.documentElement;

  const set = (prop: string, val: string | undefined) => {
    if (val) r.style.setProperty(prop, val);
  };

  set("--color-primary",              c.primary);
  set("--color-primary-rgb",          c.primary     ? hexToRgbStr(c.primary)      : undefined);
  set("--color-primary-rgb-space",    c.primary     ? hexToRgbSpaceStr(c.primary) : undefined);
  set("--color-primary-dark",         c.primaryDark);
  set("--color-primary-dark-rgb",     c.primaryDark ? hexToRgbStr(c.primaryDark)  : undefined);
  set("--color-primary-dark-rgb-space", c.primaryDark ? hexToRgbSpaceStr(c.primaryDark) : undefined);
  set("--color-primary-hover",     c.primaryHover);
  set("--color-primary-deep",      c.primaryDeep);
  set("--color-primary-glow",      c.primary
    ? `rgba(${hexToRgbStr(c.primary)}, 0.12)`
    : undefined);
  set("--color-primary-glow-md",   c.primary
    ? `rgba(${hexToRgbStr(c.primary)}, 0.15)`
    : undefined);
  set("--color-secondary",         c.secondary);
  set("--color-brand-bg",          c.brandBg);
  set("--color-brand-border",      c.brandBorder);
  set("--color-brand-border-alt",  c.brandBorder);
  set("--color-brand-heading",     c.brandHeading);
  set("--color-text-body",         c.textBody);
  set("--color-text-muted",        c.textMuted);
  set("--color-sidebar-bg",        c.sidebarBg);
  set("--color-sidebar-hover",     c.sidebarHover);
  set("--color-sidebar-active",    c.sidebarActive);
  set("--color-success",           c.success);
  set("--color-warning",           c.warning);
  set("--color-error",             c.error);
}

const CACHE_KEY = "crm_theme_v2";
const CACHE_TTL = 10 * 60 * 1000; // 10 min
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// Read the JWT the API client stores, so we can fetch the tenant-scoped theme.
function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem("crm_auth_session");
    if (!raw) return null;
    const { token } = JSON.parse(raw) as { token?: string };
    return token ?? null;
  } catch {
    return null;
  }
}

interface PlatformNameFields {
  platformName: string;
  platformShortName: string;
  platformFullName: string;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colors, setColors]   = useState<ThemeColors>(COLORS);
  const [platformName, setPlatformName]         = useState<string>(APP_NAME);
  const [platformShortName, setPlatformShortName] = useState<string>(APP_SHORT_NAME);
  const [platformFullName, setPlatformFullName]   = useState<string>(APP_FULL_NAME);
  const [loading, setLoading] = useState(true);
  // Gates the very first render: children are not shown until the authoritative
  // theme has been applied, so the page never paints with the wrong theme while
  // the theme API is still loading. The inline <head> script handles the cached
  // (returning-user) case; this handles the no-cache / first-load case.
  const [ready, setReady] = useState(false);

  // Apply a fetched palette (+ platform name fields). `cache` controls whether
  // it's written to the instant-paint cache — only the tenant (logged-in) theme
  // is cached, so the public/global theme can never flash in on a later
  // logged-in load.
  const applyFetched = useCallback((incoming: Partial<ThemeColors> & Partial<PlatformNameFields>, cache = true) => {
    const merged = { ...COLORS, ...incoming } as ThemeColors;
    setColors(merged);
    applyToDocument(merged);
    if (incoming.platformName) setPlatformName(incoming.platformName);
    if (incoming.platformShortName) setPlatformShortName(incoming.platformShortName);
    if (incoming.platformFullName) setPlatformFullName(incoming.platformFullName);
    if (cache) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: incoming, ts: Date.now() }));
    }
  }, []);

  // Fetch the authenticated tenant theme (falls back silently if logged out).
  const fetchTenantTheme = useCallback(() => {
    const token = getAuthToken();
    if (!token) return;
    fetch(`${API_BASE}/super-admin/theme`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.success && json.data?.colors) {
          applyFetched({
            ...json.data.colors,
            platformName: json.data.platformName,
            platformShortName: json.data.platformShortName,
            platformFullName: json.data.platformFullName,
          });
        }
      })
      .catch(() => { /* keep whatever is applied */ });
  }, [applyFetched]);

  useEffect(() => {
    const loggedIn = !!getAuthToken();

    // 1. Paint instantly from cache — but ONLY when logged in. The cache always
    //    holds the last-applied (tenant) theme, so reusing it while logged out
    //    would flash the previous tenant's colours on the login page.
    if (loggedIn) {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const { data, ts } = JSON.parse(raw) as {
            data: Partial<ThemeColors> & Partial<PlatformNameFields>;
            ts: number;
          };
          if (Date.now() - ts < CACHE_TTL && data) {
            const merged = { ...COLORS, ...data };
            setColors(merged);
            applyToDocument(merged);
            if (data.platformName) setPlatformName(data.platformName);
            if (data.platformShortName) setPlatformShortName(data.platformShortName);
            if (data.platformFullName) setPlatformFullName(data.platformFullName);
            setLoading(false);
          }
        }
      } catch { /* ignore */ }
    } else {
      // Logged out: reset the applied vars to the built-in defaults first (so a
      // previous tenant's colours never linger), then fall through to fetch the
      // global/super-admin theme below. The tenant cache is dropped so it can't
      // flash in — the login/landing/register pages show the platform theme.
      localStorage.removeItem(CACHE_KEY);
      resetThemeVars();
      setColors(COLORS);
      setPlatformName(APP_NAME);
      setPlatformShortName(APP_SHORT_NAME);
      setPlatformFullName(APP_FULL_NAME);
    }

    // 2. Fetch the authoritative theme and apply it:
    //    - logged out → /public/theme = the global/super-admin platform theme
    //    - logged in  → /super-admin/theme = the caller's tenant theme
    const token = getAuthToken();
    const endpoint = loggedIn ? `${API_BASE}/super-admin/theme` : `${API_BASE}/public/theme`;
    fetch(endpoint, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        // Cache only the tenant theme (logged in); never the public/global one.
        if (json?.success && json.data?.colors) {
          applyFetched(
            {
              ...json.data.colors,
              platformName: json.data.platformName,
              platformShortName: json.data.platformShortName,
              platformFullName: json.data.platformFullName,
            },
            loggedIn,
          );
        }
      })
      .catch(() => { /* keep whatever is applied */ })
      .finally(() => {
        setLoading(false);
        // Authoritative theme applied (or failed → defaults kept): reveal the page.
        setReady(true);
      });
  }, [applyFetched]);

  const applyColors = useCallback((partial: Partial<ThemeColors>) => {
    setColors((prev) => {
      const merged = { ...prev, ...partial };
      applyToDocument(merged);
      return merged;
    });
    // Invalidate cache so next page load refetches
    localStorage.removeItem(CACHE_KEY);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        colors,
        applyColors,
        platformName,
        platformShortName,
        platformFullName,
        refreshTheme: fetchTenantTheme,
        loading,
      }}
    >
      {/* Hold the page hidden (not unmounted) until the theme is applied, so it
          never flashes the wrong theme. When visible the wrapper is layout-
          transparent (display:contents) so full-height layouts are unaffected;
          only the first paint is deferred by a single network round-trip. */}
      <div style={ready ? { display: "contents" } : { visibility: "hidden" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
