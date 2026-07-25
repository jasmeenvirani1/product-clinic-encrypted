const router = require("express").Router();
const wonLeadsCtrl = require("../controllers/wonLeadsController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.get("/",                          checkPermission("app-won-leads", "view"),   wonLeadsCtrl.getWonLeads);
router.get("/invoices",                  checkPermission("app-won-leads", "view"),   wonLeadsCtrl.getInvoices);
router.post("/:leadId/invoice",          checkPermission("app-won-leads", "create"), wonLeadsCtrl.generateInvoice);

module.exports = router;
