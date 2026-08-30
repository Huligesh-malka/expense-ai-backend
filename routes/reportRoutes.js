const express = require("express");

const router = express.Router();

const reportController = require("../controllers/reportController");

// Summary
router.get(
    "/summary",
    reportController.getReportSummary
);

// Sales
router.get(
    "/sales",
    reportController.getSalesReport
);

// Purchases
router.get(
    "/purchases",
    reportController.getPurchaseReport
);

// Profit
router.get(
    "/profit",
    reportController.getProfitReport
);

// Stock
router.get(
    "/stock",
    reportController.getStockReport
);

module.exports = router;