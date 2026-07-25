const { FAQ } = require("../models");
const log = require("../utils/logger");

const MODULE = "FAQController";

exports.getAll = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || req.user.id;
    const faqs = await FAQ.findAll({
      where: { tenant_id: tenantId, is_deleted: false },
      order: [["id", "ASC"]],
    });
    return res.status(200).json({ success: true, data: faqs });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.create = async (req, res) => {
  try {
    const { question, answer, is_active } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ success: false, message: "question and answer are required." });
    }
    const tenantId = req.user.tenant_id || req.user.id;
    const faq = await FAQ.create({
      tenant_id: tenantId,
      question: question.trim(),
      answer: answer.trim(),
      is_active: is_active !== false,
    });
    log.info(MODULE, "create", { userId: req.user.id, faqId: faq.id });
    return res.status(201).json({ success: true, message: "FAQ created.", data: faq });
  } catch (err) {
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.update = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || req.user.id;
    const faq = await FAQ.findOne({ where: { id: req.params.id, tenant_id: tenantId, is_deleted: false } });
    if (!faq) return res.status(404).json({ success: false, message: "FAQ not found." });

    const { question, answer, is_active } = req.body;
    if (question !== undefined) faq.question = question.trim();
    if (answer !== undefined) faq.answer = answer.trim();
    if (is_active !== undefined) faq.is_active = is_active;
    await faq.save();

    log.info(MODULE, "update", { userId: req.user.id, faqId: faq.id });
    return res.status(200).json({ success: true, message: "FAQ updated.", data: faq });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.remove = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || req.user.id;
    const faq = await FAQ.findOne({ where: { id: req.params.id, tenant_id: tenantId, is_deleted: false } });
    if (!faq) return res.status(404).json({ success: false, message: "FAQ not found." });

    faq.is_deleted = true;
    await faq.save();

    log.info(MODULE, "remove", { userId: req.user.id, faqId: faq.id });
    return res.status(200).json({ success: true, message: "FAQ deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
