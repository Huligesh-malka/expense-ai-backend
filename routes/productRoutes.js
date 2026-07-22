const express = require("express");

const router = express.Router();

const productController = require("../controllers/productController");

// Create
router.post("/create", productController.createProduct);

// Barcode Route (must come before :id)
router.get(
    "/barcode/:barcode",
    productController.getProductByBarcode
);

// Read
router.get("/", productController.getProducts);

router.get("/:id", productController.getProduct);

// Update
router.put("/:id", productController.updateProduct);

// Delete
router.delete("/:id", productController.deleteProduct);

module.exports = router;