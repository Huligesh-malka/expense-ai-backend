const express = require("express");
const router = express.Router();

const businessController = require("../controllers/businessController");
const authMiddleware = require("../middleware/auth");
const businessMiddleware = require("../middleware/businessMiddleware");

// =====================================
// CREATE BUSINESS
// =====================================
router.post(
    "/create",
    authMiddleware,
    businessController.createBusiness
);

// =====================================
// GET MY BUSINESS
// =====================================
router.get(
    "/",
    authMiddleware,
    businessMiddleware,
    businessController.getMyBusiness
);

// =====================================
// UPDATE MY BUSINESS
// =====================================
router.put(
    "/",
    authMiddleware,
    businessMiddleware,
    businessController.updateMyBusiness
);

// =====================================
// GET BUSINESS PROFILE (Protected)
// =====================================
router.get(
    "/profile",
    authMiddleware,
    businessMiddleware,
    businessController.getMyBusinessProfile
);

// =====================================
// UPDATE BUSINESS PROFILE (Protected)
// =====================================
router.put(
    "/profile",
    authMiddleware,
    businessMiddleware,
    businessController.updateMyBusinessProfile
);

// =====================================
// DEACTIVATE BUSINESS (Soft Delete)
// =====================================
router.put(
    "/deactivate",
    authMiddleware,
    businessMiddleware,
    businessController.deactivateBusiness
);

// =====================================
// REACTIVATE BUSINESS
// =====================================
router.put(
    "/reactivate",
    authMiddleware,
    businessMiddleware,
    businessController.reactivateBusiness
);

// =====================================
// ADMIN ONLY: GET ALL BUSINESSES
// =====================================


module.exports = router;