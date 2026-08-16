const express = require("express");
const router = express.Router();

const saleController = require("../controllers/saleController");

const authMiddleware = require("../middleware/auth");
const businessMiddleware = require("../middleware/businessMiddleware");

// =====================================
// CREATE SALE
// =====================================
router.post(
    "/create",
    authMiddleware,
    businessMiddleware,
    saleController.createSale
);

// =====================================
// GET ALL SALES
// =====================================
router.get(
    "/",
    authMiddleware,
    businessMiddleware,
    saleController.getSales
);

// =====================================
// GET INVOICE
// IMPORTANT: before /:id
// =====================================
router.get(
    "/invoice/:id",
    authMiddleware,
    businessMiddleware,
    saleController.getInvoice
);

// =====================================
// UPDATE PAYMENT
// =====================================
router.put(
    "/:id/payment",
    authMiddleware,
    businessMiddleware,
    saleController.updatePaymentStatus
);

// =====================================
// GET SINGLE SALE
// =====================================
router.get(
    "/:id",
    authMiddleware,
    businessMiddleware,
    saleController.getSale
);

// =====================================
// DELETE SALE
// =====================================
router.delete(
    "/:id",
    authMiddleware,
    businessMiddleware,
    saleController.deleteSale
);

module.exports = router;