const express = require("express");

const router = express.Router();

const productController = require("../controllers/productController");

// Create
router.post("/create", productController.createProduct);

// Read
router.get("/", productController.getProducts);

router.get("/:id", productController.getProduct);

router.get(
    "/barcode/:barcode",
    productController.getProductByBarcode
);

// Update
router.put("/:id", productController.updateProduct);

// Delete
router.delete("/:id", productController.deleteProduct);

module.exports = router;