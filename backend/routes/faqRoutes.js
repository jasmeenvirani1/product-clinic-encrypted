const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const faqController = require("../controllers/faqController");

router.use(authenticate);

router.get("/",        faqController.getAll);
router.post("/",       faqController.create);
router.put("/:id",     faqController.update);
router.delete("/:id",  faqController.remove);

module.exports = router;
