const express = require("express");

const router = express.Router();

const qrOrderController = require("../controllers/qrOrderController");

// ===============================================
// MIDDLEWARE
// ===============================================

const authMiddleware = require("../middleware/auth");
const businessMiddleware = require("../middleware/businessMiddleware");

// ======================================================
// OWNER AUTHENTICATION
// ======================================================
//
// These routes require:
// 1. JWT authentication
// 2. Business identification
//
// req.user
// req.businessId
//
// ======================================================

router.use(
    authMiddleware,
    businessMiddleware
);

// ======================================================
// QR ORDERS
// ======================================================

// Get all QR orders for current business
router.get(
    "/orders",
    qrOrderController.getQROrders
);

// Get single QR order
router.get(
    "/orders/:id",
    qrOrderController.getQROrder
);

// Update QR order status
router.put(
    "/orders/:id/status",
    qrOrderController.updateQROrderStatus
);

// Update QR payment
router.put(
    "/orders/:id/payment",
    qrOrderController.updateQRPayment
);

// ======================================================

module.exports = router;