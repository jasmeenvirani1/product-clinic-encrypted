// Single source of truth for the theme CSS custom properties, so both the
// ThemeProvider (apply) and the auth slice (reset on logout) agree on the list.
export const THEME_VARS = [
  "--color-primary", "--color-primary-rgb", "--color-primary-rgb-space",
  "--color-primary-dark", "--color-primary-dark-rgb", "--color-primary-dark-rgb-space",
  "--color-primary-hover", "--color-primary-deep", "--color-primary-glow",
  "--color-primary-glow-md", "--color-secondary", "--color-secondary-accent",
  "--color-brand-bg", "--color-brand-card",
  "--color-brand-border", "--color-brand-border-alt", "--color-brand-heading",
  "--color-text-body", "--color-text-muted", "--color-sidebar-bg",
  "--color-sidebar-hover", "--color-sidebar-active", "--color-success",
  "--color-warning", "--color-error",
] as const;

// Remove the inline overrides so the :root defaults in globals.css apply again.
export function resetThemeVars() {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  for (const v of THEME_VARS) r.style.removeProperty(v);
}
