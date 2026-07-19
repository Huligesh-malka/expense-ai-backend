const express = require("express");
const router = express.Router();

const purchaseController = require("../controllers/purchaseController");

router.post("/", purchaseController.createPurchase);

router.get("/", purchaseController.getPurchases);

router.get("/dashboard", purchaseController.purchaseDashboard);

router.get("/:id", purchaseController.getPurchase);

router.get("/details/:id", purchaseController.getPurchaseDetails);

router.put("/:id", purchaseController.updatePurchase);

router.delete("/:id", purchaseController.deletePurchase);

module.exports = router;