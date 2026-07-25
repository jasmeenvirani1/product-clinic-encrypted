const { TenantFieldPreference } = require("../models");

function resolveTenantId(user) {
  // tenant_admin owns the workspace; staff_user belongs to a tenant
  if (user.Role?.name === "tenant_admin" || (!user.tenant_id && user.id)) return user.id;
  return user.tenant_id;
}

exports.getPreference = async (req, res) => {
  try {
    const { table_name } = req.query;
    if (!table_name) return res.status(400).json({ success: false, message: "table_name is required." });

    const tenant_id = resolveTenantId(req.user);
    const pref = await TenantFieldPreference.findOne({ where: { tenant_id, table_name } });
    return res.json({ success: true, data: { hidden_fields: pref ? pref.hidden_fields : [] } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.upsertPreference = async (req, res) => {
  try {
    const { table_name, hidden_fields } = req.body;
    if (!table_name) return res.status(400).json({ success: false, message: "table_name is required." });
    if (!Array.isArray(hidden_fields)) return res.status(400).json({ success: false, message: "hidden_fields must be an array." });

    const tenant_id = resolveTenantId(req.user);
    const [pref] = await TenantFieldPreference.findOrCreate({
      where: { tenant_id, table_name },
      defaults: { tenant_id, table_name, hidden_fields: [] },
    });
    pref.hidden_fields = hidden_fields;
    await pref.save();
    return res.json({ success: true, data: { hidden_fields: pref.hidden_fields } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
