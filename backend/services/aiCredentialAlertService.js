const { User, Role, AiCredentialAlert } = require("../models");
const { sendAICredentialFailureAlert } = require("./emailService");
const { createNotification } = require("./notificationService");
const log = require("../utils/logger");

const MODULE = "AiCredentialAlertService";

// Don't re-alert on every failed message while a key stays broken — only
// re-fire once this many ms have passed since the last alert for the same
// tenant+credential_type. Longer than the 60s super-admin-credential cache
// TTL (platformAISettings.js), short enough that a key that breaks again
// later the same day produces a fresh alert.
const COOLDOWN_MS = 30 * 60 * 1000;

const CREDENTIAL_LABELS = {
  tenant_key: "own",
  super_admin_fallback_key: "platform fallback",
};

/**
 * Fired when every OpenAI credential candidate has failed for a WhatsApp/
 * Instagram AI reply (webhookController.js's generateAIResponse). Alerts
 * super_admin via email + portal notification, deduped per tenant+
 * credential_type via a persisted 30-minute cooldown (AiCredentialAlert).
 *
 * Fire-and-forget: wrapped in an outer try/catch that never throws/rejects,
 * and each channel is isolated in its own try/catch, matching
 * creditAlertService.js's convention. Safe to `await` from the AI-reply path
 * without risking a block or a thrown error.
 */
async function notify({ tenantId, failedCredentialType, error, model, channel = "whatsapp" }) {
  try {
    if (!tenantId || !failedCredentialType) return;

    const [row, created] = await AiCredentialAlert.findOrCreate({
      where: { tenant_id: tenantId, credential_type: failedCredentialType },
      defaults: { last_alerted_at: new Date(), last_error_message: error?.message || null },
    });

    if (!created) {
      const elapsed = Date.now() - new Date(row.last_alerted_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        return; // deduped — still within cooldown window
      }
      // Persist first so concurrent requests hitting this at once don't
      // double-fire (same ordering as creditAlertService.js's user.update()
      // before firing channels).
      await row.update({ last_alerted_at: new Date(), last_error_message: error?.message || null });
    }

    log.info(MODULE, "notify:firing", { tenantId, failedCredentialType, channel });

    const tenant = await User.findByPk(tenantId, { attributes: ["clinic_name", "full_name"] });
    const tenantName = tenant?.clinic_name || tenant?.full_name || null;
    const credentialLabel = CREDENTIAL_LABELS[failedCredentialType] || failedCredentialType;

    const title = "AI reply failed — OpenAI credential issue";
    const body = `${tenantName || `Tenant #${tenantId}`}'s ${credentialLabel} OpenAI key failed on ${channel}: ${error?.message || "unknown error"}`;

    // ── Channel 1: Email (to every super_admin user) ──
    try {
      const superAdminRole = await Role.findOne({ where: { name: "super_admin" } });
      if (superAdminRole) {
        const superAdmins = await User.findAll({
          where: { role_id: superAdminRole.id, is_active: true },
          attributes: ["email"],
        });
        for (const admin of superAdmins) {
          if (!admin.email) continue;
          try {
            await sendAICredentialFailureAlert({
              toEmail: admin.email,
              tenantId,
              tenantName,
              credentialType: failedCredentialType,
              errorMessage: error?.message || null,
              errorStatus: error?.status || error?.code || null,
              channel,
              model,
            });
          } catch (emailErr) {
            log.warn(MODULE, "notify:emailAlert:failed", { tenantId, error: emailErr.message });
          }
        }
      }
    } catch (err) {
      log.warn(MODULE, "notify:emailAlert:lookupFailed", { tenantId, error: err.message });
    }

    // ── Channel 2: Portal notification (recipientRole-targeted, resolved at
    // read-time by GET /api/notifications — not one row per super_admin user) ──
    try {
      await createNotification({
        type: "ai_credential",
        title,
        body,
        tenantId,
        recipientRole: "super_admin",
        meta: {
          tenant_id: tenantId,
          credential_type: failedCredentialType,
          channel,
          error_message: error?.message || null,
        },
      });
    } catch (err) {
      log.warn(MODULE, "notify:portalAlert:failed", { tenantId, error: err.message });
    }
  } catch (err) {
    log.warn(MODULE, "notify:failed", { tenantId, error: err.message });
  }
}

module.exports = { notify };
