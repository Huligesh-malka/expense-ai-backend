// routes/adminSecurityRoutes.js

const express = require("express");

const router = express.Router();

const securityController =
    require("../controllers/adminSecurityController");

// =====================================================
// SECURITY AI
// =====================================================

router.get(
    "/ai",
    securityController.getSecurityAI
);


// =====================================================
// SECURITY OVERVIEW
// =====================================================

router.get(
    "/overview",
    securityController.getSecurityOverview
);


// =====================================================
// SECURITY EVENTS
// =====================================================

router.get(
    "/events",
    securityController.getSecurityEvents
);


module.exports = router;