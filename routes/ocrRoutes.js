const express = require("express");

const router = express.Router();

const ocrController = require("../controllers/ocrController");

router.get("/scan/:receiptId", ocrController.scanReceipt);

module.exports = router;