const express = require("express");
const router = express.Router();

const reportController = require("../controllers/reportController");

const authMiddleware = require("../middleware/auth");
const businessMiddleware = require("../middleware/businessMiddleware");

router.get(
    "/sales",
    authMiddleware,
    businessMiddleware,
    reportController.getSalesReport
);

router.get(
    "/purchases",
    authMiddleware,
    businessMiddleware,
    reportController.getPurchaseReport
);

router.get(
    "/profit",
    authMiddleware,
    businessMiddleware,
    reportController.getProfitReport
);

router.get(
    "/stock",
    authMiddleware,
    businessMiddleware,
    reportController.getStockReport
);

module.exports = router;