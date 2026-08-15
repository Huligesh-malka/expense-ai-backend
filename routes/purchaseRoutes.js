const express = require("express");
const router = express.Router();

const purchaseController = require("../controllers/purchaseController");


// =====================================
// CREATE PURCHASE
// =====================================
router.post("/", purchaseController.createPurchase);


// =====================================
// GET ALL PURCHASES
// =====================================
router.get("/", purchaseController.getPurchases);


// =====================================
// PURCHASE DASHBOARD
// =====================================
router.get("/dashboard", purchaseController.purchaseDashboard);


// =====================================
// SUPPLIER PURCHASES
// IMPORTANT: BEFORE /:id
// =====================================
router.get(
  "/suppliers/:supplierId/purchases",
  purchaseController.getSupplierPurchases
);


// =====================================
// PAYMENT HISTORY
// =====================================
router.get(
  "/:id/payments",
  purchaseController.getPurchasePayments
);


router.get(
  "/:id/payments/:paymentId/receipt",
  purchaseController.downloadPurchasePaymentReceipt
);


// =====================================
// ADD PAYMENT
// =====================================
router.post(
  "/:id/payments",
  purchaseController.addPurchasePayment
);





// =====================================
// PURCHASE DETAILS
// =====================================
router.get(
  "/details/:id",
  purchaseController.getPurchaseDetails
);


// =====================================
// GET SINGLE PURCHASE
// =====================================
router.get(
  "/:id",
  purchaseController.getPurchase
);


// =====================================
// UPDATE PURCHASE
// =====================================
router.put(
  "/:id",
  purchaseController.updatePurchase
);


// =====================================
// DELETE PURCHASE
// =====================================
router.delete(
  "/:id",
  purchaseController.deletePurchase
);


module.exports = router;