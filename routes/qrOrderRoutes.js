const express = require("express");

const router = express.Router();

const qrOrderController =
    require("../controllers/qrOrderController");

const authMiddleware =
    require("../middleware/auth");

const businessMiddleware =
    require("../middleware/businessMiddleware");


// ======================================================
// PUBLIC CUSTOMER ROUTES
// ======================================================

// Customer scans QR
router.get(
    "/public/:token/menu",
    qrOrderController.getPublicMenu
);

// Customer places order
router.post(
    "/public/order",
    qrOrderController.createQROrder
);


// ======================================================
// OWNER AUTHENTICATION
// ======================================================

router.use(
    authMiddleware,
    businessMiddleware
);


// ======================================================
// QR
// ======================================================

router.get(
    "/qr",
    qrOrderController.getOrCreateQR
);

router.put(
    "/qr/status",
    qrOrderController.updateQRStatus
);


// ======================================================
// TABLES
// ======================================================

router.post(
    "/tables",
    qrOrderController.createTable
);

router.get(
    "/tables",
    qrOrderController.getTables
);

router.put(
    "/tables/:id",
    qrOrderController.updateTable
);

router.delete(
    "/tables/:id",
    qrOrderController.deleteTable
);


// ======================================================
// ORDERS
// ======================================================

router.get(
    "/orders",
    qrOrderController.getQROrders
);

router.get(
    "/orders/:id",
    qrOrderController.getQROrder
);

router.put(
    "/orders/:id/status",
    qrOrderController.updateQROrderStatus
);

router.put(
    "/orders/:id/payment",
    qrOrderController.updateQRPayment
);


module.exports = router;