const { ThemeSetting } = require("../models");

const DEFAULT_COLORS = {
  primary:       "#0369A1",
  primaryDark:   "#075985",
  primaryHover:  "#0284C7",
  primaryDeep:   "#0c4a6e",
  primaryDeeper: "#082f49",
  secondary:     "#6366F1",
  brandBg:       "#F8FAFC",
  brandCard:     "#FFFFFF",
  brandBorder:   "#E2E8F0",
  brandHeading:  "#0F172A",
  textPrimary:   "#0F172A",
  textSecondary: "#4B5F7A",
  textBody:      "#334155",
  textMuted:     "#64748B",
  sidebarBg:     "#ffffff",
  sidebarHover:  "#f0f9ff",
  sidebarActive: "#e0f2fe",
  success:       "#22C55E",
  successBg:     "#ecfdf5",
  warning:       "#F59E0B",
  warningBg:     "#fffbeb",
  error:         "#EF4444",
  errorBg:       "#fee2e2",
};

// Which theme row a request targets:
//  - super_admin  → the global/platform row (tenant_id = null). Their edits are
//    the platform theme served to logged-out pages (landing/login/register) and
//    inherited by tenants.
//  - tenant owner → their own id IS the tenant id (they have tenant_id = null).
//  - staff        → inherit their owner's tenant_id.
function resolveTenantId(req) {
  const u = req.user || {};
  if (u.Role && u.Role.name === "super_admin") return null;
  return u.tenant_id || u.id || null;
}

// Find-or-create the theme row for a given tenant (null = global/platform row).
async function getOrCreate(tenantId) {
  const [setting] = await ThemeSetting.findOrCreate({
    where: { tenant_id: tenantId ?? null },
    defaults: { tenant_id: tenantId ?? null, colors: {} },
  });
  return setting;
}

// The global (platform) theme row — the base every tenant inherits from.
async function getGlobalColors() {
  const global = await getOrCreate(null);
  return global.colors || {};
}

// Effective palette for a tenant: defaults → global overrides → tenant overrides.
async function resolveColors(tenantId) {
  const globalColors = await getGlobalColors();
  if (tenantId == null) {
    return { ...DEFAULT_COLORS, ...globalColors };
  }
  const tenant = await getOrCreate(tenantId);
  return { ...DEFAULT_COLORS, ...globalColors, ...(tenant.colors || {}) };
}

exports.DEFAULT_COLORS = DEFAULT_COLORS;

// Authenticated: return the effective (merged) palette for the caller's tenant.
exports.getTheme = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const colors = await resolveColors(tenantId);
    return res.json({ success: true, data: { colors } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Public (pre-login): always serve the global/platform theme only.
exports.getPublicTheme = async (req, res) => {
  try {
    const colors = await resolveColors(null);
    return res.json({ success: true, data: { colors } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Authenticated: save overrides onto the caller's own tenant row.
exports.updateTheme = async (req, res) => {
  try {
    const { colors } = req.body;
    if (!colors || typeof colors !== "object") {
      return res.status(400).json({ success: false, message: "colors object required." });
    }
    const tenantId = resolveTenantId(req);
    const setting = await getOrCreate(tenantId);
    setting.colors = { ...setting.colors, ...colors };
    await setting.save();
    // Return the effective merged palette so the client reflects inheritance too.
    const merged = await resolveColors(tenantId);
    return res.json({ success: true, data: { colors: merged } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Authenticated: clear the caller's tenant overrides → falls back to global/defaults.
exports.resetTheme = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const setting = await getOrCreate(tenantId);
    setting.colors = {};
    await setting.save();
    const merged = await resolveColors(tenantId);
    return res.json({ success: true, data: { colors: merged } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
