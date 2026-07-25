const { AISetting } = require("../models");
const log = require("../utils/logger");
const { resolveBaseUrlForModel } = require("./aiModelController");
const { getPlatformPromptInstructions } = require("../utils/platformAISettings");

const MODULE = "AISettingController";

// Mask API key for frontend display (show last 4 chars only)
const maskKey = (key) => {
  if (!key) return null;
  if (key.length <= 8) return "••••••••";
  return "••••••••••••" + key.slice(-4);
};

// ─── Get AI settings for current tenant ─────────────────────────────
exports.get = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || req.user.id;

    let setting = await AISetting.findOne({ where: { tenant_id: tenantId } });

    if (!setting) {
      setting = await AISetting.create({ tenant_id: tenantId });
      log.info(MODULE, "get", { message: "Created default AI settings", tenantId });
    }

    // Return masked keys — never send raw tokens to frontend
    const data = setting.toJSON();
    data.openai_api_key_masked = maskKey(data.openai_api_key);
    data.has_api_key = !!data.openai_api_key;
    delete data.openai_api_key;

    // Channel connection status. Meta credentials were removed — until the
    // new connection flow provides its own readiness signal, "connected"
    // simply mirrors the per-channel enabled toggle.
    data.has_whatsapp = !!data.whatsapp_enabled;
    data.has_instagram = !!data.instagram_enabled;

    // Platform default prompt — shown to the tenant as a starting point.
    // A tenant's own prompt_instructions (once set) takes precedence at
    // runtime (see conversationController.buildSystemPrompt precedence note).
    data.platform_default_prompt = await getPlatformPromptInstructions();

    log.info(MODULE, "get", { userId: req.user.id, tenantId });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    log.error(MODULE, "get", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Update AI settings ─────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || req.user.id;

    let setting = await AISetting.findOne({ where: { tenant_id: tenantId } });
    if (!setting) {
      setting = await AISetting.create({ tenant_id: tenantId });
    }

    const {
      ai_tone,
      prompt_instructions,
      escalate_low_confidence,
      auto_handover_high_intent,
      high_intent_keywords,
      medium_intent_keywords,
      low_intent_keywords,
      ai_responds_to_intents,
      email_notify_intents,
      notification_email,
      openai_api_key,
      openai_model,
      openai_base_url,
      // Channel toggles (Meta credentials removed — see AISetting model note)
      whatsapp_enabled,
      instagram_enabled,
      // Follow-up
      followup_1_enabled,
      followup_1_days,
      followup_2_enabled,
      followup_2_days,
    } = req.body;

    if (ai_tone !== undefined) setting.ai_tone = ai_tone;
    if (prompt_instructions !== undefined) setting.prompt_instructions = prompt_instructions;
    if (escalate_low_confidence !== undefined) setting.escalate_low_confidence = escalate_low_confidence;
    if (auto_handover_high_intent !== undefined) setting.auto_handover_high_intent = auto_handover_high_intent;
    if (high_intent_keywords !== undefined) setting.high_intent_keywords = high_intent_keywords;
    if (medium_intent_keywords !== undefined) setting.medium_intent_keywords = medium_intent_keywords;
    if (low_intent_keywords !== undefined) setting.low_intent_keywords = low_intent_keywords;
    if (ai_responds_to_intents !== undefined) setting.ai_responds_to_intents = ai_responds_to_intents;
    if (email_notify_intents !== undefined) setting.email_notify_intents = email_notify_intents;
    if (notification_email !== undefined) setting.notification_email = notification_email;
    if (openai_api_key !== undefined) setting.openai_api_key = openai_api_key;
    if (openai_model !== undefined) {
      setting.openai_model = openai_model;
      // Base URL is no longer entered by hand — resolve it from the selected
      // model in the AI-models master so the AI client targets the right endpoint.
      const resolved = await resolveBaseUrlForModel(openai_model);
      if (resolved !== undefined) setting.openai_base_url = resolved;
    }
    // Backward-compat: still honour an explicit base_url if a caller sends one.
    if (openai_base_url !== undefined) setting.openai_base_url = openai_base_url;
    if (whatsapp_enabled !== undefined) setting.whatsapp_enabled = !!whatsapp_enabled;
    if (instagram_enabled !== undefined) setting.instagram_enabled = !!instagram_enabled;
    if (followup_1_enabled !== undefined) setting.followup_1_enabled = !!followup_1_enabled;
    if (followup_1_days !== undefined) setting.followup_1_days = Math.max(1, parseInt(followup_1_days, 10) || 1);
    if (followup_2_enabled !== undefined) setting.followup_2_enabled = !!followup_2_enabled;
    if (followup_2_days !== undefined) setting.followup_2_days = Math.max(1, parseInt(followup_2_days, 10) || 3);

    await setting.save();

    // Return masked keys
    const data = setting.toJSON();
    data.openai_api_key_masked = maskKey(data.openai_api_key);
    data.has_api_key = !!data.openai_api_key;
    delete data.openai_api_key;

    // Channel connection status mirrors the enabled toggle (Meta creds removed).
    data.has_whatsapp = !!data.whatsapp_enabled;
    data.has_instagram = !!data.instagram_enabled;

    log.info(MODULE, "update", { userId: req.user.id, tenantId });
    return res.status(200).json({ success: true, message: "AI settings updated.", data });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
