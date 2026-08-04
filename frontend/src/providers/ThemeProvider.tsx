"use client";

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { APP_NAME, APP_SHORT_NAME, APP_FULL_NAME, COLORS } from "@/constants/brand";
import { resetThemeVars } from "@/utils/themeVars";
import { isPublicThemeRoute } from "@/utils/themePreload";

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

// useLayoutEffect warns when run during SSR; fall back to useEffect on the server.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
  set("--color-secondary-accent",  c.secondaryAccent);
  set("--color-brand-bg",          c.brandBg);
  set("--color-brand-card",        c.brandCard);
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
  const pathname = usePathname();
  const [colors, setColors]   = useState<ThemeColors>(COLORS);
  const [platformName, setPlatformName]         = useState<string>(APP_NAME);
  const [platformShortName, setPlatformShortName] = useState<string>(APP_SHORT_NAME);
  const [platformFullName, setPlatformFullName]   = useState<string>(APP_FULL_NAME);
  const [loading, setLoading] = useState(true);
  // Gates the very first render: children stay hidden until a theme has been
  // applied, so the page never paints with the wrong palette.
  //
  // Three layers can satisfy this, cheapest first:
  //   1. <style id="server-theme"> inlined by RootLayout — correct palette is in
  //      the initial HTML, so there is nothing to wait for. Start ready.
  //   2. THEME_PRELOAD_SCRIPT — cached tenant theme, applied pre-paint.
  //   3. this provider's fetch — the fallback when neither of the above ran.
  // Only case 3 needs the gate; holding the page in cases 1–2 just delays content.
  // Resolved in a layout effect rather than a lazy initialiser, so the server and
  // the first client render agree (no hydration mismatch) — useLayoutEffect still
  // runs before the browser paints, so the gate lifts without a visible frame.
  const [ready, setReady] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (document.getElementById("server-theme")) setReady(true);
  }, []);

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
  // No-ops on public routes, which must keep showing the platform theme.
  const fetchTenantTheme = useCallback(() => {
    if (isPublicThemeRoute(pathname ?? "/")) return;
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
  }, [applyFetched, pathname]);

  useEffect(() => {
    // Public marketing routes (landing / pricing / demo) always render the
    // super-admin platform theme, even for a logged-in clinic — otherwise the same
    // public page would take on whichever tenant happens to be signed in. So for
    // theming purposes those routes behave exactly like logged-out.
    const publicRoute = isPublicThemeRoute(pathname ?? "/");
    const loggedIn = !!getAuthToken() && !publicRoute;

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
      // Logged out (or on a public route): reset the applied vars to the built-in
      // defaults first, so a tenant's colours never linger, then fall through to
      // fetch the global/super-admin theme below.
      //
      // The cache is only dropped when genuinely logged out. On a public route a
      // signed-in clinic keeps its cached tenant theme, so returning to /app still
      // paints instantly instead of flashing defaults — it just isn't applied here.
      if (!publicRoute) localStorage.removeItem(CACHE_KEY);
      resetThemeVars();
      setColors(COLORS);
      setPlatformName(APP_NAME);
      setPlatformShortName(APP_SHORT_NAME);
      setPlatformFullName(APP_FULL_NAME);
    }

    // 2. Fetch the authoritative theme and apply it:
    //    - public route / logged out → /public/theme = the global platform theme
    //    - logged in                 → /super-admin/theme = the caller's tenant theme
    //
    // The token is deliberately omitted on the public path, so the response can
    // never come back tenant-scoped for a signed-in clinic browsing the landing page.
    const token = loggedIn ? getAuthToken() : null;
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
    // Re-runs on navigation: crossing between a public route and a tenant route
    // must re-resolve which theme applies.
  }, [applyFetched, pathname]);

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
