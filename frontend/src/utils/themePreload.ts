// Pre-hydration theme script.
//
// This runs SYNCHRONOUSLY in <head>, before the browser paints and before React
// hydrates, so the cached tenant theme is applied to :root immediately. Without
// it, the page paints with the built-in defaults and the real theme "pops in"
// once ThemeProvider's effect + API fetch resolve — the flash we're fixing.
//
// It only applies the cache when logged in (crm_auth_session present), mirroring
// ThemeProvider's rule so a previous tenant's colours never flash on the public
// pages. ThemeProvider remains the source of truth and re-applies/validates the
// authoritative theme right after; this only removes the first-paint flash.
//
// Keep the applied var list in sync with applyToDocument() in ThemeProvider.tsx.

const CACHE_KEY = "crm_theme_v2";
const CACHE_TTL = 10 * 60 * 1000; // 10 min — matches ThemeProvider

// Stringified IIFE injected verbatim into a <script>. It must be dependency-free
// and reference nothing outside its own scope.
export const THEME_PRELOAD_SCRIPT = `(function(){try{
  if(!localStorage.getItem("crm_auth_session"))return;
  var raw=localStorage.getItem(${JSON.stringify(CACHE_KEY)});
  if(!raw)return;
  var parsed=JSON.parse(raw);
  if(!parsed||!parsed.data)return;
  if(Date.now()-parsed.ts>=${CACHE_TTL})return;
  var c=parsed.data,r=document.documentElement;
  function hexRgb(h){var m=/^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(h);return m?parseInt(m[1],16)+", "+parseInt(m[2],16)+", "+parseInt(m[3],16):"0, 0, 0";}
  function hexRgbSp(h){var m=/^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(h);return m?parseInt(m[1],16)+" "+parseInt(m[2],16)+" "+parseInt(m[3],16):"0 0 0";}
  function set(p,v){if(v)r.style.setProperty(p,v);}
  set("--color-primary",c.primary);
  set("--color-primary-rgb",c.primary?hexRgb(c.primary):null);
  set("--color-primary-rgb-space",c.primary?hexRgbSp(c.primary):null);
  set("--color-primary-dark",c.primaryDark);
  set("--color-primary-dark-rgb",c.primaryDark?hexRgb(c.primaryDark):null);
  set("--color-primary-dark-rgb-space",c.primaryDark?hexRgbSp(c.primaryDark):null);
  set("--color-primary-hover",c.primaryHover);
  set("--color-primary-deep",c.primaryDeep);
  set("--color-primary-glow",c.primary?"rgba("+hexRgb(c.primary)+", 0.12)":null);
  set("--color-primary-glow-md",c.primary?"rgba("+hexRgb(c.primary)+", 0.15)":null);
  set("--color-secondary",c.secondary);
  set("--color-brand-bg",c.brandBg);
  set("--color-brand-border",c.brandBorder);
  set("--color-brand-border-alt",c.brandBorder);
  set("--color-brand-heading",c.brandHeading);
  set("--color-text-body",c.textBody);
  set("--color-text-muted",c.textMuted);
  set("--color-sidebar-bg",c.sidebarBg);
  set("--color-sidebar-hover",c.sidebarHover);
  set("--color-sidebar-active",c.sidebarActive);
  set("--color-success",c.success);
  set("--color-warning",c.warning);
  set("--color-error",c.error);
  if(c.platformName){
    window.__PLATFORM_NAME_PRELOAD__={
      platformName:c.platformName,
      platformShortName:c.platformShortName||c.platformName,
      platformFullName:c.platformFullName||c.platformName
    };
  }
}catch(e){}})();`;
