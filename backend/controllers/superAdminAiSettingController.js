const { PlatformAISetting, AISetting, User, InstagramSession } = require("../models");
const log = require("../utils/logger");
const { invalidatePlatformAICache } = require("../utils/platformAISettings");
const { resolveBaseUrlForModel } = require("./aiModelController");

const MODULE = "SuperAdminAiSettingController";

const maskKey = (key) => {
  if (!key) return null;
  if (key.length <= 8) return "••••••••";
  return "••••••••••••" + key.slice(-4);
};

// ─── Get or create the singleton platform defaults ───────────────────
exports.getDefaults = async (req, res) => {
  try {
    let [setting] = await PlatformAISetting.findOrCreate({
      where: { id: 1 },
      defaults: { id: 1 },
    });
    // Never send the raw platform OpenAI key to the client — mask it and
    // expose a boolean the UI can use to show "configured" state.
    const data = {
      ...setting.toJSON(),
      platform_openai_api_key: maskKey(setting.platform_openai_api_key),
      has_platform_openai_api_key: !!setting.platform_openai_api_key,
    };
    log.info(MODULE, "getDefaults", { userId: req.user.id });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    log.error(MODULE, "getDefaults", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Update platform defaults ────────────────────────────────────────
exports.updateDefaults = async (req, res) => {
  try {
    let [setting] = await PlatformAISetting.findOrCreate({
      where: { id: 1 },
      defaults: { id: 1 },
    });

    const {
      default_openai_model,
      default_openai_base_url,
      default_prompt_instructions,
      self_chat_prompt,
      default_ai_tone,
      allow_tenant_model_change,
      use_cases,
      platform_openai_api_key,
    } = req.body;

    if (default_openai_model !== undefined) {
      setting.default_openai_model = default_openai_model;
      // Resolve the base URL from the selected model in the AI-models master
      // instead of a hand-typed field.
      const resolved = await resolveBaseUrlForModel(default_openai_model);
      if (resolved !== undefined) setting.default_openai_base_url = resolved;
    }
    // Backward-compat: still honour an explicit base_url if a caller sends one.
    if (default_openai_base_url !== undefined) setting.default_openai_base_url = default_openai_base_url;
    if (default_prompt_instructions !== undefined) setting.default_prompt_instructions = default_prompt_instructions;
    if (self_chat_prompt !== undefined) setting.self_chat_prompt = self_chat_prompt;
    if (default_ai_tone !== undefined) setting.default_ai_tone = default_ai_tone;
    if (allow_tenant_model_change !== undefined) setting.allow_tenant_model_change = allow_tenant_model_change;
    if (use_cases !== undefined) setting.use_cases = use_cases;
    // Only overwrite the key when a real value is sent. The GET returns a masked
    // key (••••1234), so ignore blank strings and masked values to avoid clobbering
    // the stored key when the form is saved without re-entering it.
    if (
      platform_openai_api_key !== undefined &&
      platform_openai_api_key !== "" &&
      !platform_openai_api_key.includes("•")
    ) {
      setting.platform_openai_api_key = platform_openai_api_key;
    }

    await setting.save();
    invalidatePlatformAICache();
    log.info(MODULE, "updateDefaults", { userId: req.user.id });
    const data = {
      ...setting.toJSON(),
      platform_openai_api_key: maskKey(setting.platform_openai_api_key),
      has_platform_openai_api_key: !!setting.platform_openai_api_key,
    };
    return res.status(200).json({ success: true, message: "Platform AI settings updated.", data });
  } catch (err) {
    log.error(MODULE, "updateDefaults", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── List all tenant AI settings (overview) ─────────────────────────
exports.listTenantSettings = async (req, res) => {
  try {
    const settings = await AISetting.findAll({
      include: [
        {
          model: User,
          as: "Tenant",
          attributes: ["id", "full_name", "email", "is_active"],
        },
      ],
      order: [["updated_at", "DESC"]],
    });

    // Live Instagram connection state (one row per tenant, slot 1 today) —
    // has_instagram only reflects the toggle; instagram_status reflects the
    // real per-tenant Meta connection (InstagramSession — each tenant's own
    // Meta App credentials, not a shared/global app) so the overview table
    // shows honest state.
    const igSessions = await InstagramSession.findAll({ where: { slot: 1 } });
    const igStatusByTenant = new Map(igSessions.map((r) => [r.tenant_id, r]));

    const data = settings.map((s) => {
      const igSession = igStatusByTenant.get(s.tenant_id);
      return {
        tenant_id: s.tenant_id,
        tenant_name: s.Tenant?.full_name || "—",
        tenant_email: s.Tenant?.email || "—",
        is_active: s.Tenant?.is_active ?? false,
        openai_model: s.openai_model,
        has_api_key: !!s.openai_api_key,
        openai_api_key_masked: maskKey(s.openai_api_key),
        ai_tone: s.ai_tone,
        has_whatsapp: !!s.whatsapp_enabled,
        has_instagram: !!s.instagram_enabled,
        instagram_status: igSession?.status || "disconnected",
        instagram_username: igSession?.ig_username || null,
        updated_at: s.updated_at,
      };
    });

    log.info(MODULE, "listTenantSettings", { userId: req.user.id, count: data.length });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    log.error(MODULE, "listTenantSettings", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
