const { LandingFaq } = require("../models");
const log = require("../utils/logger");

const MODULE = "LandingFaqController";

// GET /api/public/landing-faqs — consumed by the public landing page (no auth).
// Returns only active FAQs, ordered, with a whitelisted attribute set.
exports.getPublic = async (_req, res) => {
  try {
    const faqs = await LandingFaq.findAll({
      where: { is_deleted: false, is_active: true },
      attributes: ["id", "question", "answer"],
      order: [["sort_order", "ASC"], ["id", "ASC"]],
    });
    return res.status(200).json({ success: true, data: faqs });
  } catch (err) {
    log.error(MODULE, "getPublic", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET /api/super-admin/landing-faqs — admin list (includes inactive).
exports.getAll = async (_req, res) => {
  try {
    const faqs = await LandingFaq.findAll({
      where: { is_deleted: false },
      order: [["sort_order", "ASC"], ["id", "ASC"]],
    });
    return res.status(200).json({ success: true, data: faqs });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.create = async (req, res) => {
  try {
    const { question, answer, is_active, sort_order } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ success: false, message: "question and answer are required." });
    }
    const faq = await LandingFaq.create({
      question: question.trim(),
      answer: answer.trim(),
      is_active: is_active !== false,
      sort_order: Number.isFinite(+sort_order) ? +sort_order : 0,
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
    const faq = await LandingFaq.findOne({ where: { id: req.params.id, is_deleted: false } });
    if (!faq) return res.status(404).json({ success: false, message: "FAQ not found." });

    const { question, answer, is_active, sort_order } = req.body;
    if (question !== undefined) faq.question = question.trim();
    if (answer !== undefined) faq.answer = answer.trim();
    if (is_active !== undefined) faq.is_active = is_active;
    if (sort_order !== undefined && Number.isFinite(+sort_order)) faq.sort_order = +sort_order;
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
    const faq = await LandingFaq.findOne({ where: { id: req.params.id, is_deleted: false } });
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
