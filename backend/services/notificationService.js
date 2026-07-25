const { Notification } = require("../models");

/**
 * Create a notification record.
 *
 * @param {object} opts
 * @param {string} opts.type           - e.g. 'lead', 'message', 'billing', 'alert', 'clinic', 'user', 'system'
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {number|null} [opts.tenantId]       - scope to a specific tenant (null = platform-wide)
 * @param {string|null} [opts.recipientRole]  - 'super_admin' | 'tenant_admin' | 'staff_user' | null
 * @param {number|null} [opts.recipientId]    - specific user id (overrides recipientRole if set)
 * @param {object}      [opts.meta]           - extra data (lead_id, conversation_id, etc.)
 */
async function createNotification({ type, title, body, tenantId = null, recipientRole = null, recipientId = null, meta = {} }) {
  try {
    await Notification.create({
      type,
      title,
      body,
      tenant_id: tenantId,
      recipient_role: recipientRole,
      recipient_id: recipientId,
      meta,
      is_read: false,
    });
  } catch (err) {
    // Never crash the calling flow over a notification failure.
    void err;
  }
}

module.exports = { createNotification };
