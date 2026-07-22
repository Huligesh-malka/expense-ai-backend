const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");

// Create
router.post("/create", productController.createProduct);

// Read - IMPORTANT: Put specific routes before dynamic ones
router.get("/", productController.getProducts);
router.get("/barcode/:barcode", productController.getProductByBarcode); // This MUST come before /:id
router.get("/:id", productController.getProduct);

// Update
router.put("/:id", productController.updateProduct);

// Delete
router.delete("/:id", productController.deleteProduct);

module.exports = router;