const express = require("express");
const router = express.Router();

const saleController = require("../controllers/saleController");

// Create Sale
router.post("/create", saleController.createSale);

// Get All Sales
router.get("/", saleController.getSales);

// Invoice (keep before /:id)
router.get("/invoice/:id", saleController.getInvoice);

// Update Payment
router.put("/:id/payment", saleController.updatePaymentStatus);

// Get Single Sale
router.get("/:id", saleController.getSale);

// Delete Sale
router.delete("/:id", saleController.deleteSale);

module.exports = router;