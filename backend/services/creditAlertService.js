const { User, Plan, Role, AISetting } = require("../models");
const { resolveCreditLimit } = require("./creditService");
const { sendCreditUsageAlert } = require("./emailService");
const { createNotification } = require("./notificationService");
const log = require("../utils/logger");

const MODULE = "CreditAlertService";

// Usage thresholds (percent) that trigger a one-time alert per plan cycle.
// Checked high → low so a single jump that crosses several still picks the
// highest newly-crossed level.
const THRESHOLDS = [100, 90, 75];

function buildSelfMessage(percent, creditsUsed, creditLimit) {
  if (percent >= 100) {
    return (
      "⚠️ Your AI reply credits are used up (" +
      `${creditsUsed}/${creditLimit}). Automatic AI replies to patients are now paused. ` +
      "Please renew your plan or upgrade to resume AI replies."
    );
  }
  const left = Math.max(creditLimit - creditsUsed, 0);
  return (
    `⚠️ You've used ${percent}% of your AI reply credits (${creditsUsed}/${creditLimit}). ` +
    `${left} left this cycle. Consider upgrading before they run out so AI replies aren't paused.`
  );
}

/**
 * After a credit is consumed, check whether usage just crossed a 75/90/100%
 * threshold for the first time this plan cycle. If so, alert the tenant admin
 * over all three channels (email + portal + WhatsApp self-chat) and record the
 * highest threshold reached so it never re-fires until credits reset.
 *
 * Fire-and-forget: every channel is isolated and this never throws into the
 * AI-reply path that called it.
 */
async function maybeNotifyThresholds(tenantId, preloadedUser = null) {
  try {
    const user =
      preloadedUser ||
      (await User.findByPk(tenantId, {
        include: [
          { model: Plan, attributes: ["credit_limit"] },
          { model: Role, attributes: ["name"] },
        ],
      }));
    if (!user) return;

    const creditLimit = resolveCreditLimit(user);
    const creditsUsed = user.credits_used ?? 0;
    const alreadyAlerted = user.credit_alert_level ?? 0;
    const percent =
      creditLimit && creditLimit > 0 ? Math.floor((creditsUsed / creditLimit) * 100) : null;

    // Highest threshold we've newly crossed (and haven't alerted on yet).
    const crossed =
      percent === null ? undefined : THRESHOLDS.find((t) => percent >= t && t > alreadyAlerted);

    // Unlimited (Enterprise/super-admin) or no-credit (expired) states have no
    // meaningful percentage to alert on.
    if (creditLimit === null || creditLimit <= 0) return;
    if (!crossed) return;

    // Persist first so concurrent checks don't double-fire the same level.
    await user.update({ credit_alert_level: crossed });
    log.info(MODULE, "thresholdCrossed", { tenantId, percent, level: crossed, creditsUsed, creditLimit });

    const setting = await AISetting.findOne({ where: { tenant_id: tenantId } });
    const tenantName = user.clinic_name || user.full_name || null;

    // ── Channel 1: Email ──
    try {
      const toEmail = setting?.notification_email || user.email;
      await sendCreditUsageAlert({
        toEmail,
        percent: crossed,
        creditsUsed,
        creditLimit,
        tenantName,
      });
    } catch (err) {
      log.warn(MODULE, "emailAlert:failed", { tenantId, error: err.message });
    }

    // ── Channel 2: Portal notification ──
    try {
      const title =
        crossed >= 100
          ? "AI reply credits used up"
          : `${crossed}% of AI reply credits used`;
      const body =
        crossed >= 100
          ? "Automatic AI replies are paused. Renew or upgrade your plan to resume."
          : `You've used ${creditsUsed} of ${creditLimit} AI reply credits this cycle. Upgrade to avoid a pause in automatic replies.`;
      await createNotification({
        type: "billing",
        title,
        body,
        tenantId,
        recipientRole: "tenant_admin",
        meta: { percent: crossed, credits_used: creditsUsed, credit_limit: creditLimit },
      });
    } catch (err) {
      log.warn(MODULE, "portalAlert:failed", { tenantId, error: err.message });
    }

    // ── Channel 3: WhatsApp self-message ──
    try {
      if (setting?.wa_qr_status === "connected" && setting?.wa_qr_number) {
        // Lazy require to avoid a circular dependency at module load.
        const { sendWhatsAppText } = require("./whatsappQrBootstrap");
        await sendWhatsAppText(
          Number(tenantId),
          setting.wa_qr_number,
          buildSelfMessage(crossed, creditsUsed, creditLimit)
        );
      }
    } catch (err) {
      log.warn(MODULE, "whatsappAlert:failed", { tenantId, error: err.message });
    }
  } catch (err) {
    log.warn(MODULE, "maybeNotifyThresholds:failed", { tenantId, error: err.message });
  }
}

module.exports = { maybeNotifyThresholds, THRESHOLDS };
