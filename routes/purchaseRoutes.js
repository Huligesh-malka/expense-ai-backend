const express = require("express");
const router = express.Router();

const purchaseController = require("../controllers/purchaseController");

const authMiddleware = require("../middleware/auth");
const businessMiddleware = require("../middleware/businessMiddleware");

// =====================================
// CREATE PURCHASE
// =====================================
router.post(
    "/",
    authMiddleware,
    businessMiddleware,
    purchaseController.createPurchase
);

// =====================================
// GET ALL PURCHASES
// =====================================
router.get(
    "/",
    authMiddleware,
    businessMiddleware,
    purchaseController.getPurchases
);

// =====================================
// PURCHASE DASHBOARD
// =====================================
router.get(
    "/dashboard",
    authMiddleware,
    businessMiddleware,
    purchaseController.purchaseDashboard
);

// =====================================
// SUPPLIER PURCHASES
// IMPORTANT: BEFORE /:id
// =====================================
router.get(
    "/suppliers/:supplierId/purchases",
    authMiddleware,
    businessMiddleware,
    purchaseController.getSupplierPurchases
);

// =====================================
// PAYMENT HISTORY
// IMPORTANT: BEFORE /:id
// =====================================
router.get(
    "/:id/payments",
    authMiddleware,
    businessMiddleware,
    purchaseController.getPurchasePayments
);

// =====================================
// ADD PAYMENT
// =====================================
router.post(
    "/:id/payments",
    authMiddleware,
    businessMiddleware,
    purchaseController.addPurchasePayment
);

// =====================================
// PURCHASE DETAILS
// =====================================
router.get(
    "/details/:id",
    authMiddleware,
    businessMiddleware,
    purchaseController.getPurchaseDetails
);

// =====================================
// GET SINGLE PURCHASE
// =====================================
router.get(
    "/:id",
    authMiddleware,
    businessMiddleware,
    purchaseController.getPurchase
);

// =====================================
// UPDATE PURCHASE
// =====================================
router.put(
    "/:id",
    authMiddleware,
    businessMiddleware,
    purchaseController.updatePurchase
);

// =====================================
// DELETE PURCHASE
// =====================================
router.delete(
    "/:id",
    authMiddleware,
    businessMiddleware,
    purchaseController.deletePurchase
);

module.exports = router;