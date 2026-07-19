const express = require("express");

const router = express.Router();

const aiController = require("../controllers/aiController");

router.get("/parse/:receiptId", aiController.parseReceiptAI);

module.exports = router;