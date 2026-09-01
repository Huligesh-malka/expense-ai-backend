const express = require("express");

const router = express.Router();

const {
    getBusinessAnalytics
} = require("../controllers/aiBusinessController");

const authMiddleware = require("../middleware/auth");

const businessMiddleware = require("../middleware/businessMiddleware");


// ============================================================
// AI BUSINESS ANALYTICS
// ============================================================

router.get(
    "/analytics",
    authMiddleware,
    businessMiddleware,
    getBusinessAnalytics
);


module.exports = router;