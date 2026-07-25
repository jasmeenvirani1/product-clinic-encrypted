const { ManagePage } = require("../models");
const log = require("../utils/logger");

const MODULE = "ManagePageController";

const defaultPages = [
  {
    title: "Privacy Policy",
    title_tr: "Gizlilik Politikası",
    slug: "privacy-policy",
    footer_label: "Privacy Policy",
    footer_label_tr: "Gizlilik Politikası",
    show_in_footer: true,
    content: "<p>Add your privacy policy content here.</p>",
    content_tr: "<p>Gizlilik politikası içeriğinizi buraya ekleyin.</p>",
  },
  {
    title: "Terms and Conditions",
    title_tr: "Kullanım Şartları",
    slug: "terms-and-conditions",
    footer_label: "Terms and Conditions",
    footer_label_tr: "Kullanım Şartları",
    show_in_footer: true,
    content: "<p>Add your terms and conditions content here.</p>",
    content_tr: "<p>Kullanım şartları içeriğinizi buraya ekleyin.</p>",
  },
];

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureDefaultPages() {
  for (const page of defaultPages) {
    await ManagePage.findOrCreate({
      where: { slug: page.slug },
      defaults: { ...page, is_active: true, is_deleted: false },
    });
  }
}

exports.getAll = async (_req, res) => {
  try {
    await ensureDefaultPages();
    const pages = await ManagePage.findAll({
      where: { is_deleted: false },
      order: [["id", "ASC"]],
    });
    return res.status(200).json({ success: true, data: pages });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      title,
      title_tr,
      slug,
      content,
      content_tr,
      footer_label,
      footer_label_tr,
      show_in_footer,
      is_active,
    } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: "Title and content are required." });
    }

    const normalizedSlug = slugify(slug || title);
    if (!normalizedSlug) {
      return res.status(400).json({ success: false, message: "A valid slug is required." });
    }

    const page = await ManagePage.create({
      title: title.trim(),
      title_tr: title_tr?.trim() || null,
      slug: normalizedSlug,
      content,
      content_tr: content_tr || null,
      footer_label: footer_label?.trim() || title.trim(),
      footer_label_tr: footer_label_tr?.trim() || title_tr?.trim() || null,
      show_in_footer: show_in_footer === true,
      is_active: is_active !== false,
    });

    log.info(MODULE, "create", { userId: req.user.id, pageId: page.id });
    return res.status(201).json({ success: true, message: "Page created.", data: page });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "Slug already exists." });
    }
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.update = async (req, res) => {
  try {
    const page = await ManagePage.findOne({ where: { id: req.params.id, is_deleted: false } });
    if (!page) return res.status(404).json({ success: false, message: "Page not found." });

    const {
      title,
      title_tr,
      slug,
      content,
      content_tr,
      footer_label,
      footer_label_tr,
      show_in_footer,
      is_active,
    } = req.body;
    if (title !== undefined) page.title = title.trim();
    if (title_tr !== undefined) page.title_tr = title_tr?.trim() || null;
    if (slug !== undefined) {
      const normalizedSlug = slugify(slug);
      if (!normalizedSlug) {
        return res.status(400).json({ success: false, message: "A valid slug is required." });
      }
      page.slug = normalizedSlug;
    }
    if (content !== undefined) page.content = content;
    if (content_tr !== undefined) page.content_tr = content_tr || null;
    if (footer_label !== undefined) page.footer_label = footer_label?.trim() || null;
    if (footer_label_tr !== undefined) page.footer_label_tr = footer_label_tr?.trim() || null;
    if (show_in_footer !== undefined) page.show_in_footer = show_in_footer;
    if (is_active !== undefined) page.is_active = is_active;

    await page.save();

    log.info(MODULE, "update", { userId: req.user.id, pageId: page.id });
    return res.status(200).json({ success: true, message: "Page updated.", data: page });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "Slug already exists." });
    }
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.remove = async (req, res) => {
  try {
    const page = await ManagePage.findOne({ where: { id: req.params.id, is_deleted: false } });
    if (!page) return res.status(404).json({ success: false, message: "Page not found." });

    page.is_deleted = true;
    await page.save();

    log.info(MODULE, "remove", { userId: req.user.id, pageId: page.id });
    return res.status(200).json({ success: true, message: "Page deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getFooterPages = async (_req, res) => {
  try {
    await ensureDefaultPages();
    const pages = await ManagePage.findAll({
      where: { is_deleted: false, is_active: true, show_in_footer: true },
      attributes: ["id", "title", "title_tr", "slug", "footer_label", "footer_label_tr"],
      order: [["id", "ASC"]],
    });
    return res.status(200).json({ success: true, data: pages });
  } catch (err) {
    log.error(MODULE, "getFooterPages", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getPublicBySlug = async (req, res) => {
  try {
    await ensureDefaultPages();
    const page = await ManagePage.findOne({
      where: {
        slug: slugify(req.params.slug),
        is_deleted: false,
        is_active: true,
      },
      attributes: ["id", "title", "title_tr", "slug", "content", "content_tr", "updated_at"],
    });
    if (!page) return res.status(404).json({ success: false, message: "Page not found." });

    const data = page.toJSON();
    if (String(req.query.lang || "").toLowerCase().startsWith("tr")) {
      data.title = data.title_tr || data.title;
      data.content = data.content_tr || data.content;
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    log.error(MODULE, "getPublicBySlug", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
